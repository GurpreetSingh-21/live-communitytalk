// CommunityTalkMobile/app/dm/[id].tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
} from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";
import DMHeader from "@/components/dm/DMHeader";

/* ───────────────── Types & helpers ───────────────── */
type DMMessage = {
  _id?: string;
  from: string;
  to: string;
  content: string;
  createdAt: string | Date;
  type?: "text" | "photo" | "voice";
  clientMessageId?: string;
  timestamp?: string | Date;
};

type PartnerMeta = {
  partnerId?: string;
  partnerName?: string;
  fullName?: string;
  name?: string;
  avatar?: string;
  photoUrl?: string;
  image?: string;
  online?: boolean;
  lastSeen?: string | Date;
  updatedAt?: string | Date;
};

const asId = (v: any) => (v ? String(v) : "");
const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dayLabel = (d: Date) => {
  const t = new Date();
  const y = new Date(t);
  y.setDate(t.getDate() - 1);
  if (isSameDay(d, t)) return "Today";
  if (isSameDay(d, y)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== t.getFullYear() ? "numeric" : undefined,
  }).format(d);
};

type UpsertOpts = { prefer?: "server" | "local" };

function upsertMessages(
  list: DMMessage[],
  incoming: DMMessage | DMMessage[],
  opts: UpsertOpts = {}
) {
  const preferServer = (opts.prefer ?? "server") === "server";
  const arr = Array.isArray(incoming) ? incoming : [incoming];

  const byId = new Map<string, DMMessage>();
  const byClient = new Map<string, DMMessage>();

  for (const m of list) {
    const sid = asId(m._id);
    const cid = asId(m.clientMessageId);
    if (sid) byId.set(sid, m);
    if (cid) byClient.set(cid, m);
  }

  for (const inc0 of arr) {
    const inc: DMMessage = {
      ...inc0,
      createdAt: inc0.timestamp ?? inc0.createdAt ?? new Date(),
    };

    const sid = asId(inc._id);
    const cid = asId(inc.clientMessageId);

    if (sid && byId.has(sid)) {
      const prev = byId.get(sid)!;
      const merged = preferServer ? { ...prev, ...inc } : { ...inc, ...prev };
      byId.set(sid, merged);
      if (cid && byClient.has(cid)) byClient.set(cid, merged);
      continue;
    }

    if (cid && byClient.has(cid)) {
      const prev = byClient.get(cid)!;
      const merged: DMMessage =
        preferServer ? { ...prev, ...inc } : { ...inc, ...prev };

      if (sid) {
        merged._id = sid;
        byId.set(sid, merged);
      }
      byClient.set(cid, merged);
      continue;
    }

    if (sid) byId.set(sid, inc);
    else if (cid) byClient.set(cid, inc);
    else byClient.set(`__noid_${Math.random()}`, inc);
  }

  const seen = new Set<string>();
  const out: DMMessage[] = [];

  for (const m of list) {
    const sid = asId(m._id);
    const cid = asId(m.clientMessageId);
    const cur = (sid && byId.get(sid)) || (cid && byClient.get(cid)) || m;
    const key = asId(cur._id) || (cid ? `c:${cid}` : "");
    if (!key) continue;
    if (!seen.has(key)) {
      out.push(cur);
      seen.add(key);
    }
  }
  for (const [sid, v] of byId) {
    if (!seen.has(sid)) {
      out.push(v);
      seen.add(sid);
    }
  }
  for (const [cid, v] of byClient) {
    const key = `c:${cid}`;
    if (!seen.has(key)) {
      out.push(v);
      seen.add(key);
    }
  }

  return out;
}

function finalizeUnique(list: DMMessage[]) {
  const added = new Set<string>();
  const out: DMMessage[] = [];
  for (const m of list) {
    const sid = asId(m._id);
    const cid = asId(m.clientMessageId);
    const key = sid || (cid ? `c:${cid}` : "");
    if (!key) continue;
    if (!added.has(key)) {
      out.push(m);
      added.add(key);
    }
  }
  return out.sort(
    (a, b) => asDate(a.createdAt).getTime() - asDate(b.createdAt).getTime()
  );
}

const msgKey = (m: DMMessage, idx: number) => {
  const sid = asId(m._id);
  const cid = asId(m.clientMessageId);
  return sid || (cid ? `c:${cid}` : `i:${idx}`);
};

/* ───────────────── Component ───────────────── */
export default function DMThreadScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const partnerId = String(params?.id || "");
  const paramName = params?.name ? String(params.name) : undefined;
  const paramAvatar = params?.avatar ? String(params.avatar) : undefined;

  const { user } = useContext(AuthContext) as any;
  const myId = String(user?._id || "");
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const { socket } = useSocket() as any;

  const [meta, setMeta] = useState<PartnerMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");

  const resolvedClientIdsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<FlatList<DMMessage>>(null);

  const colors = {
    bg: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#000",
    textSecondary: isDark ? "#EBEBF599" : "#3C3C4399",
    surface: isDark ? "#1C1C1E" : "#FFFFFF",
    border: isDark ? "#38383A" : "#E5E5EA",
    primaryStart: "#5E5CE6",
    primaryEnd: "#007AFF",
    headerBg: isDark ? "#0B0B0C" : "#FFFFFF",
  };

  /* ─────── Partner header fetch ─────── */
  const USER_ENDPOINTS = useMemo(
    () => [
      `/api/person/${partnerId}`,
      `/api/people/${partnerId}`,
      `/api/users/${partnerId}`,
      `/api/user/${partnerId}`,
    ],
    [partnerId]
  );

  const fetchPartnerMeta = useCallback(async (): Promise<PartnerMeta> => {
    const tryGet = async (path: string) => {
      try {
        const { data } = await api.get(path);
        return data;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    };

    for (const path of USER_ENDPOINTS) {
      const got = await tryGet(path);
      if (got) {
        return {
          partnerId,
          partnerName:
            got.partnerName ||
            got.fullName ||
            got.name ||
            `${got.firstName ?? ""} ${got.lastName ?? ""}`.trim() ||
            "Direct Message",
          avatar: got.avatar || got.photoUrl || got.image,
          online: got.online,
          lastSeen: got.lastSeen,
          updatedAt: got.updatedAt,
          ...got,
        };
      }
    }
    // ⭐ FIX 1: If API fails, return the name passed via navigation parameters
    return {
      partnerId,
      partnerName: paramName || "Direct Message",
      avatar: paramAvatar || undefined,
    };
  }, [USER_ENDPOINTS, partnerId, paramName, paramAvatar]); // Added paramName, paramAvatar

  /* ─────── Initial load ─────── */
  const loadInitial = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const [metaData] = await Promise.all([fetchPartnerMeta()]);

      // ⭐ FIX 2: Ensure the meta state uses the name/avatar if the API returned the fallback
      const finalMeta = {
        ...metaData,
        partnerName: metaData.partnerName || paramName,
        avatar: metaData.avatar || paramAvatar,
      };
      setMeta(finalMeta);

      let msgs: any[] = [];
      try {
        const { data } = await api.get(
          `/api/direct-messages/${partnerId}?limit=50`
        );
        msgs = Array.isArray(data) ? data : data?.items ?? [];
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
      }

      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, msgs, { prefer: "server" }))
      );
      setHasMore((msgs?.length ?? 0) >= 50);

      try {
        await api.patch(`/api/direct-messages/${partnerId}/read`);
      } catch (e: any) {
        if (e?.response?.status !== 404) console.log("[dm] read failed");
      }

      socket?.emit?.("room:join", { room: `dm:${partnerId}` });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error || "Failed to open chat");
    } finally {
      setLoading(false);
    }
  }, [partnerId, fetchPartnerMeta, socket, paramName, paramAvatar]); // Added paramName, paramAvatar

  useEffect(() => {
    loadInitial();
    return () => {
      socket?.emit?.("room:leave", { room: `dm:${partnerId}` });
    };
  }, [loadInitial, partnerId]); // Added partnerId dependency

  /* ─────── Pagination (older) ─────── */
  const loadOlder = useCallback(async () => {
    if (!messages.length || !hasMore) return;
    try {
      const oldest = messages[0];
      const before = encodeURIComponent(asDate(oldest.createdAt).toISOString());
      const { data } = await api.get(
        `/api/direct-messages/${partnerId}?limit=50&before=${before}`
      );
      const older: DMMessage[] = Array.isArray(data) ? data : data?.items ?? [];
      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, older, { prefer: "server" }))
      );
      setHasMore(older.length >= 50);
    } catch {
      // ignore
    }
  }, [messages, hasMore, partnerId]);

  /* ─────── Socket real-time ─────── */
  useEffect(() => {
    if (!socket) return;

    const onDM = (p: any) => {
      const from = String(p?.from || p?.senderId || "");
      const to = String(p?.to || "");
      if (![from, to].includes(partnerId)) return;

      const cid = asId(p.clientMessageId);
      if (cid && resolvedClientIdsRef.current.has(cid)) return;

      const serverMsg: DMMessage = {
        _id: p?._id ? String(p._id) : undefined,
        from,
        to,
        content: String(p.content ?? ""),
        createdAt: p.timestamp || p.createdAt || new Date(),
        type: p.type || "text",
        clientMessageId: p.clientMessageId,
      };

      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, serverMsg, { prefer: "server" }))
      );
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    };

    socket.on?.("dm:message", onDM);
    return () => socket.off?.("dm:message", onDM);
  }, [socket, partnerId]);

  /* ─────── Send ─────── */
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const clientMessageId = `dm_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const optimistic: DMMessage = {
      from: myId,
      to: partnerId,
      content: text,
      createdAt: new Date(),
      type: "text",
      clientMessageId,
    };

    setMessages((prev) =>
      finalizeUnique(upsertMessages(prev, optimistic, { prefer: "local" }))
    );
    setInput("");
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );

    try {
      let data: any;
      try {
        ({ data } = await api.post(`/api/direct-messages/${partnerId}`, {
          content: text,
          clientMessageId,
        }));
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
        console.log("[dm] falling back to body-style DM POST");
        ({ data } = await api.post(`/api/direct-messages`, {
          to: partnerId,
          content: text,
          clientMessageId,
        }));
      }

      const serverMsg: DMMessage = {
        _id: data?._id ? String(data._id) : undefined,
        from: String(data.from || myId),
        to: String(data.to || partnerId),
        content: String(data.content ?? text),
        createdAt: data.timestamp || data.createdAt || optimistic.createdAt,
        type: data.type || "text",
        clientMessageId,
      };

      if (clientMessageId) resolvedClientIdsRef.current.add(clientMessageId);

      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, serverMsg, { prefer: "server" }))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, content: "[failed to send]" }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, myId, partnerId]);

  /* ─────── UI helpers ─────── */
  // Prefer server meta; fall back to navigation params (so name shows even if meta 404s)
  const headerName =
    meta?.partnerName || meta?.fullName || meta?.name || paramName || "Direct Message";
  const headerAvatar = meta?.avatar || paramAvatar || undefined;
  const lastSeenIso = meta?.lastSeen || meta?.updatedAt;
  const status =
    meta?.online
      ? "online"
      : lastSeenIso
        ? `last seen ${new Date(lastSeenIso as any).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`
        : "";

  const renderItem = ({
    item,
    index,
  }: {
    item: DMMessage;
    index: number;
  }) => {
    const mine = String(item.from) === myId;
    const prev = messages[index - 1];
    const curD = asDate(item.createdAt);
    const showDate = !prev || !isSameDay(curD, asDate(prev.createdAt));
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 3 }}>
        {showDate && (
          <View style={{ alignItems: "center", marginVertical: 12 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                {dayLabel(curD)}
              </Text>
            </View>
          </View>
        )}
        <View
          style={{
            alignItems: mine ? "flex-end" : "flex-start",
            marginBottom: 6,
          }}
        >
          <View style={{ maxWidth: "75%" }}>
            {mine ? (
              <LinearGradient
                colors={[colors.primaryStart, colors.primaryEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, lineHeight: 22 }}>
                  {item.content}
                </Text>
              </LinearGradient>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22 }}>
                  {item.content}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const data = useMemo(() => finalizeUnique(messages), [messages]);

  /* ─────── Render ─────── */
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {/* Hide native header completely; we draw our own top bar */}
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={data}
              keyExtractor={msgKey}
              renderItem={renderItem}
              onEndReachedThreshold={0.2}
              onEndReached={loadOlder}
              ListHeaderComponent={
                <View
                  style={{
                    paddingTop: 4, // small extra to breathe under the notch
                    backgroundColor: colors.headerBg,
                  }}
                >
                  <DMHeader
                    name={headerName}
                    avatar={headerAvatar}
                    status={status}
                    onPressBack={() => router.back()}
                    onPressProfile={() => {
                      // We need the full user object to show the modal/profile,
                      // but since we don't have it directly, we navigate to the profile screen
                      // which will fetch the data using the partnerId.
                      // Alternatively, we could open the UserProfileModal component here if it's imported.
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: partnerId },
                      } as never); // ⭐ FIX: Using as never to bypass the strict type error
                    }}
                    onPressMore={() => {
                      // open a bottom sheet / actions
                    }}
                    themeBg={colors.headerBg}
                    themeBorder={colors.border}
                    dark={isDark}
                  />
                </View>
              }
              stickyHeaderIndices={[0]}
              contentContainerStyle={{
                paddingBottom: Math.max(92, insets.bottom + 60),
              }}
              showsVerticalScrollIndicator={false}
            />

            {/* Composer */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                paddingBottom:
                  Platform.OS === "ios"
                    ? Math.max(16, insets.bottom) + 8
                    : 12,
                borderTopWidth: 0.5,
                borderTopColor: colors.border,
                backgroundColor: colors.bg,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7",
                  borderRadius: 24,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message"
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    color: colors.text,
                    fontSize: 17,
                    flex: 1,
                    minHeight: 36,
                    paddingVertical: 8,
                  }}
                  multiline
                  editable={!sending}
                />
                <TouchableOpacity
                  onPress={send}
                  disabled={sending || !input.trim()}
                  style={{
                    marginLeft: 8,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    overflow: "hidden",
                    opacity: sending || !input.trim() ? 0.4 : 1,
                  }}
                >
                  <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                  >
                    {sending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons name="arrow-up" size={20} color="#fff" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
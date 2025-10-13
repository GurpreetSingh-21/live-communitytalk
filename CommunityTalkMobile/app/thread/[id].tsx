// CommunityTalkMobile/app/thread/[id].tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

/* ───────────────── Types ───────────────── */
type ChatMessage = {
  _id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: string | Date;
  communityId: string; // if threads have their own id on backend, this can be threadId instead
  status?: "sent" | "edited" | "deleted";
  isDeleted?: boolean;
  clientMessageId?: string;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ───────────────── Helpers ───────────────── */
const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const byAscTime = (a: ChatMessage, b: ChatMessage) =>
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dayLabel = (d: Date) => {
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, y)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(d);
};

const showGap = (prev?: ChatMessage, cur?: ChatMessage) => {
  if (!prev || !cur) return true;
  return (
    Math.abs(asDate(cur.timestamp).getTime() - asDate(prev.timestamp).getTime()) >
    15 * 60 * 1000
  );
};

/* ───────────────── Theme Hook (keeps your exact colors) ───────────────── */
const useTheme = () => {
  const isDark = useColorScheme() === "dark";
  return {
    isDark,
    colors: {
      bg: isDark ? "#000000" : "#FFFFFF",
      surface: isDark ? "#1C1C1E" : "#F2F2F7",
      surfaceElevated: isDark ? "#2C2C2E" : "#FFFFFF",
      border: isDark ? "#38383A" : "#E5E5EA",
      text: isDark ? "#FFFFFF" : "#000000",
      textSecondary: isDark ? "#EBEBF599" : "#3C3C4399",
      textTertiary: isDark ? "#EBEBF54D" : "#3C3C434D",
      primary: "#007AFF",
      primaryGradientStart: "#5E5CE6",
      primaryGradientEnd: "#007AFF",
      destructive: "#FF3B30",
      success: "#34C759",
      inputBg: isDark ? "#1C1C1E" : "#F2F2F7",
      shadow: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.08)",
    },
  };
};

/* ───────────────── Screen ───────────────── */
export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = String(id || ""); // if this is actually a threadId in your API, rename consistently
  const { isDark, colors } = useTheme();
  const { socket, socketConnected } = useSocket() as any;
  const { user } = React.useContext(AuthContext) as any;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const fetchingMoreRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  // track newest timestamp to fetch "newer" on reconnect/join
  const newestTsRef = useRef<string | null>(null);

  const headerTitle = useMemo(() => "Thread", []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const upsertManySorted = useCallback((incoming: ChatMessage[]) => {
    if (!incoming?.length) return;
    setMessages((prev) => {
      const map = new Map<string, ChatMessage>();
      for (const m of prev) map.set(String(m._id || m.clientMessageId), m);
      for (const m of incoming) {
        const k = String(m._id || m.clientMessageId);
        const prevM = map.get(k);
        map.set(k, prevM ? { ...prevM, ...m } : m);
      }
      const next = Array.from(map.values()).sort(byAscTime);
      const last = next[next.length - 1];
      newestTsRef.current = last ? asDate(last.timestamp).toISOString() : newestTsRef.current;
      return next;
    });
  }, []);

  /* ─────────── Fetch initial ─────────── */
  const fetchInitial = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/messages/${communityId}?limit=50`);
      const items: ChatMessage[] = Array.isArray(data) ? data : [];
      items.sort(byAscTime);
      setMessages(items);
      setHasMore(items.length >= 50);
      const last = items[items.length - 1];
      newestTsRef.current = last ? asDate(last.timestamp).toISOString() : null;
      scrollToEnd();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [communityId, scrollToEnd]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  /* ─────────── Fetch older (preserve your "Load earlier messages") ─────────── */
  const fetchOlder = useCallback(async () => {
    if (!communityId || fetchingMoreRef.current || !hasMore || !messages.length) return;
    try {
      fetchingMoreRef.current = true;
      const oldest = messages[0];
      const before = encodeURIComponent(asDate(oldest.timestamp).toISOString());
      const { data } = await api.get(`/api/messages/${communityId}?limit=50&before=${before}`);
      const older: ChatMessage[] = Array.isArray(data) ? data : [];
      older.sort(byAscTime);
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length >= 50);
    } finally {
      fetchingMoreRef.current = false;
    }
  }, [communityId, hasMore, messages]);

  /* ─────────── Fetch newer (used on join/reconnect) ─────────── */
  const fetchNewer = useCallback(async () => {
    if (!communityId) return;
    const since = newestTsRef.current;
    if (!since) return;
    try {
      const after = encodeURIComponent(since);
      const { data } = await api.get(`/api/messages/${communityId}?after=${after}&limit=100`);
      const newer: ChatMessage[] = Array.isArray(data) ? data : [];
      if (newer.length) {
        upsertManySorted(newer);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        scrollToEnd();
      }
    } catch {
      // swallow — it's a best-effort catch-up
    }
  }, [communityId, upsertManySorted, scrollToEnd]);

  /* ─────────── Send message (optimistic) ─────────── */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !communityId) return;
    setSending(true);
    setError(null);
    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const optimistic: ChatMessage = {
      _id: clientMessageId,
      clientMessageId,
      sender: user?.fullName || "You",
      senderId: String(user?._id || "me"),
      content: text,
      timestamp: new Date(),
      communityId,
      status: "sent",
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) => [...prev, optimistic]);
    newestTsRef.current = asDate(optimistic.timestamp).toISOString();
    setInput("");
    scrollToEnd();

    try {
      const { data } = await api.post(`/api/messages`, {
        content: text,
        communityId,
        clientMessageId,
      });
      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) => m.clientMessageId === clientMessageId || m._id === clientMessageId
        );
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...data,
          _id: String(data._id),
          timestamp: data.timestamp || next[idx].timestamp,
        };
        const last = next[next.length - 1];
        newestTsRef.current = last ? asDate(last.timestamp).toISOString() : newestTsRef.current;
        return next;
      });
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId || m._id === clientMessageId
            ? { ...m, status: "deleted", content: "[failed to send]" }
            : m
        )
      );
      setError(e?.response?.data?.error || "Failed to send");
    } finally {
      setSending(false);
    }
  }, [input, sending, communityId, user?._id, user?.fullName, scrollToEnd]);

  /* ─────────── Socket: join & rejoin room ───────────
     NOTE: If your backend has thread-specific rooms, switch the event name to e.g. "subscribe:threads". */
  useEffect(() => {
    if (!socket || !communityId) return;

    const join = () => socket.emit?.("subscribe:communities", { ids: [communityId] });
    const leave = () => socket.emit?.("unsubscribe:communities", { ids: [communityId] });

    join();
    const onConnect = () => {
      join();
      // after reconnect, catch up any missed messages
      fetchNewer();
    };
    socket.on?.("connect", onConnect);

    return () => {
      socket.off?.("connect", onConnect);
      leave();
    };
  }, [socket, socketConnected, communityId, fetchNewer]);

  /* ─────────── Socket: realtime updates ─────────── */
  useEffect(() => {
    if (!socket || !communityId) return;

    const onNew = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      upsertManySorted([payload]);
      scrollToEnd();
    };

    const onEdited = (p: any) => {
      if (String(p?.communityId) !== communityId) return;
      upsertManySorted([p]);
    };

    const onDeleted = (p: any) => {
      if (String(p?.communityId) !== communityId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(p._id) || String(m._id) === String(p?.messageId)
            ? { ...m, isDeleted: true, status: "deleted", content: "" }
            : m
        )
      );
    };

    socket.on?.("receive_message", onNew);
    socket.on?.("message:updated", onEdited);
    socket.on?.("message:deleted", onDeleted);

    return () => {
      socket.off?.("receive_message", onNew);
      socket.off?.("message:updated", onEdited);
      socket.off?.("message:deleted", onDeleted);
    };
  }, [socket, communityId, upsertManySorted, scrollToEnd]);

  /* ─────────── Row (keeps your exact modern UI) ─────────── */
  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const myIds = [String(user?._id || ""), "me"];
    const mine = myIds.includes(String(item.senderId || ""));
    const prev = messages[index - 1];
    const cur = asDate(item.timestamp);
    const prevDate = prev ? asDate(prev.timestamp) : undefined;
    const showDateDivider = !prev || !prevDate || !isSameDay(cur, prevDate);

    const next = messages[index + 1];
    const isFirstOfGroup = !prev || prev.senderId !== item.senderId || showGap(prev, item);
    const isLastOfGroup = !next || next.senderId !== item.senderId || showGap(item, next);

    const deleted = item.isDeleted || item.status === "deleted";

    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 3 }}>
        {showDateDivider && (
          <View style={{ alignItems: "center", marginVertical: 16 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 12,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                {dayLabel(cur)}
              </Text>
            </View>
          </View>
        )}

        <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: isLastOfGroup ? 12 : 2 }}>
          {!mine && isFirstOfGroup && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginBottom: 4,
                marginLeft: 12,
                fontWeight: "500",
              }}
            >
              {item.sender}
            </Text>
          )}

          <View style={{ maxWidth: "75%" }}>
            {mine ? (
              <LinearGradient
                colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderTopRightRadius: isFirstOfGroup ? 20 : 6,
                  borderBottomRightRadius: isLastOfGroup ? 20 : 6,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                }}
              >
                {deleted ? (
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" }}>
                    Message deleted
                  </Text>
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 22 }}>
                    {item.content}
                  </Text>
                )}
              </LinearGradient>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surfaceElevated,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderTopLeftRadius: isFirstOfGroup ? 20 : 6,
                  borderBottomLeftRadius: isLastOfGroup ? 20 : 6,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                }}
              >
                {deleted ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: "italic" }}>
                    Message deleted
                  </Text>
                ) : (
                  <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22 }}>
                    {item.content}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const keyExtractor = (m: ChatMessage) => String(m._id);

  /* ─────────── UI ─────────── */
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ backgroundColor: colors.bg }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header (same look) */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: Platform.OS === "ios" ? 60 : 16,
          paddingBottom: 16,
          backgroundColor: colors.bg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }}>
            {headerTitle}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            }}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error banner */}
      {!!error && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            backgroundColor: isDark ? "rgba(255, 59, 48, 0.15)" : "#FFEBEE",
            borderLeftWidth: 3,
            borderLeftColor: colors.destructive,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: colors.destructive, fontSize: 14, fontWeight: "500" }}>{error}</Text>
        </View>
      )}

      {/* Messages */}
      <View className="flex-1" style={{ marginTop: 8 }}>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={
              hasMore ? (
                <TouchableOpacity
                  onPress={fetchOlder}
                  disabled={fetchingMoreRef.current}
                  style={{ paddingVertical: 16, alignItems: "center" }}
                >
                  {fetchingMoreRef.current ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                      }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                        Load earlier messages
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <View style={{ alignItems: "center" }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Ionicons name="chatbubbles-outline" size={24} color={colors.textSecondary} />
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "500" }}>
                      Start of conversation
                    </Text>
                  </View>
                </View>
              )
            }
            onContentSizeChange={() => scrollToEnd()}
            contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Composer (same look) */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: Platform.OS === "ios" ? 32 : 12,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            backgroundColor: colors.inputBg,
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 8,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message"
            placeholderTextColor={colors.textSecondary}
            style={{
              color: colors.text,
              paddingVertical: 8,
              fontSize: 17,
              flex: 1,
              maxHeight: 100,
            }}
            editable={!sending}
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={sending || input.trim().length === 0}
            style={{
              marginLeft: 8,
              width: 36,
              height: 36,
              borderRadius: 18,
              overflow: "hidden",
              opacity: sending || input.trim().length === 0 ? 0.4 : 1,
            }}
          >
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" style={{ fontWeight: "700" }} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
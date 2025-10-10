// app/community/[id].tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  RefreshControl,
  Alert,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

/* ───────────────────────── Types ───────────────────────── */
type Community = {
  _id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MemberRow = {
  _id: string;
  person: string | null;
  community: string;
  fullName: string;
  email?: string;
  avatar?: string;
  status: "online" | "offline";
  isYou: boolean;
};

type ChatMessage = {
  _id: string;
  sender: string;
  senderId: string;
  avatar?: string;
  content: string;
  timestamp: string | Date;
  communityId: string;
  status?: "sent" | "edited" | "deleted";
  editedAt?: string | Date | null;
  isDeleted?: boolean;
  deletedAt?: string | Date | null;
  clientMessageId?: string;
};

const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const SCREEN_W = Dimensions.get("window").width;

/* ───────────────────────── Component ───────────────────────── */
export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = String(id || "");
  const isDark = useColorScheme() === "dark";
  const { user } = React.useContext(AuthContext) as any;
  const { socket } = useSocket();

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // membership
  const isMember = useMemo(() => {
    const ids: string[] = Array.isArray(user?.communityIds) ? user.communityIds.map(String) : [];
    return ids.includes(communityId);
  }, [user?.communityIds, communityId]);

  // theme tokens
  const textColor = isDark ? "white" : "black";
  const subText = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
  const cardBg = isDark ? "#111827" : "#FFFFFF";
  const borderCol = isDark ? "#1F2937" : "#E5E7EB";
  const chipBg = isDark ? "#0B1220" : "#F3F4F6";
  const joinColor = "#10B981";
  const leaveColor = "#EF4444";

  /* ─────────────── Load community ─────────────── */
  const loadCommunity = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/communities/${communityId}`);
      setCommunity(data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error || "Failed to load community");
      setCommunity(null);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  /* ─────────────── Members tab ─────────────── */
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchingRef = useRef(false);

  const fetchMembers = useCallback(
    async ({ reset = false, useCursor }: { reset?: boolean; useCursor?: string | null } = {}) => {
      if (!isMember || !communityId) return;
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        let nextCursor = useCursor ?? null;
        if (reset) {
          setCursor(null);
          setHasMore(true);
          nextCursor = null;
        }

        const params: string[] = [];
        if (q.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
        if (statusFilter !== "all") params.push(`status=${statusFilter}`);
        if (nextCursor) params.push(`cursor=${nextCursor}`);
        const qs = params.length ? `?${params.join("&")}` : "";

        const { data } = await api.get(`/api/members/${communityId}${qs}`);
        const list: MemberRow[] = Array.isArray(data?.items) ? data.items : [];
        const serverCursor = data?.nextCursor || null;
        const more = Boolean(data?.hasMore);

        setMembers((prev) => (reset || !nextCursor ? list : [...prev, ...list]));
        setCursor(serverCursor);
        setHasMore(more);
      } catch {
        // soft fail
      } finally {
        fetchingRef.current = false;
      }
    },
    [isMember, communityId, q, statusFilter]
  );

  useEffect(() => {
    if (!isMember) {
      setMembers([]);
      setCursor(null);
      setHasMore(true);
      return;
    }
    fetchMembers({ reset: true });
  }, [isMember, communityId, q, statusFilter, fetchMembers]);

  const refreshMembers = useCallback(async () => {
    if (!isMember) return;
    setRefreshing(true);
    await fetchMembers({ reset: true });
    setRefreshing(false);
  }, [isMember, fetchMembers]);

  const loadMoreMembers = () => {
    if (isMember && hasMore && !fetchingRef.current) {
      fetchMembers({ useCursor: cursor ?? null });
    }
  };

  /* ─────────────── Chat tab ─────────────── */
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHasMore, setChatHasMore] = useState(true);
  const fetchingMoreChatRef = useRef(false);

  const fetchInitialChat = useCallback(async () => {
    if (!communityId || !isMember) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const { data } = await api.get(`/api/messages/${communityId}?limit=50`);
      const items: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages(items);
      setChatHasMore(items.length >= 50);
    } catch (e: any) {
      setChatError(e?.response?.data?.error || "Failed to load messages");
    } finally {
      setChatLoading(false);
    }
  }, [communityId, isMember]);

  useEffect(() => {
    if (isMember) fetchInitialChat();
    else {
      setMessages([]);
      setChatError(null);
      setChatLoading(false);
    }
  }, [fetchInitialChat, isMember]);

  const fetchOlderChat = useCallback(async () => {
    if (!communityId || fetchingMoreChatRef.current || !chatHasMore || !messages.length) return;
    try {
      fetchingMoreChatRef.current = true;
      const oldest = messages[0];
      const before = encodeURIComponent(asDate(oldest.timestamp).toISOString());
      const { data } = await api.get(`/api/messages/${communityId}?limit=50&before=${before}`);
      const older: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages((prev) => [...older, ...prev]);
      setChatHasMore(older.length >= 50);
    } catch {
      // silent
    } finally {
      fetchingMoreChatRef.current = false;
    }
  }, [communityId, chatHasMore, messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !communityId) return;

    setSending(true);
    setChatError(null);
    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // optimistic append
    const optimistic: ChatMessage = {
      _id: clientMessageId,
      clientMessageId,
      sender: "You",
      senderId: "me",
      content: text,
      timestamp: new Date(),
      communityId,
      status: "sent",
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const { data } = await api.post(`/api/messages`, {
        content: text,
        communityId,
        clientMessageId,
      });
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.clientMessageId === clientMessageId || m._id === clientMessageId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...data,
          _id: String(data._id),
          timestamp: data.timestamp || next[idx].timestamp,
          clientMessageId: data.clientMessageId ?? next[idx].clientMessageId,
        };
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
      setChatError(e?.response?.data?.error || "Failed to send");
    } finally {
      setSending(false);
    }
  }, [input, sending, communityId]);

  // realtime hooks
  useEffect(() => {
    if (!socket || !communityId || !isMember) return;

    const onNew = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      if (payload?.clientMessageId) {
        setMessages((prev) => {
          const i = prev.findIndex(
            (m) => m.clientMessageId === payload.clientMessageId || m._id === payload.clientMessageId
          );
          if (i === -1) return [...prev, payload];
          const next = [...prev];
          next[i] = { ...next[i], ...payload, _id: String(payload._id) };
          return next;
        });
      } else {
        setMessages((prev) => [...prev, payload]);
      }
    };
    const onEdited = (p: any) => {
      if (String(p?.communityId) !== communityId) return;
      setMessages((prev) => prev.map((m) => (String(m._id) === String(p._id) ? { ...m, ...p } : m)));
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
  }, [socket, communityId, isMember]);

  /* ─────────────── Join / Leave ─────────────── */
  const join = async () => {
    try {
      setBusy(true);
      await api.post(`/api/communities/${communityId}/join`);
      if (Array.isArray(user?.communityIds)) user.communityIds.push(communityId);
      await loadCommunity();
      await fetchMembers({ reset: true });
      await fetchInitialChat();
    } catch (e: any) {
      Alert.alert("Join failed", e?.response?.data?.error || "Unable to join this community");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    Alert.alert("Leave community?", "You will lose access to members & messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            await api.post(`/api/communities/${communityId}/leave`);
            if (Array.isArray(user?.communityIds)) {
              const i = user.communityIds.findIndex((x: any) => String(x) === communityId);
              if (i >= 0) user.communityIds.splice(i, 1);
            }
            setMembers([]);
            setCursor(null);
            setHasMore(true);
            setMessages([]);
            await loadCommunity();
          } catch (e: any) {
            Alert.alert("Leave failed", e?.response?.data?.error || "Unable to leave this community");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /* ─────────────── Tab/Pager ─────────────── */
  const [page, setPage] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const goTo = (p: number) => {
    setPage(p);
    pagerRef.current?.scrollTo({ x: p * SCREEN_W, animated: true });
  };

  const onMomentumEnd = (e: any) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (p !== page) setPage(p);
  };

  /* ─────────────── Small UI chunks ─────────────── */
  const Header = () => (
    <View className="px-4 pt-4 pb-2">
      <Text className="text-2xl font-bold" style={{ color: textColor }}>
        {community?.name || "Community"}
      </Text>
      {!!community?.description && (
        <Text className="mt-1" style={{ color: subText }}>
          {community.description}
        </Text>
      )}

      <View className="mt-3 flex-row gap-2">
        {!isMember ? (
          <TouchableOpacity
            disabled={busy}
            onPress={join}
            className="rounded-xl px-4 py-2"
            style={{ backgroundColor: joinColor }}
          >
            <Text className="text-white font-semibold">Join</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            disabled={busy}
            onPress={leave}
            className="rounded-xl px-4 py-2"
            style={{ backgroundColor: leaveColor }}
          >
            <Text className="text-white font-semibold">Leave</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      {isMember && (
        <View className="mt-4 flex-row rounded-2xl p-1" style={{ backgroundColor: chipBg, borderColor: borderCol, borderWidth: 1 }}>
          {["Chat", "Members"].map((label, i) => (
            <TouchableOpacity
              key={label}
              onPress={() => goTo(i)}
              className="flex-1 items-center justify-center rounded-xl py-2"
              style={{ backgroundColor: page === i ? (isDark ? "#1F2937" : "#FFFFFF") : "transparent" }}
            >
              <Text style={{ color: textColor, fontWeight: page === i ? "700" as any : "500" as any }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const Filters = () => (
    <View className="px-4 pb-3">
      <View
        className="flex-row items-center rounded-2xl px-3"
        style={{ borderWidth: 1, borderColor: borderCol, backgroundColor: cardBg }}
      >
        <Ionicons name="search" size={16} color={subText} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search members"
          placeholderTextColor={subText}
          className="flex-1 ml-2 py-2"
          style={{ color: textColor }}
          onSubmitEditing={() => fetchMembers({ reset: true })}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={() => setStatusFilter((s) => (s === "all" ? "online" : s === "online" ? "offline" : "all"))}
          className="ml-2 rounded-full px-3 py-1"
          style={{ backgroundColor: chipBg, borderWidth: 1, borderColor: borderCol }}
        >
          <Text style={{ color: textColor, fontSize: 12 }}>
            {statusFilter === "all" ? "All" : statusFilter === "online" ? "Online" : "Offline"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMember = ({ item }: { item: MemberRow }) => (
    <View
      className="mx-4 mb-3 rounded-2xl px-4 py-3"
      style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: borderCol }}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-semibold" style={{ color: textColor }}>
            {item.fullName}
          </Text>
          {!!item.email && (
            <Text style={{ color: subText, fontSize: 12 }} numberOfLines={1}>
              {item.email}
            </Text>
          )}
        </View>
        <View
          className="rounded-full px-2 py-1"
          style={{ backgroundColor: item.status === "online" ? "#DCFCE7" : "#E5E7EB" }}
        >
          <Text style={{ color: item.status === "online" ? "#166534" : "#111827", fontSize: 11, fontWeight: "700" }}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      {item.isYou && (
        <Text className="mt-1" style={{ color: subText, fontSize: 11 }}>
          This is you
        </Text>
      )}
    </View>
  );

  const headerRight = (
    <TouchableOpacity onPress={() => router.back()} className="mr-3">
      <Ionicons name="close" size={22} color={textColor} />
    </TouchableOpacity>
  );

  /* ─────────────── Render ─────────────── */
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ backgroundColor: isDark ? "#0B1220" : "#F8FAFC" }}
    >
      <Stack.Screen
        options={{
          title: community?.name || "Community",
          headerRight: () => headerRight,
        }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !community ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: textColor, fontSize: 16, textAlign: "center" }}>
            Community not found.
          </Text>
        </View>
      ) : (
        <>
          <Header />

          {!isMember ? (
            <View className="px-4 py-6">
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: borderCol }}
              >
                <Text style={{ color: subText }}>
                  Join this community to chat and view members.
                </Text>
              </View>
            </View>
          ) : (
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onMomentumEnd}
            >
              {/* PAGE 0: CHAT */}
              <View style={{ width: SCREEN_W }}>
                {!!chatError && (
                  <View className="mx-4 mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: "#FEE2E2", borderColor: "#FCA5A5", borderWidth: 1 }}>
                    <Text style={{ color: "#B91C1C" }}>{chatError}</Text>
                  </View>
                )}

                <View className="flex-1 mt-2" style={{ height: "82%" }}>
                  {chatLoading ? (
                    <View className="flex-1 items-center justify-center">
                      <ActivityIndicator />
                    </View>
                  ) : (
                    <FlatList
                      data={messages}
                      keyExtractor={(m) => String(m._id)}
                      renderItem={({ item }) => {
                        const mine = item.senderId === "me";
                        const deleted = item.isDeleted || item.status === "deleted";
                        const bubbleColor = mine ? (isDark ? "#4C1D95" : "#EEF2FF") : (isDark ? "#1F2937" : "#FFFFFF");
                        const align = mine ? "flex-end" : "flex-start";
                        const hint = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

                        return (
                          <View className="px-4 py-1">
                            <View style={{ alignItems: align }}>
                              <View
                                className="max-w-[85%] rounded-2xl px-4 py-2"
                                style={{ backgroundColor: bubbleColor, borderWidth: 1, borderColor: borderCol }}
                              >
                                {!mine && (
                                  <Text className="mb-1 text-[11px]" style={{ color: hint }}>
                                    {item.sender}
                                  </Text>
                                )}
                                {deleted ? (
                                  <Text className="text-xs" style={{ color: hint }}>
                                    message deleted
                                  </Text>
                                ) : (
                                  <Text style={{ color: isDark ? "white" : "black" }}>{item.content}</Text>
                                )}
                                <View className="mt-1 flex-row items-center gap-2">
                                  {item.status === "edited" && (
                                    <Text className="text-[10px]" style={{ color: hint }}>
                                      edited
                                    </Text>
                                  )}
                                  <Text className="text-[10px]" style={{ color: hint }}>
                                    {asDate(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      }}
                      ListHeaderComponent={
                        chatHasMore ? (
                          <TouchableOpacity onPress={fetchOlderChat} disabled={fetchingMoreChatRef.current} className="py-3">
                            <View className="items-center">
                              {fetchingMoreChatRef.current ? <ActivityIndicator /> : <Text style={{ color: subText }}>Load earlier messages</Text>}
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View className="py-2 items-center">
                            <Text style={{ color: subText, fontSize: 12 }}>Start of conversation</Text>
                          </View>
                        )
                      }
                      contentContainerStyle={{ paddingBottom: 84, paddingTop: 8 }}
                    />
                  )}
                </View>

                {/* Composer */}
                <View
                  className="px-3 py-2"
                  style={{ borderTopWidth: 1, borderTopColor: borderCol, backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }}
                >
                  <View
                    className="flex-row items-center rounded-2xl px-3"
                    style={{ borderWidth: 1, borderColor: borderCol, backgroundColor: isDark ? "#111827" : "#F9FAFB" }}
                  >
                    <TextInput
                      value={input}
                      onChangeText={setInput}
                      placeholder="Write a message…"
                      placeholderTextColor={subText}
                      className="flex-1 py-3 text-base"
                      style={{ color: isDark ? "white" : "black" }}
                      editable={!sending}
                      multiline
                    />
                    <TouchableOpacity
                      onPress={sendMessage}
                      disabled={sending || input.trim().length === 0}
                      className="ml-2 h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: sending || input.trim().length === 0 ? "#9CA3AF" : "#6366F1" }}
                    >
                      {sending ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={18} color="white" />}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* PAGE 1: MEMBERS */}
              <View style={{ width: SCREEN_W }}>
                <Filters />
                <FlatList
                  data={members}
                  keyExtractor={(m) => String(m._id)}
                  renderItem={renderMember}
                  onEndReachedThreshold={0.3}
                  onEndReached={loadMoreMembers}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshMembers} tintColor={textColor} />}
                  ListFooterComponent={
                    hasMore ? (
                      <View className="py-4 items-center">
                        <ActivityIndicator />
                      </View>
                    ) : (
                      <View className="py-4 items-center">
                        <Text style={{ color: subText, fontSize: 12 }}>No more members</Text>
                      </View>
                    )
                  }
                  contentContainerStyle={{ paddingBottom: 24 }}
                />
              </View>
            </ScrollView>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}
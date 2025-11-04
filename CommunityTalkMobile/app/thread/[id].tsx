// CommunityTalkMobile/app/thread/[id].tsx
// UPDATED TO HANDLE BOTH DM THREADS AND COMMUNITY THREADS

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
import { getDMMessages, sendDMMessage } from "@/src/api/dm";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

/* ───────────────── Types ───────────────── */
type ChatMessage = {
  _id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: string | Date;
  threadId?: string;
  communityId?: string;
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

// Normalize any message to ChatMessage format
const normalizeToChatMessage = (msg: any): ChatMessage => {
  return {
    _id: msg._id,
    sender: msg.sender || msg.senderName || "Unknown",
    senderId: msg.senderId,
    content: msg.content,
    timestamp: msg.timestamp,
    threadId: msg.threadId,
    communityId: msg.communityId,
    status: msg.status,
    isDeleted: msg.isDeleted,
    clientMessageId: msg.clientMessageId,
  };
};

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

/* ───────────────── Theme Hook ───────────────── */
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
  const { id, userName, isDM } = useLocalSearchParams<{ 
    id: string; 
    userName?: string;
    isDM?: string;
  }>();
  
  const threadId = String(id || "");
  const isDirectMessage = isDM === "true";
  
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

  const newestTsRef = useRef<string | null>(null);

  const headerTitle = useMemo(() => {
    if (userName) return userName;
    return isDirectMessage ? "Direct Message" : "Thread";
  }, [userName, isDirectMessage]);

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
    if (!threadId) return;
    setLoading(true);
    setError(null);
    try {
      let items: any[] = [];

      if (isDirectMessage) {
        // Fetch DM messages
        items = await getDMMessages(threadId, { limit: 50 });
      } else {
        // Fetch community messages (fallback to existing API)
        const { data } = await api.get(`/api/messages/${threadId}?limit=50`);
        items = Array.isArray(data) ? data : [];
      }

      // Normalize all messages to ChatMessage format
      const normalized = items.map(normalizeToChatMessage);
      normalized.sort(byAscTime);
      setMessages(normalized);
      setHasMore(normalized.length >= 50);
      const last = normalized[normalized.length - 1];
      newestTsRef.current = last ? asDate(last.timestamp).toISOString() : null;
      scrollToEnd();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [threadId, isDirectMessage, scrollToEnd]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  /* ─────────── Fetch older ─────────── */
const fetchOlder = useCallback(async () => {
  if (!threadId || fetchingMoreRef.current || !hasMore || !messages.length) return;
  try {
    fetchingMoreRef.current = true;
    const oldest = messages[0];

    let older: any[] = [];
    if (isDirectMessage) {
      // ❌ was: const before = encodeURIComponent(asDate(oldest.timestamp).toISOString());
      // Pass a Date (or plain ISO) — getDMMessages() will serialize it correctly.
      const beforeDate = asDate(oldest.timestamp);
      older = await getDMMessages(threadId, { limit: 50, before: beforeDate });
    } else {
      const before = encodeURIComponent(asDate(oldest.timestamp).toISOString());
      const { data } = await api.get(`/api/messages/${threadId}?limit=50&before=${before}`);
      older = Array.isArray(data) ? data : [];
    }

    const normalized = older.map(normalizeToChatMessage).sort(byAscTime);
    setMessages((prev) => [...normalized, ...prev]);
    setHasMore(normalized.length >= 50);
  } finally {
    fetchingMoreRef.current = false;
  }
}, [threadId, isDirectMessage, hasMore, messages]);

  /* ─────────── Send message ─────────── */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !threadId) return;
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
      threadId: isDirectMessage ? threadId : undefined,
      communityId: !isDirectMessage ? threadId : undefined,
      status: "sent",
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    scrollToEnd();

    try {
      let data: any;

      if (isDirectMessage) {
        // Send DM message
        data = await sendDMMessage({
          threadId,
          content: text,
          clientMessageId,
        });
      } else {
        // Send community message
        const res = await api.post(`/api/messages`, {
          content: text,
          communityId: threadId,
          clientMessageId,
        });
        data = res.data;
      }

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
  }, [input, sending, threadId, isDirectMessage, user?._id, user?.fullName, scrollToEnd]);

  /* ─────────── Socket: join room ─────────── */
  useEffect(() => {
    if (!socket || !threadId) return;

    const roomName = isDirectMessage ? `dm:${threadId}` : `community:${threadId}`;
    
    const join = () => {
      if (isDirectMessage) {
        socket.emit?.("dm:join", { threadId });
      } else {
        socket.emit?.("subscribe:communities", { ids: [threadId] });
      }
    };

    const leave = () => {
      if (isDirectMessage) {
        socket.emit?.("dm:leave", { threadId });
      } else {
        socket.emit?.("unsubscribe:communities", { ids: [threadId] });
      }
    };

    join();
    const onConnect = () => join();
    socket.on?.("connect", onConnect);

    return () => {
      socket.off?.("connect", onConnect);
      leave();
    };
  }, [socket, socketConnected, threadId, isDirectMessage]);

  /* ─────────── Socket: realtime updates ─────────── */
  useEffect(() => {
    if (!socket || !threadId) return;

    const onNew = (payload: any) => {
      // Check if message belongs to this thread
      const belongsHere = isDirectMessage
        ? String(payload?.threadId) === threadId
        : String(payload?.communityId) === threadId;

      if (!belongsHere) return;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      upsertManySorted([payload]);
      scrollToEnd();
    };

    const onEdited = (p: any) => {
      const belongsHere = isDirectMessage
        ? String(p?.threadId) === threadId
        : String(p?.communityId) === threadId;
      if (!belongsHere) return;
      upsertManySorted([p]);
    };

    const onDeleted = (p: any) => {
      const belongsHere = isDirectMessage
        ? String(p?.threadId) === threadId
        : String(p?.communityId) === threadId;
      if (!belongsHere) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(p._id) || String(m._id) === String(p?.messageId)
            ? { ...m, isDeleted: true, status: "deleted", content: "" }
            : m
        )
      );
    };

    // Listen to both DM and community events
    socket.on?.("dm:message", onNew);
    socket.on?.("receive_message", onNew);
    socket.on?.("message:updated", onEdited);
    socket.on?.("message:deleted", onDeleted);

    return () => {
      socket.off?.("dm:message", onNew);
      socket.off?.("receive_message", onNew);
      socket.off?.("message:updated", onEdited);
      socket.off?.("message:deleted", onDeleted);
    };
  }, [socket, threadId, isDirectMessage, upsertManySorted, scrollToEnd]);

  /* ─────────── Row ─────────── */
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

      {/* Header */}
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>
            {headerTitle}
          </Text>

          {/* Placeholder for future actions */}
          <View style={{ width: 36 }} />
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

      {/* Composer */}
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
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
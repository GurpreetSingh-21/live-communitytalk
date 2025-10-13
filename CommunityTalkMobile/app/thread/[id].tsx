//CommunityTalkMobile/app/thread/[id].tsx
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
  Animated,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

type ChatMessage = {
  _id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: string | Date;
  communityId: string;
  status?: "sent" | "edited" | "deleted";
  isDeleted?: boolean;
  clientMessageId?: string;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
  return Math.abs(asDate(cur.timestamp).getTime() - asDate(prev.timestamp).getTime()) > 15 * 60 * 1000;
};

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

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = String(id || "");
  const { isDark, colors } = useTheme();
  const { socket } = useSocket();
  const { user } = React.useContext(AuthContext) as any;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const fetchingMoreRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null); // ✅ ADDED

  const headerTitle = useMemo(() => "Thread", []);

  /* initial */
  const fetchInitial = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/messages/${communityId}?limit=50`);
      const items: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages(items);
      setHasMore(items.length >= 50);
      
      // ✅ FIX: Auto-scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  /* older */
  const fetchOlder = useCallback(async () => {
    if (!communityId || fetchingMoreRef.current || !hasMore || !messages.length) return;
    try {
      fetchingMoreRef.current = true;
      const oldest = messages[0];
      const before = encodeURIComponent(asDate(oldest.timestamp).toISOString());
      const { data } = await api.get(`/api/messages/${communityId}?limit=50&before=${before}`);
      const older: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length >= 50);
    } finally {
      fetchingMoreRef.current = false;
    }
  }, [communityId, hasMore, messages]);

  /* ✅ FIXED: send - keeps keyboard open */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !communityId) return;

    // ✅ Clear input immediately and keep focus
    setInput("");
    setInputHeight(44);

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

    // ✅ FIX: Scroll to bottom after adding message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const { data } = await api.post(`/api/messages`, { 
        content: text, 
        communityId, 
        clientMessageId 
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
          timestamp: data.timestamp || next[idx].timestamp 
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
      setError(e?.response?.data?.error || "Failed to send");
    } finally {
      setSending(false);
      // ✅ FIX: Re-focus input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [input, sending, communityId, user?._id, user?.fullName]);

  /* realtime */
  useEffect(() => {
    if (!socket || !communityId) return;
    
    const onNew = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      if (payload?.clientMessageId) {
        setMessages((prev) => {
          const i = prev.findIndex(
            (m) => m.clientMessageId === payload.clientMessageId || m._id === payload.clientMessageId
          );
          if (i === -1) {
            // ✅ FIX: Scroll to bottom when new message arrives
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return [...prev, payload];
          }
          const next = [...prev];
          next[i] = { ...next[i], ...payload, _id: String(payload._id) };
          return next;
        });
      } else {
        setMessages((prev) => {
          // ✅ FIX: Scroll to bottom when new message arrives
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          return [...prev, payload];
        });
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
  }, [socket, communityId]);

  /* render row with date dividers + modern bubbles */
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
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{dayLabel(cur)}</Text>
            </View>
          </View>
        )}
        <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: isLastOfGroup ? 12 : 2 }}>
          {!mine && isFirstOfGroup && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4, marginLeft: 12, fontWeight: "500" }}>
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
                  <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 22 }}>{item.content}</Text>
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
                  <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22 }}>{item.content}</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };
  
  const keyExtractor = (m: ChatMessage) => String(m._id);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
      style={{ backgroundColor: colors.bg }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Modern header with blur effect */}
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
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }}>
              {headerTitle}
            </Text>
          </View>
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
            contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
          />
        )}
      </View>

      {/* ✅ IMPROVED: Modern Composer that keeps keyboard open */}
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
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Message"
            placeholderTextColor={colors.textSecondary}
            style={{
              color: colors.text,
              fontSize: 17,
              flex: 1,
              minHeight: 36,
              maxHeight: 100,
              height: Math.max(36, inputHeight),
              paddingVertical: 8,
              textAlignVertical: "top",
            }}
            onContentSizeChange={(e) => {
              const h = e.nativeEvent.contentSize.height;
              setInputHeight(Math.min(100, Math.max(36, h)));
            }}
            editable={!sending}
            multiline
            blurOnSubmit={false}
            onSubmitEditing={(e) => {
              if (!e.nativeEvent.text.includes('\n')) {
                sendMessage();
              }
            }}
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
//CommunityTalkMobile/app/community/[id].tsx

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
  ActionSheetIOS,
  LayoutAnimation,
  UIManager,
  Keyboard,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

/* Enable LayoutAnimation on Android */
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ───────── Theme ───────── */
const useTheme = () => {
  const isDark = useColorScheme() === "dark";
  return {
    isDark,
    colors: {
      bg: isDark ? "#000000" : "#FFFFFF",
      bgSecondary: isDark ? "#1C1C1E" : "#F2F2F7",
      surface: isDark ? "#1C1C1E" : "#FFFFFF",
      surfaceElevated: isDark ? "#2C2C2E" : "#FFFFFF",
      text: isDark ? "#FFFFFF" : "#000000",
      textSecondary: isDark ? "#EBEBF599" : "#3C3C4399",
      textTertiary: isDark ? "#EBEBF54D" : "#3C3C434D",
      border: isDark ? "#38383A" : "#E5E5EA",
      primary: "#007AFF",
      primaryGradientStart: "#5E5CE6",
      primaryGradientEnd: "#007AFF",
      destructive: "#FF3B30",
      success: "#34C759",
      warning: "#FF9500",
      onlineBg: isDark ? "rgba(52, 199, 89, 0.2)" : "#D1FAE5",
      onlineText: isDark ? "#34C759" : "#059669",
      offlineBg: isDark ? "rgba(142, 142, 147, 0.2)" : "#F3F4F6",
      offlineText: isDark ? "#8E8E93" : "#6B7280",
      inputBg: isDark ? "#1C1C1E" : "#F2F2F7",
      shadow: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.08)",
    },
  };
};

const RADIUS = 16;
const SCREEN_W = Dimensions.get("window").width;

/* ───────── Types ───────── */
type Community = {
  _id: string;
  name: string;
  description?: string;
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
  content: string;
  timestamp: string | Date;
  communityId: string;
  status?: "sent" | "edited" | "deleted";
  isDeleted?: boolean;
  clientMessageId?: string;
};

const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today / Yesterday / Tue, Oct 7, 2025" */
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
const showGap15min = (prev?: ChatMessage, cur?: ChatMessage) => {
  if (!prev || !cur) return true;
  const gap = Math.abs(asDate(cur.timestamp).getTime() - asDate(prev.timestamp).getTime());
  return gap > 15 * 60 * 1000;
};

/* Avatars */
const initials = (name?: string, fallback?: string) => {
  const base = (name || fallback || "").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : "");
  return (s || "U").toUpperCase();
};
const hueFrom = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% ${45}%)`;
};

/* ───────── Screen ───────── */
export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = String(id || "");
  const { isDark, colors } = useTheme();
  const { user } = React.useContext(AuthContext) as any;
  const { socket, socketConnected } = useSocket() as any;

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // ✅ FIX: Add ref for TextInput to maintain focus
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  /* membership */
  const isMember = useMemo(() => {
    const ids: string[] = Array.isArray(user?.communityIds) ? user.communityIds.map(String) : [];
    return ids.includes(communityId);
  }, [user?.communityIds, communityId]);

  /* load community */
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

  /* Members */
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
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
        if (filter !== "all") params.push(`status=${filter}`);
        if (nextCursor) params.push(`cursor=${nextCursor}`);
        const qs = params.length ? `?${params.join("&")}` : "";
        const { data } = await api.get(`/api/members/${communityId}${qs}`);
        const list: MemberRow[] = Array.isArray(data?.items) ? data.items : [];
        setMembers((prev) => (reset || !nextCursor ? list : [...prev, ...list]));
        setCursor(data?.nextCursor || null);
        setHasMore(Boolean(data?.hasMore));
      } catch {
      } finally {
        fetchingRef.current = false;
      }
    },
    [isMember, communityId, q, filter]
  );

  useEffect(() => {
    if (!isMember) {
      setMembers([]);
      setCursor(null);
      setHasMore(true);
      return;
    }
    fetchMembers({ reset: true });
  }, [isMember, communityId, q, filter, fetchMembers]);

  const refreshMembers = useCallback(async () => {
    if (!isMember) return;
    setRefreshing(true);
    await fetchMembers({ reset: true });
    setRefreshing(false);
  }, [isMember, fetchMembers]);

  const loadMoreMembers = () => {
    if (isMember && hasMore && !fetchingRef.current) fetchMembers({ useCursor: cursor ?? null });
  };

  /* Listen for status updates via socket */
  useEffect(() => {
    if (!socket || !isMember || !communityId) return;

    const onStatusUpdate = (payload: any) => {
      if (payload?.userId && payload?.status) {
        setMembers((prev) =>
          prev.map((m) =>
            String(m.person) === String(payload.userId) ? { ...m, status: payload.status } : m
          )
        );
      }
    };

    socket.on?.("presence:update", onStatusUpdate);
    return () => {
      socket.off?.("presence:update", onStatusUpdate);
    };
  }, [socket, isMember, communityId]);

  /* Chat */
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
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
      
      // ✅ FIX: Auto-scroll to bottom after loading messages
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
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
    } finally {
      fetchingMoreChatRef.current = false;
    }
  }, [communityId, chatHasMore, messages]);

  // ✅ FIX: Improved send function that keeps keyboard open
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !communityId) return;

    // ✅ Clear input immediately and keep focus
    setInput("");
    setInputHeight(44);
    
    setSending(true);
    setChatError(null);
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
      // ✅ FIX: Re-focus input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [input, sending, communityId, user?._id, user?.fullName]);

  /* Realtime */
  useEffect(() => {
    if (!socket || !communityId || !isMember) return;

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
  }, [socket, communityId, isMember, socketConnected]);

  /* Join / Leave */
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

  const confirmLeave = () =>
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

  /* Pager */
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

  /* Get online member count */
  const onlineCount = useMemo(() => {
    return members.filter((m) => m.status === "online").length;
  }, [members]);

  /* Custom header */
  const AppHeader = () => (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: Platform.OS === "ios" ? 60 : 16,
        paddingBottom: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }} numberOfLines={1}>
            {community?.name || "Community"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
              {members.length ? `${members.length} members` : "—"}
            </Text>
            {isMember && onlineCount > 0 && (
              <>
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: colors.textTertiary,
                    marginHorizontal: 8,
                  }}
                />
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.success,
                      marginRight: 6,
                    }}
                  />
                  <Text style={{ color: colors.success, fontSize: 15, fontWeight: "600" }}>
                    {onlineCount} online
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
        {isMember ? (
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === "ios") {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: ["Cancel", "View Members", "Leave Community"],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: 2,
                    userInterfaceStyle: isDark ? "dark" : "light",
                  },
                  (i) => {
                    if (i === 1) goTo(1);
                    if (i === 2) confirmLeave();
                  }
                );
              } else {
                Alert.alert("Community", undefined, [
                  { text: "View Members", onPress: () => goTo(1) },
                  { text: "Leave Community", style: "destructive", onPress: confirmLeave },
                  { text: "Cancel", style: "cancel" },
                ]);
              }
            }}
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
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Modern segmented control */}
      {isMember ? (
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            borderRadius: 12,
            padding: 3,
            backgroundColor: colors.bgSecondary,
          }}
        >
          {["Chat", "Members"].map((label, i) => {
            const active = page === i;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => goTo(i)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  paddingVertical: 10,
                  backgroundColor: active ? colors.surfaceElevated : "transparent",
                  shadowColor: active ? colors.shadow : "transparent",
                  shadowOpacity: active ? 0.15 : 0,
                  shadowRadius: active ? 6 : 0,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text style={{ color: colors.text, fontWeight: active ? "700" : "600", fontSize: 15 }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TouchableOpacity
          disabled={busy}
          onPress={join}
          style={{
            marginTop: 16,
            borderRadius: 14,
            overflow: "hidden",
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 24,
              alignItems: "center",
            }}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17 }}>Join Community</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  /* Member Avatar */
  const Avatar = ({ name, email }: { name?: string; email?: string }) => {
    const label = initials(name, email);
    const bg = hueFrom(name || email || label);
    return (
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>{label}</Text>
      </View>
    );
  };

  const MemberRowCard = ({ item }: { item: MemberRow }) => {
    const isOnline = item.status === "online";
    return (
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          backgroundColor: colors.surfaceElevated,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View>
            <Avatar name={item.fullName} email={item.email} />
            {isOnline && (
              <View
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: colors.success,
                  borderWidth: 2.5,
                  borderColor: colors.surfaceElevated,
                }}
              />
            )}
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 17 }}>{item.fullName}</Text>
              {item.isYou && (
                <View
                  style={{
                    marginLeft: 8,
                    backgroundColor: colors.primary + "20",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>YOU</Text>
                </View>
              )}
            </View>
            {!!item.email && (
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }} numberOfLines={1}>
                {item.email}
              </Text>
            )}
          </View>

          <View
            style={{
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: isOnline ? colors.onlineBg : colors.offlineBg,
            }}
          >
            <Text
              style={{
                color: isOnline ? colors.onlineText : colors.offlineText,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.5,
              }}
            >
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const MemberFilters = () => (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.inputBg,
          borderRadius: 12,
          paddingHorizontal: 14,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
        }}
      >
        <Ionicons name="search" size={18} color={colors.textSecondary as any} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search members"
          placeholderTextColor={colors.textSecondary}
          style={{ color: colors.text, paddingVertical: 12, flex: 1, marginLeft: 10, fontSize: 17 }}
          returnKeyType="search"
          onSubmitEditing={() => fetchMembers({ reset: true })}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 12 }}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {(["all", "online", "offline"] as const).map((k) => {
          const active = filter === k;
          const count = k === "all" ? members.length : members.filter((m) => m.status === k).length;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setFilter(k)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
                backgroundColor: active ? colors.primary : colors.surface,
                shadowColor: active ? colors.primary : colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: active ? 0.3 : 0.05,
                shadowRadius: active ? 4 : 2,
              }}
            >
              <Text
                style={{
                  color: active ? "#FFFFFF" : colors.text,
                  fontWeight: "600",
                  fontSize: 15,
                }}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)} {count > 0 && `(${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  /* Chat bubbles */
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const myIds = [String(user?._id || ""), "me"];
    const mine = myIds.includes(String(item.senderId || ""));
    const prev = messages[index - 1];
    const next = messages[index + 1];

    const curDate = asDate(item.timestamp);
    const prevDate = prev ? asDate(prev.timestamp) : undefined;
    const showDateDivider = !prev || !prevDate || !isSameDay(curDate, prevDate);

    const isFirstOfGroup = !prev || prev.senderId !== item.senderId || showGap15min(prev, item);
    const isLastOfGroup = !next || next.senderId !== item.senderId || showGap15min(item, next);

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
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{dayLabel(curDate)}</Text>
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

  /* ───────── Render ───────── */
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
      style={{ backgroundColor: colors.bg }}
    >
      <Stack.Screen options={{ header: () => null }} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !community ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: colors.text, fontSize: 16, textAlign: "center" }}>Community not found.</Text>
        </View>
      ) : (
        <>
          <AppHeader />

          {!isMember ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
              <View
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: 16,
                  padding: 20,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                }}
              >
                <View style={{ alignItems: "center", marginBottom: 12 }}>
                  <Ionicons name="lock-closed-outline" size={40} color={colors.textSecondary} />
                </View>
                <Text style={{ color: colors.text, fontSize: 17, textAlign: "center", fontWeight: "600" }}>
                  Members Only
                </Text>
                <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
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
              scrollEnabled={true}
            >
              {/* CHAT */}
              <View style={{ width: SCREEN_W, flex: 1 }}>
                {!!chatError && (
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
                    <Text style={{ color: colors.destructive, fontSize: 14, fontWeight: "500" }}>{chatError}</Text>
                  </View>
                )}

                <View style={{ flex: 1, marginTop: 8 }}>
                  {chatLoading ? (
                    <View className="flex-1 items-center justify-center">
                      <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                  ) : (
                    <FlatList
                      ref={flatListRef}
                      data={messages}
                      keyExtractor={(m) => String(m._id)}
                      renderItem={renderMessage}
                      ListHeaderComponent={
                        chatHasMore ? (
                          <TouchableOpacity
                            onPress={fetchOlderChat}
                            disabled={fetchingMoreChatRef.current}
                            style={{ paddingVertical: 16, alignItems: "center" }}
                          >
                            {fetchingMoreChatRef.current ? (
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
                      contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
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
                          <Ionicons name="arrow-up" size={20} color="#fff" />
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* MEMBERS */}
              <View style={{ width: SCREEN_W }}>
                <MemberFilters />
                <FlatList
                  data={members}
                  keyExtractor={(m) => String(m._id)}
                  renderItem={({ item }) => <MemberRowCard item={item} />}
                  onEndReachedThreshold={0.3}
                  onEndReached={loadMoreMembers}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={refreshMembers} tintColor={colors.primary} />
                  }
                  ListEmptyComponent={
                    !fetchingRef.current ? (
                      <View style={{ paddingVertical: 40, alignItems: "center" }}>
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: colors.surface,
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 12,
                          }}
                        >
                          <Ionicons name="people-outline" size={32} color={colors.textSecondary} />
                        </View>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>No members found</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 4 }}>
                          Try adjusting your filters
                        </Text>
                      </View>
                    ) : null
                  }
                  ListFooterComponent={
                    hasMore && members.length > 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: "center" }}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : members.length > 0 ? (
                      <View style={{ paddingVertical: 20, alignItems: "center" }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                          • • •
                        </Text>
                      </View>
                    ) : null
                  }
                  contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </ScrollView>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}
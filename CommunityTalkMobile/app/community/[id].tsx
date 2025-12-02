// CommunityTalkMobile/app/community/[id].tsx
// UPGRADED WITH DISCORD-STYLE AVATARS AND USER PROFILES

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
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";
import UserProfileModal from "@/components/UserProfileModal";

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
  status?: "sent" | "delivered" | "read" | "edited" | "deleted";
  isDeleted?: boolean;
  deliveredAt?: string | Date;
  readAt?: string | Date;
  clientMessageId?: string;
};

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
  return `hsl(${h} 70% 45%)`;
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

  // User profile modal state
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
    email?: string;
    status?: "online" | "offline";
  } | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const isMember = useMemo(() => {
    const ids: string[] = Array.isArray(user?.communityIds) ? user.communityIds.map(String) : [];
    return ids.includes(communityId);
  }, [user?.communityIds, communityId]);

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

  const chatListRef = useRef<FlatList<ChatMessage>>(null);
  const contentHeightRef = useRef(0);
  const prevContentHeightRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const initialLoadedRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const AUTO_SCROLL_THRESHOLD = 120;

  type TypingEntry = { id: string; name: string; expiresAt: number };
  const [typingMap, setTypingMap] = useState<Map<string, TypingEntry>>(new Map());

  const nameForId = useCallback(
    (uid: string) => members.find(m => String(m.person) === String(uid))?.fullName || "Someone",
    [members]
  );

  const typingLabel = useMemo(() => {
    const entries = Array.from(typingMap.values()).filter(e => e.expiresAt > Date.now());
    console.log(`🏷️ [TYPING LABEL] Active entries: ${entries.length}`, entries.map(e => e.name));
    if (!entries.length) return "";
    const names = entries.map(e => e.name).slice(0, 2);
    if (entries.length === 1) return `${names[0]} is typing…`;
    if (entries.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${entries.length - 1} others are typing…`;
  }, [typingMap]);

  const typingPingRef = useRef<{ lastSent: number; timer?: any }>({ lastSent: 0 });

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      chatListRef.current?.scrollToEnd({ animated });
      isAtBottomRef.current = true;
    });
  }, []);

  const handleChatScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isAtBottomRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD;
  };

  const handleChatContentSizeChange = (_w: number, h: number) => {
    if (loadingOlderRef.current) {
      const delta = h - prevContentHeightRef.current;
      if (delta > 0) {
        chatListRef.current?.scrollToOffset({
          offset: delta,
          animated: false,
        });
      }
      loadingOlderRef.current = false;
    } else if (!initialLoadedRef.current && !chatLoading) {
      initialLoadedRef.current = true;
      scrollToBottom(false);
    } else if (isAtBottomRef.current) {
      scrollToBottom(true);
    }
    contentHeightRef.current = h;
  };

  const fetchInitialChat = useCallback(async () => {
    if (!communityId || !isMember) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const { data } = await api.get(`/api/messages/${communityId}?limit=50`);
      const items: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages(items);
      setChatHasMore(items.length >= 50);
      initialLoadedRef.current = false;
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
      loadingOlderRef.current = true;
      prevContentHeightRef.current = contentHeightRef.current;

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !communityId) return;
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
    setInput("");
    setInputHeight(44);
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const { data } = await api.post(`/api/messages`, { content: text, communityId, clientMessageId });
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
  }, [input, sending, communityId, user?._id, user?.fullName, scrollToBottom]);

  useEffect(() => {
    if (!socket || !communityId || !isMember) return;
    console.log("🔵 [ROOM] Joining community room:", communityId);
    socket.emit?.("community:join", communityId);

    const onNew = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        // Send delivery receipt for messages from others
        const myIds = [String(user?._id || ""), "me"];
        if (!myIds.includes(String(payload.senderId || ""))) {
          setTimeout(() => {
            socket.emit?.("message:delivered", { messageId: payload._id });
          }, 100);
        }
      }
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
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

    // Listen for delivery and read status updates
    const onStatusUpdate = (p: any) => {
      if (p?.messageId) {
        setMessages((prev) => 
          prev.map((m) => 
            String(m._id) === String(p.messageId) 
              ? { ...m, status: p.status, deliveredAt: p.deliveredAt, readAt: p.readAt }
              : m
          )
        );
      }
    };

    socket.on?.("receive_message", onNew);
    socket.on?.("message:updated", onEdited);
    socket.on?.("message:deleted", onDeleted);
    socket.on?.("message:status", onStatusUpdate);

    return () => {
      socket.off?.("receive_message", onNew);
      socket.off?.("message:updated", onEdited);
      socket.off?.("message:deleted", onDeleted);
      socket.off?.("message:status", onStatusUpdate);
      console.log("🔴 [ROOM] Leaving community room:", communityId);
      socket.emit?.("community:leave", communityId);
    };
  }, [socket, communityId, isMember, socketConnected, scrollToBottom, user?._id]);

  useEffect(() => {
    if (!socket || !communityId || !isMember) return;

    const onTyping = (p: any) => {
      console.log("📨 [TYPING] Received typing event:", p);
      if (String(p?.communityId) !== String(communityId)) return;
      const from = String(p?.from || p?.userId || "");
      if (!from || String(from) === String(user?._id)) {
        console.log("⚠️ [TYPING] Ignoring - either no sender or it's me");
        return;
      }
      const typing = !!p?.isTyping;  // Changed from p?.typing to p?.isTyping
      console.log(`✅ [TYPING] Processing: ${typing ? 'START' : 'STOP'} typing from user ${from}`);

      setTypingMap(prev => {
        const next = new Map(prev);
        if (typing) {
          const label = (p?.fullName as string) || (p?.name as string) || nameForId(from);
          console.log(`👤 [TYPING] Adding "${label}" to typing map`);
          next.set(from, { id: from, name: label, expiresAt: Date.now() + 6000 });
        } else {
          console.log(`👤 [TYPING] Removing user ${from} from typing map`);
          next.delete(from);
        }
        console.log(`📊 [TYPING] Total typing users: ${next.size}`);
        return next;
      });
    };

    socket.on?.("user:typing", onTyping);  // Backend emits this
    socket.on?.("typing", onTyping);        // Legacy support
    socket.on?.("community:typing", onTyping); // Legacy support

    const gc = setInterval(() => {
      const now = Date.now();
      let changed = false;
      setTypingMap(prev => {
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (v.expiresAt <= now) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      socket.off?.("user:typing", onTyping);
      socket.off?.("typing", onTyping);
      socket.off?.("community:typing", onTyping);
      clearInterval(gc);
      clearTimeout(typingPingRef.current.timer);
    };
  }, [socket, communityId, isMember, user?._id, nameForId]);

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

  const onlineCount = useMemo(() => {
    return members.filter((m) => m.status === "online").length;
  }, [members]);

  // NEW: Handle avatar press - find member and show modal
  const handleAvatarPress = useCallback((senderId: string, senderName: string) => {
    const member = members.find(m => String(m.person) === String(senderId));
    
    setSelectedUser({
      id: senderId,
      name: senderName,
      email: member?.email,
      status: member?.status || "offline",
    });
    setShowUserModal(true);
  }, [members]);

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

  const Avatar = ({ 
    name, 
    email, 
    avatar,
    size = 48 
  }: { 
    name?: string; 
    email?: string; 
    avatar?: string | null;
    size?: number 
  }) => {
    const label = initials(name, email);
    const bg = hueFrom(name || email || label);
    
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          overflow: 'hidden', // ✅ Important for image clipping
        }}
      >
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
            }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.375 }}>
            {label}
          </Text>
        )}
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
            <Avatar 
              name={item.fullName} 
              email={item.email} 
              avatar={item.avatar} // ✅ Pass avatar
            />
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

  // NEW: Discord-style message bubbles with avatars
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
  
    // Find member info for avatar status AND avatar URL
    const memberInfo = members.find(m => String(m.person) === String(item.senderId));
  
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
  
        {/* Discord-style: Show avatar on left for others, gradient bubble on right for self */}
        {!mine ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: isLastOfGroup ? 12 : 2 }}>
            {/* Avatar (only show on first message of group) */}
            <View style={{ width: 40, marginRight: 12, alignItems: "center" }}>
              {isFirstOfGroup ? (
                <TouchableOpacity
                  onPress={() => handleAvatarPress(item.senderId, item.sender)}
                  activeOpacity={0.7}
                >
                  <View style={{ position: "relative" }}>
                    <Avatar 
                      name={item.sender} 
                      avatar={memberInfo?.avatar} // ✅ Pass avatar URL
                      size={40} 
                    />
                    {/* Online indicator */}
                    {memberInfo?.status === "online" && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: colors.success,
                          borderWidth: 3,
                          borderColor: colors.bg,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
  
            {/* Message content */}
            <View style={{ flex: 1, maxWidth: "75%" }}>
              {isFirstOfGroup && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4, fontWeight: "600" }}>
                  {item.sender}
                </Text>
              )}
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
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "flex-end", marginBottom: isLastOfGroup ? 12 : 2 }}>
            <View style={{ maxWidth: "75%" }}>
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
              {/* Delivery status indicators */}
              {!deleted && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 6, marginRight: 4 }}>
                  <Text style={{ 
                    color: item.status === "read" ? colors.primary : colors.textTertiary, 
                    fontSize: 14,
                    fontWeight: "600",
                    marginRight: 4
                  }}>
                    {(item.status === "read" || item.status === "delivered") && "✓✓"}
                    {(!item.status || item.status === "sent") && "✓"}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ backgroundColor: colors.bg }}
    >
      <Stack.Screen options={{ header: () => null }} />

      {/* User Profile Modal */}
      <UserProfileModal
        visible={showUserModal}
        onClose={() => setShowUserModal(false)}
        user={selectedUser}
        isDark={isDark}
        colors={colors}
        currentUserId={user?._id}
      />

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
                      ref={chatListRef}
                      data={messages}
                      keyExtractor={(m) => String(m._id)}
                      renderItem={renderMessage}
                      onContentSizeChange={handleChatContentSizeChange}
                      onScroll={handleChatScroll}
                      scrollEventThrottle={16}
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
                    />
                  )}
                </View>

                {typingLabel ? (
                  <View style={{ paddingHorizontal: 16, marginTop: 6 }}>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        backgroundColor: isDark ? "rgba(52, 199, 89, 0.15)" : "#E8F8EF",
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: isDark ? "#34C759" : "#0F8C4C", fontSize: 13, fontWeight: "600" }}>
                        {typingLabel}
                      </Text>
                    </View>
                  </View>
                ) : null}

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
                      onChangeText={(t) => {
                        setInput(t);

                        if (socket && communityId) {
                          const now = Date.now();
                          if (now - (typingPingRef.current.lastSent || 0) > 2000) {
                            typingPingRef.current.lastSent = now;
                            console.log("🟢 [TYPING] Emitting community:typing=true for community:", communityId);
                            socket.emit?.("community:typing", { communityId, isTyping: true });
                          }
                          clearTimeout(typingPingRef.current.timer);
                          typingPingRef.current.timer = setTimeout(() => {
                            console.log("🔴 [TYPING] Emitting community:typing=false for community:", communityId);
                            socket.emit?.("community:typing", { communityId, isTyping: false });
                          }, 5000);
                        }
                      }}
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
// CommunityTalkMobile/app/community/[id].tsx


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
  LayoutAnimation,
  Keyboard,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  Linking,
  Animated,
  Clipboard,
  Modal,
  Pressable,
} from "react-native";
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from 'expo-image-picker';
import { Swipeable } from 'react-native-gesture-handler';
import MessageActionSheet from '../../components/MessageActionSheet';
import ImageViewerModal from '../../components/ImageViewerModal';

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";
import UserProfileModal from "@/components/UserProfileModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

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
  reactions?: Array<{
    emoji: string;
    userId: string;
    userName: string;
    createdAt: Date;
  }>;
  type?: "text" | "photo" | "video" | "file";
  fileName?: string;
  replyTo?: {
    messageId: string;
    sender: string;
    content: string;
  };
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

const showGap5min = (prev?: ChatMessage, cur?: ChatMessage) => {
  if (!prev || !cur) return true;
  const gap = Math.abs(asDate(cur.timestamp).getTime() - asDate(prev.timestamp).getTime());
  return gap > 5 * 60 * 1000; // 5 minutes
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
  const insets = useSafeAreaInsets();

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

  // Bottom sheet modal state
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);

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
  const [inputHeight, setInputHeight] = useState(40);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const attachmentMenuAnim = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Refs for Swipeable components to close them programmatically
  const swipeableRefs = useRef<Map<string, any>>(new Map());

  // New UI State
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHasMore, setChatHasMore] = useState(true);
  const fetchingMoreChatRef = useRef(false);

  const chatListRef = useRef<FlatList<ChatMessage>>(null);
  const contentHeightRef = useRef(0);
  const prevContentHeightRef = useRef(0);
  const inputRef = useRef<TextInput>(null); // Added for reply focus

  // Emoji reactions state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
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

  // Keyboard visibility listener
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Auto-focus input when replying to a message
  useEffect(() => {
    if (replyingTo) {
      // Wait for UI to update, then focus
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        // Scroll to bottom to ensure input is visible
        setTimeout(() => {
          chatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [replyingTo]);

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
    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    let replyToData = undefined;
    if (replyingTo) {
      console.log('📩 [REPLY] Sending reply to message:', replyingTo);
      const replyContent = replyingTo.content || (replyingTo.type === 'photo' ? '📷 Photo' : replyingTo.type === 'video' ? '🎥 Video' : 'Message');
      replyToData = {
        messageId: String(replyingTo._id),
        sender: replyingTo.sender || 'Unknown',
        content: replyContent.substring(0, 100), // Truncate for preview
      };
      console.log('📩 [REPLY] Reply data:', replyToData);
    }

    const optimistic: ChatMessage = {
      _id: clientMessageId,
      clientMessageId,
      sender: user?.fullName || "You",
      senderId: String(user?._id || "me"),
      content: text,
      timestamp: new Date(),
      communityId,
      status: "sent",
      replyTo: replyToData,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setInputHeight(40); // Reset to default height
    setReplyingTo(null); // Clear reply state
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const { data } = await api.post(`/api/messages`, { 
        content: text,
        communityId,
        clientMessageId,
        replyTo: replyToData 
      });
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.clientMessageId === clientMessageId || m._id === clientMessageId);
        if (idx === -1) return prev;
        const next = [...prev];
        const serverReplyTo = (data.replyTo !== undefined && data.replyTo !== null) ? data.replyTo : next[idx].replyTo;
        console.log('📩 [REPLY] Server response - replyTo:', serverReplyTo);
        next[idx] = {
          ...next[idx],
          ...data,
          _id: String(data._id),
          timestamp: data.timestamp || next[idx].timestamp,
          clientMessageId: data.clientMessageId ?? next[idx].clientMessageId,
          // CRITICAL: Only use server's replyTo if it exists, otherwise keep optimistic value
          replyTo: serverReplyTo,
        };
        console.log('📩 [REPLY] Updated message with replyTo:', next[idx].replyTo);
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
  }, [input, sending, communityId, user?._id, user?.fullName, scrollToBottom, replyingTo]);

  // Media upload handlers
  const uploadAndSend = useCallback(async (
    fileUri: string,
    fileType: string,
    fileName: string,
    msgType: "photo" | "video" | "file"
  ) => {
    if (!communityId || sending) return;
    setSending(true);
    setChatError(null);
    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Optimistic Update
    const optimistic: ChatMessage = {
      _id: clientMessageId,
      clientMessageId,
      sender: user?.fullName || "You",
      senderId: String(user?._id || "me"),
      content: fileUri, // Show local URI temporarily
      timestamp: new Date(),
      communityId,
      type: msgType,
      fileName: fileName,
      status: "sent",
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const formData = new FormData();
      // React Native FormData requires specific structure for file uploads
      const fileToUpload: any = {
        uri: fileUri,
        type: fileType,
        name: fileName,
      };

      console.log('📤 [UPLOAD] Preparing file:', { uri: fileUri, type: fileType, name: fileName });
      formData.append('file', fileToUpload);

      console.log('📤 [UPLOAD] Sending to /api/upload...');
      const uploadRes = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('✅ [UPLOAD] Success:', uploadRes.data);
      const secureUrl = uploadRes.data?.url || fileUri;

      const payload = {
        content: secureUrl,
        communityId,
        type: msgType,
        clientMessageId,
        attachments: [{ url: secureUrl, type: msgType, name: fileName }]
      };

      const { data } = await api.post(`/api/messages`, payload);

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.clientMessageId === clientMessageId || m._id === clientMessageId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...data,
          _id: String(data._id),
          content: secureUrl,
          timestamp: data.timestamp || next[idx].timestamp,
        };
        return next;
      });
    } catch (err) {
      console.error("Upload failed", err);
      Alert.alert("Upload Failed", "Could not send file.");
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: "deleted", content: "[failed to send]" }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [communityId, sending, user?._id, user?.fullName, scrollToBottom]);

  const handlePickMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'photo';
      const mime = asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg');
      const name = asset.fileName || `media_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;

      uploadAndSend(asset.uri, mime, name, type);
    }
  }, [uploadAndSend]);

  const handlePickPhoto = useCallback(async () => {
    // Close menu with animation
    attachmentMenuAnim.setValue(0);
    setShowAttachmentMenu(false);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      uploadAndSend(asset.uri, mime, name, 'photo');
    }
  }, [uploadAndSend, attachmentMenuAnim]);

  const handlePickVideo = useCallback(async () => {
    // Close menu with animation
    attachmentMenuAnim.setValue(0);
    setShowAttachmentMenu(false);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const mime = asset.mimeType || 'video/mp4';
      const name = asset.fileName || `video_${Date.now()}.mp4`;
      uploadAndSend(asset.uri, mime, name, 'video');
    }
  }, [uploadAndSend, attachmentMenuAnim]);

  const showAttachmentOptions = useCallback(() => {
    setShowAttachmentMenu(prev => {
      const newValue = !prev;
      if (newValue) {
        // Slide up animation when opening
        Animated.spring(attachmentMenuAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      } else {
        // Reset animation when closing
        attachmentMenuAnim.setValue(0);
      }
      return newValue;
    });
  }, [attachmentMenuAnim]);

  // Emoji reaction functions
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await api.post(`/api/messages/${messageId}/reactions`, { emoji });
      // Don't do optimistic update - let socket event handle it
    } catch (err) {
      console.error('Add reaction error:', err);
    }
  }, []);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await api.delete(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      // Don't do optimistic update - let socket event handle it
    } catch (err) {
      console.error('Remove reaction error:', err);
    }
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    const msg = messages.find(m => m._id === messageId);
    const hasReacted = msg?.reactions?.some(r => String(r.userId) === String(user?._id) && r.emoji === emoji);

    if (hasReacted) {
      removeReaction(messageId, emoji);
    } else {
      addReaction(messageId, emoji);
    }
    setShowEmojiPicker(false);
  }, [messages, user?._id, addReaction, removeReaction]);




  useEffect(() => {
    console.log("🔍 [ROOM DEBUG] useEffect triggered - socket:", !!socket, "communityId:", communityId, "isMember:", isMember);
    if (!socket || !communityId || !isMember) {
      console.log("⚠️ [ROOM DEBUG] Skipping join - socket:", !!socket, "communityId:", !!communityId, "isMember:", isMember);
      return;
    }
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
          next[i] = { 
            ...next[i], 
            ...payload, 
            _id: String(payload._id),
            // CRITICAL: Only use socket's replyTo if it exists, otherwise keep optimistic value
            replyTo: (payload.replyTo !== undefined && payload.replyTo !== null) ? payload.replyTo : next[i].replyTo,
          };
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

    const onReacted = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      setMessages(prev => prev.map(m =>
        String(m._id) === String(payload._id)
          ? { ...m, reactions: payload.reactions }
          : m
      ));
    };

    socket.on?.("receive_message", onNew);
    socket.on?.("message:updated", onEdited);
    socket.on?.("message:deleted", onDeleted);
    socket.on?.("message:status", onStatusUpdate);
    socket.on?.("message:reacted", onReacted);

    return () => {
      socket.off?.("receive_message", onNew);
      socket.off?.("message:updated", onEdited);
      socket.off?.("message:deleted", onDeleted);
      socket.off?.("message:status", onStatusUpdate);
      socket.off?.("message:reacted", onReacted);
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
    <LinearGradient
      colors={isDark 
        ? ['rgba(0, 0, 0, 0.95)', 'rgba(20, 20, 30, 0.98)'] 
        : ['rgba(255, 255, 255, 0.98)', 'rgba(250, 250, 255, 0.95)']}
      style={{
        paddingHorizontal: 20,
        paddingTop: Platform.OS === "ios" ? 60 : 16,
        paddingBottom: 20,
        borderBottomWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text 
            style={{ 
              color: colors.text, 
              fontSize: 22, 
              fontWeight: "700", 
              letterSpacing: -0.3,
              marginBottom: 2,
            }} 
            numberOfLines={2}
          >
            {community?.name || "Community"}
          </Text>
          <Text style={{ 
            color: colors.textSecondary, 
            fontSize: 13, 
            marginTop: 2,
          }}>
              {members.length ? `${members.length} members` : "—"}
            {isMember && onlineCount > 0 && ` • ${onlineCount} online`}
                  </Text>
        </View>
        {isMember ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCommunityMenu(true);
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              borderWidth: isDark ? 0.5 : 0,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
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
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          }}
        >
          {["Chat", "Members"].map((label, i) => {
            const active = page === i;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  goTo(i);
                }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  paddingVertical: 8,
                  backgroundColor: active 
                    ? (isDark ? 'rgba(94, 92, 230, 0.2)' : 'rgba(94, 92, 230, 0.1)')
                    : "transparent",
                }}
              >
                <Text 
                  style={{ 
                    color: active ? colors.primary : colors.textSecondary, 
                    fontWeight: active ? "700" : "500", 
                    fontSize: 14,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TouchableOpacity
          disabled={busy}
          onPress={join}
          style={{
            marginTop: 20,
            borderRadius: 18,
            overflow: "hidden",
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: 16,
              paddingHorizontal: 28,
              alignItems: "center",
            }}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, letterSpacing: 0.5 }}>
                  Join Community
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </LinearGradient>
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
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.3)',
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
          <Text style={{ 
            color: "#fff", 
            fontWeight: "800", 
            fontSize: size * 0.375,
            textShadowColor: 'rgba(0, 0, 0, 0.3)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          }}>
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
          marginBottom: 14,
          backgroundColor: isDark 
            ? 'rgba(255, 255, 255, 0.05)' 
            : 'rgba(255, 255, 255, 0.9)',
          borderRadius: 20,
          paddingHorizontal: 18,
          paddingVertical: 16,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
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
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: isOnline 
                ? (isDark ? 'rgba(52, 199, 89, 0.2)' : 'rgba(52, 199, 89, 0.15)')
                : (isDark ? 'rgba(142, 142, 147, 0.15)' : 'rgba(107, 114, 128, 0.1)'),
              borderWidth: 1,
              borderColor: isOnline 
                ? (isDark ? 'rgba(52, 199, 89, 0.4)' : 'rgba(52, 199, 89, 0.3)')
                : (isDark ? 'rgba(142, 142, 147, 0.3)' : 'rgba(107, 114, 128, 0.2)'),
            }}
          >
            <Text
              style={{
                color: isOnline ? colors.onlineText : colors.offlineText,
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 0.8,
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
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: isDark 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(0, 0, 0, 0.04)',
          borderRadius: 16,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="search" size={20} color={colors.textSecondary as any} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search members"
          placeholderTextColor={colors.textSecondary}
          style={{ 
            color: colors.text, 
            paddingVertical: 14, 
            flex: 1, 
            marginLeft: 12, 
            fontSize: 17,
            fontWeight: '500',
          }}
          returnKeyType="search"
          onSubmitEditing={() => fetchMembers({ reset: true })}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14 }}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {(["all", "online", "offline"] as const).map((k) => {
          const active = filter === k;
          const count = k === "all" ? members.length : members.filter((m) => m.status === k).length;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(k);
              }}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 22,
                marginRight: 10,
                backgroundColor: active 
                  ? (isDark ? 'rgba(94, 92, 230, 0.3)' : 'rgba(94, 92, 230, 0.15)')
                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                borderWidth: active ? 0 : 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                shadowColor: active ? colors.primary : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: active ? 0.4 : 0.05,
                shadowRadius: active ? 8 : 2,
                elevation: active ? 6 : 2,
              }}
            >
              <Text
                style={{
                  color: active ? "#FFFFFF" : colors.text,
                  fontWeight: active ? "800" : "600",
                  fontSize: 15,
                  letterSpacing: active ? 0.3 : 0,
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers for New UI
  // ─────────────────────────────────────────────────────────────────────────────

  const handleLongPress = (message: ChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
  };

  const handleImagePress = (url: string) => {
    setViewingImage(url);
  };


  const handleReaction = async (emoji: string) => {
    if (!selectedMessage) return;
    const msgId = selectedMessage._id;

    try {
      const hasReaction = selectedMessage.reactions?.some(r => r.userId === user?._id && r.emoji === emoji);
      if (hasReaction) {
        await api.delete(`/api/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`);
      } else {
        await api.post(`/api/messages/${msgId}/reactions`, { emoji });
      }
      // Don't do optimistic update - let socket event handle it
    } catch (err) {
      console.error('Failed to update reaction:', err);
    }
  };

  const handleAction = async (action: 'reply' | 'copy' | 'delete' | 'forward') => {
    if (!selectedMessage) return;
    const msg = selectedMessage;

    switch (action) {
      case 'reply':
        setReplyingTo(msg);
        inputRef.current?.focus();
        break;

      case 'copy':
        if (msg.content) {
          Clipboard.setString(msg.content);
          Alert.alert('Copied', 'Message copied to clipboard');
        }
        break;

      case 'delete':
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  // Optimistic delete
                  setMessages(prev => prev.filter(m => m._id !== msg._id));
                  await api.delete(`/api/messages/${msg._id}`);
                } catch (err) {
                  console.error('Failed to delete message:', err);
                  Alert.alert('Error', 'Failed to delete message');
                  fetchInitialChat(); // Re-fetch to sync
                }
              }
            }
          ]
        );
        break;

      case 'forward':
        Alert.alert('Coming Soon', 'Forwarding is not yet implemented.');
        break;
    }
  };



  // Render swipe-to-reply action (Discord-style)
  const renderRightSwipeAction = (item: ChatMessage) => {
    // Visual indicator only - swipe action triggers reply
    return (
      <View
        style={{
          width: 70,
          justifyContent: "center",
          alignItems: "flex-start",
          paddingLeft: 10,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons name="arrow-undo-outline" size={22} color="#FFFFFF" />
        </View>
      </View>
    );
  };

  // NEW: Discord-style message bubbles with avatars
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const myIds = [String(user?._id || ""), "me"];
    const mine = myIds.includes(String(item.senderId || ""));
    const prev = messages[index - 1];
    const next = messages[index + 1];

    const curDate = asDate(item.timestamp);
    const prevDate = prev ? asDate(prev.timestamp) : undefined;
    const showDateDivider = !prev || !prevDate || !isSameDay(curDate, prevDate);

    const isFirstOfGroup = !prev || prev.senderId !== item.senderId || showGap5min(prev, item);
    const isLastOfGroup = !next || next.senderId !== item.senderId || showGap5min(item, next);

    const deleted = item.isDeleted || item.status === "deleted";

    // Find member info for avatar status AND avatar URL
    const memberInfo = members.find(m => String(m.person) === String(item.senderId));

    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 3 }}>
        {showDateDivider && (
          <View style={{ alignItems: "center", marginVertical: 20 }}>
            <View
              style={{
                backgroundColor: isDark 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.04)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>
                {dayLabel(curDate)}
              </Text>
            </View>
          </View>
        )}

        {/* Discord-style: Show avatar on left for others, gradient bubble on right for self */}
        <Swipeable
          ref={(ref) => {
            if (ref) {
              swipeableRefs.current.set(String(item._id), ref);
            } else {
              swipeableRefs.current.delete(String(item._id));
            }
          }}
          renderRightActions={() => renderRightSwipeAction(item)}
          onSwipeableWillOpen={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // Snap-to-reply: Set reply state
            setReplyingTo(item);
          }}
          onSwipeableOpen={() => {
            // Close the swipeable immediately after it opens
            const swipeableRef = swipeableRefs.current.get(String(item._id));
            swipeableRef?.close();
            // Focus is handled by useEffect when replyingTo changes
          }}
          overshootRight={false}
          friction={2}
        >
          {!mine ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: isFirstOfGroup ? 0 : 2, marginBottom: isLastOfGroup ? 8 : 0 }}>
            {/* Avatar (only show on first message of group) */}
            <View style={{ width: 36, marginRight: 8, alignItems: "center" }}>
              {isFirstOfGroup ? (
                <TouchableOpacity
                  onPress={() => handleAvatarPress(item.senderId, item.sender)}
                  activeOpacity={0.7}
                >
                  <View style={{ position: "relative" }}>
                    <Avatar
                      name={item.sender}
                      avatar={memberInfo?.avatar}
                      size={36}
                    />
                    {/* Online indicator */}
                    {memberInfo?.status === "online" && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: colors.success,
                          borderWidth: 2.5,
                          borderColor: colors.bg,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 36 }} />
              )}
            </View>

            {/* Message content */}
            <View style={{ flex: 1, maxWidth: "80%", position: 'relative' }}>
              {isFirstOfGroup && (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginRight: 6 }}>
                    {item.sender}
                  </Text>
                  {!isLastOfGroup && (
                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
                    {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  )}
                </View>
              )}
              
              {/* Reply Preview - Contained View */}
              {item.replyTo && (
                <View style={{
                  marginBottom: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)',
                  borderLeftWidth: 3,
                  borderLeftColor: colors.primary,
                }}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600', marginBottom: 3 }}>
                    {item.replyTo.sender}
                  </Text>
                  <Text 
                    style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)', fontSize: 12, lineHeight: 16 }} 
                    numberOfLines={2}
                  >
                    {item.replyTo.content}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                onLongPress={() => handleLongPress(item)}
                delayLongPress={300}
                activeOpacity={0.9}
                style={{ position: 'relative' }}
              >
                {deleted ? (
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F2F3F5',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderTopLeftRadius: isFirstOfGroup ? 12 : 4,
                      borderBottomLeftRadius: isLastOfGroup ? 12 : 4,
                      marginTop: isFirstOfGroup ? 0 : 0,
                    }}
                  >
                    <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: "italic" }}>
                      Message deleted
                    </Text>
                  </View>
                ) : item.type === 'photo' || (item.content?.match(/\.(jpeg|jpg|gif|png|webp)/i) && item.content?.includes('cloudinary.com')) ? (
                  <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleImagePress(item.content)}
                    onLongPress={() => handleLongPress(item)}
                      style={{ 
                        borderRadius: 12,
                        borderTopLeftRadius: isFirstOfGroup ? 12 : 4,
                        borderBottomLeftRadius: isLastOfGroup ? 12 : 4,
                        overflow: 'hidden',
                      }}
                  >
                    <Image
                      source={{ uri: item.content }}
                        style={{ width: 220, height: 220, backgroundColor: isDark ? '#1a1a1a' : '#E5E5EA' }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                    {/* Reactions overlapping bottom-right */}
                    {item.reactions && item.reactions.length > 0 && (
                      <View style={{ 
                        position: 'absolute', 
                        bottom: 8, 
                        right: 8, 
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        maxWidth: 180,
                        justifyContent: 'flex-end',
                      }}>
                        {Object.entries(
                          item.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.userName);
                            if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                            return acc;
                          }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                        ).map(([emoji, data]) => (
                          <TouchableOpacity
                            key={emoji}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              toggleReaction(item._id, emoji);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 6,
                              paddingVertical: 3,
                              borderRadius: 12,
                              backgroundColor: data.hasYou 
                                ? 'rgba(94, 92, 230, 0.9)' 
                                : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)'),
                              marginLeft: 4,
                              marginBottom: 4,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.3,
                              shadowRadius: 2,
                            }}
                          >
                            <Text style={{ fontSize: 12 }}>{emoji}</Text>
                            {data.count > 1 && (
                              <Text style={{ 
                                marginLeft: 3, 
                                fontSize: 10, 
                                color: data.hasYou ? '#fff' : colors.text, 
                                fontWeight: '600' 
                              }}>
                                {data.count}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : item.type === 'video' ? (
                  <View style={{ position: 'relative' }}>
                  <TouchableOpacity 
                    onPress={() => Linking.openURL(item.content)} 
                    style={{ 
                      width: 220, 
                      height: 150, 
                      borderRadius: 12, 
                        borderTopLeftRadius: isFirstOfGroup ? 12 : 4,
                        borderBottomLeftRadius: isLastOfGroup ? 12 : 4,
                      backgroundColor: '#000', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      }}
                    >
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="play" size={24} color="#fff" />
                      </View>
                  </TouchableOpacity>
                    {/* Reactions overlapping bottom-right */}
                    {item.reactions && item.reactions.length > 0 && (
                      <View style={{ 
                        position: 'absolute', 
                        bottom: 8, 
                        right: 8, 
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        maxWidth: 180,
                        justifyContent: 'flex-end',
                      }}>
                        {Object.entries(
                          item.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.userName);
                            if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                            return acc;
                          }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                        ).map(([emoji, data]) => (
                          <TouchableOpacity
                            key={emoji}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              toggleReaction(item._id, emoji);
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 6,
                              paddingVertical: 3,
                              borderRadius: 12,
                              backgroundColor: data.hasYou 
                                ? 'rgba(94, 92, 230, 0.9)' 
                                : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)'),
                              marginLeft: 4,
                              marginBottom: 4,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.3,
                              shadowRadius: 2,
                            }}
                          >
                            <Text style={{ fontSize: 12 }}>{emoji}</Text>
                            {data.count > 1 && (
                              <Text style={{ 
                                marginLeft: 3, 
                                fontSize: 10, 
                                color: data.hasYou ? '#fff' : colors.text, 
                                fontWeight: '600' 
                              }}>
                                {data.count}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ position: 'relative' }}>
                    <View 
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F2F3F5',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        borderTopLeftRadius: isFirstOfGroup ? 12 : 4,
                        borderBottomLeftRadius: isLastOfGroup ? 12 : 4,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 20 }}>
                      {item.content}
                    </Text>
                      {/* Subtle timestamp for grouped messages */}
                      {!isFirstOfGroup && (
                        <Text style={{ 
                          color: colors.textTertiary, 
                          fontSize: 9, 
                          marginTop: 2,
                          alignSelf: 'flex-end',
                        }}>
                          {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                    {/* Reactions overlapping bottom-right */}
              {item.reactions && item.reactions.length > 0 && (
                      <View style={{ 
                        position: 'absolute', 
                        bottom: -6, 
                        right: 8, 
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        maxWidth: 200,
                        justifyContent: 'flex-end',
                      }}>
                  {Object.entries(
                    item.reactions.reduce((acc, r) => {
                      acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                      acc[r.emoji].count++;
                      acc[r.emoji].users.push(r.userName);
                      if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                      return acc;
                    }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                  ).map(([emoji, data]) => (
                    <TouchableOpacity
                      key={emoji}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              toggleReaction(item._id, emoji);
                            }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                              paddingHorizontal: 6,
                              paddingVertical: 3,
                        borderRadius: 12,
                              backgroundColor: data.hasYou 
                                ? 'rgba(94, 92, 230, 0.9)' 
                                : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)'),
                              marginLeft: 4,
                              marginBottom: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.2,
                        shadowRadius: 2,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{emoji}</Text>
                      {data.count > 1 && (
                              <Text style={{ 
                                marginLeft: 3, 
                                fontSize: 10, 
                                color: data.hasYou ? '#fff' : colors.text, 
                                fontWeight: '600' 
                              }}>
                          {data.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "flex-end", marginTop: isFirstOfGroup ? 0 : 2, marginBottom: isLastOfGroup ? 8 : 0 }}>
            <View style={{ maxWidth: "75%", position: 'relative' }}>
              {/* Reply Preview for self messages - Contained View */}
              {item.replyTo && (
                <View style={{
                  marginBottom: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  alignSelf: 'flex-end',
                  borderLeftWidth: 3,
                  borderLeftColor: 'rgba(255, 255, 255, 0.9)',
                  maxWidth: '100%',
                }}>
                  <Text style={{ color: "rgba(255,255,255,1)", fontSize: 11, fontWeight: '600', marginBottom: 3 }}>
                    {item.replyTo.sender}
                  </Text>
                  <Text 
                    style={{ color: "rgba(255,255,255,0.95)", fontSize: 12, lineHeight: 16 }} 
                    numberOfLines={2}
                  >
                    {item.replyTo.content}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                onLongPress={() => handleLongPress(item)}
                delayLongPress={300}
                activeOpacity={0.9}
                style={{ position: 'relative' }}
              >
                <LinearGradient
                  colors={['#007AFF', '#5E5CE6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderTopRightRadius: isFirstOfGroup ? 12 : 4,
                    borderBottomRightRadius: isLastOfGroup ? 12 : 4,
                  }}
                >
                  {deleted ? (
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontStyle: "italic" }}>
                      Message deleted
                    </Text>
                  ) : item.type === 'photo' || (item.content?.match(/\.(jpeg|jpg|gif|png|webp)/i) && item.content?.includes('cloudinary.com')) ? (
                    <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => handleImagePress(item.content)}
                      onLongPress={() => handleLongPress(item)}
                        style={{
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                    >
                      <Image
                        source={{ uri: item.content }}
                          style={{ width: 220, height: 220 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                      {/* Reactions overlapping bottom-right */}
                      {item.reactions && item.reactions.length > 0 && (
                        <View style={{ 
                          position: 'absolute', 
                          bottom: 8, 
                          right: 8, 
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          maxWidth: 180,
                          justifyContent: 'flex-end',
                        }}>
                          {Object.entries(
                            item.reactions.reduce((acc, r) => {
                              acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                              acc[r.emoji].count++;
                              acc[r.emoji].users.push(r.userName);
                              if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                              return acc;
                            }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                          ).map(([emoji, data]) => (
                            <TouchableOpacity
                              key={emoji}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleReaction(item._id, emoji);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                                borderRadius: 12,
                                backgroundColor: data.hasYou 
                                  ? 'rgba(94, 92, 230, 0.9)' 
                                  : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)'),
                                marginLeft: 4,
                                marginBottom: 4,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.3,
                                shadowRadius: 2,
                              }}
                            >
                              <Text style={{ fontSize: 12 }}>{emoji}</Text>
                              {data.count > 1 && (
                                <Text style={{ 
                                  marginLeft: 3, 
                                  fontSize: 10, 
                                  color: data.hasYou ? '#fff' : colors.text, 
                                  fontWeight: '600' 
                                }}>
                                  {data.count}
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : item.type === 'video' ? (
                    <View style={{ position: 'relative' }}>
                      <TouchableOpacity 
                        onPress={() => Linking.openURL(item.content)} 
                        style={{ 
                          width: 220, 
                          height: 150, 
                          borderRadius: 10, 
                          backgroundColor: 'rgba(0,0,0,0.3)', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}
                      >
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Ionicons name="play" size={24} color="#fff" />
                        </View>
                    </TouchableOpacity>
                      {/* Reactions overlapping bottom-right */}
                      {item.reactions && item.reactions.length > 0 && (
                        <View style={{ 
                          position: 'absolute', 
                          bottom: 8, 
                          right: 8, 
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          maxWidth: 180,
                          justifyContent: 'flex-end',
                        }}>
                          {Object.entries(
                            item.reactions.reduce((acc, r) => {
                              acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                              acc[r.emoji].count++;
                              acc[r.emoji].users.push(r.userName);
                              if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                              return acc;
                            }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                          ).map(([emoji, data]) => (
                            <TouchableOpacity
                              key={emoji}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleReaction(item._id, emoji);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                                borderRadius: 12,
                                backgroundColor: data.hasYou 
                                  ? 'rgba(94, 92, 230, 0.9)' 
                                  : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)'),
                                marginLeft: 4,
                                marginBottom: 4,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.3,
                                shadowRadius: 2,
                              }}
                            >
                              <Text style={{ fontSize: 12 }}>{emoji}</Text>
                              {data.count > 1 && (
                                <Text style={{ 
                                  marginLeft: 3, 
                                  fontSize: 10, 
                                  color: data.hasYou ? '#fff' : colors.text, 
                                  fontWeight: '600' 
                                }}>
                                  {data.count}
                                </Text>
                              )}
              </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ position: 'relative' }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 20 }}>
                        {item.content}
                      </Text>
                      {/* Reactions overlapping bottom-right */}
              {item.reactions && item.reactions.length > 0 && (
                        <View style={{ 
                          position: 'absolute', 
                          bottom: -6, 
                          right: 8, 
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          maxWidth: 200,
                          justifyContent: 'flex-end',
                        }}>
                  {Object.entries(
                    item.reactions.reduce((acc, r) => {
                      acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                      acc[r.emoji].count++;
                      acc[r.emoji].users.push(r.userName);
                      if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                      return acc;
                    }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                  ).map(([emoji, data]) => (
                    <TouchableOpacity
                      key={emoji}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleReaction(item._id, emoji);
                              }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                        borderRadius: 12,
                                backgroundColor: data.hasYou 
                                  ? 'rgba(94, 92, 230, 0.9)' 
                                  : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)'),
                        marginLeft: 4,
                                marginBottom: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.2,
                        shadowRadius: 2,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{emoji}</Text>
                      {data.count > 1 && (
                                <Text style={{ 
                                  marginLeft: 3, 
                                  fontSize: 10, 
                                  color: data.hasYou ? '#fff' : colors.text, 
                                  fontWeight: '600' 
                                }}>
                          {data.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Reactions Display (Right Aligned) - Premium Pill Style */}
              {item.reactions && item.reactions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', position: 'absolute', bottom: -14, right: 12, zIndex: 10, justifyContent: 'flex-end' }}>
                  {Object.entries(
                    item.reactions.reduce((acc, r) => {
                      acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasYou: false };
                      acc[r.emoji].count++;
                      acc[r.emoji].users.push(r.userName);
                      if (String(r.userId) === String(user?._id)) acc[r.emoji].hasYou = true;
                      return acc;
                    }, {} as Record<string, { count: number; users: string[]; hasYou: boolean }>)
                  ).map(([emoji, data]) => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleReaction(item._id, emoji);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: data.hasYou 
                          ? (isDark ? 'rgba(94, 92, 230, 0.25)' : 'rgba(94, 92, 230, 0.15)') 
                          : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'),
                        borderWidth: 1.5,
                        borderColor: data.hasYou 
                          ? colors.primary 
                          : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'),
                        marginLeft: 6,
                        shadowColor: data.hasYou ? colors.primary : '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: data.hasYou ? 0.3 : 0.1,
                        shadowRadius: 4,
                        elevation: data.hasYou ? 4 : 2,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{emoji}</Text>
                      {data.count > 1 && (
                  <Text style={{
                          marginLeft: 5, 
                          fontSize: 11, 
                          color: data.hasYou ? colors.primary : colors.textSecondary, 
                          fontWeight: '700' 
                        }}>
                          {data.count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Delivery status indicators - only show on last message of group */}
              {!deleted && isLastOfGroup && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4, marginRight: 4 }}>
                  <Text style={{
                    color: item.status === "read" ? "#007AFF" : "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    marginRight: 4
                  }}>
                    {(item.status === "read" || item.status === "delivered") && "✓✓"}
                    {(!item.status || item.status === "sent") && "✓"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
                    {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        </Swipeable>
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={{ backgroundColor: isDark ? colors.bg : '#F7F8FA' }}
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
                        contentContainerStyle={{ paddingBottom: 8, paddingTop: 8 }}
                        showsVerticalScrollIndicator={false}
                      />
                    )}
                  </View>

                  {typingLabel ? (
                    <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 4 }}>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          backgroundColor: isDark 
                            ? "rgba(52, 199, 89, 0.2)" 
                            : "rgba(52, 199, 89, 0.12)",
                          borderRadius: 16,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: isDark 
                            ? "rgba(52, 199, 89, 0.3)" 
                            : "rgba(52, 199, 89, 0.2)",
                          shadowColor: colors.success,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 4,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: colors.success,
                            marginRight: 8,
                          }} />
                          <Text style={{ 
                            color: colors.success, 
                            fontSize: 13, 
                            fontWeight: "700",
                            letterSpacing: 0.3,
                          }}>
                          {typingLabel}
                        </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {/* Docked Input Bar */}
                  <View
                    style={{
                      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                      borderTopWidth: 1,
                      borderTopColor: isDark ? '#38383A' : '#E5E5EA',
                      paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 12),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: -2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      elevation: 4,
                    }}
                  >
                  <View
                    style={{
                        paddingHorizontal: 12,
                        paddingTop: 8,
                        paddingBottom: 8,
                    }}
                  >
                    {/* Reply Preview Bar - Full width, above input */}
                    {replyingTo && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginBottom: 8,
                        borderRadius: 8,
                        borderLeftWidth: 3,
                        borderLeftColor: colors.primary,
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                            Replying to {replyingTo.sender}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                            {replyingTo.content || (replyingTo.type === 'photo' ? '📷 Photo' : 'Message')}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setReplyingTo(null);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Input Row: + button, TextInput, Send button */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 8,
                      }}
                    >
                    {/* Animated Attachment Menu - iMessage/Discord Style */}
                    {showAttachmentMenu && (
                      <>
                        {/* Backdrop to close menu when tapping outside */}
                        <Pressable
                          style={{
                            position: 'absolute',
                            top: -2000,
                            left: -2000,
                            right: -2000,
                            bottom: -2000,
                            backgroundColor: 'transparent',
                          }}
                          onPress={() => {
                            attachmentMenuAnim.setValue(0);
                            setShowAttachmentMenu(false);
                          }}
                        />
                      <Animated.View
                        style={{
                          position: 'absolute',
                            bottom: inputHeight + Math.max(insets.bottom, 12) + 10,
                            left: 12,
                            zIndex: 1000,
                            maxWidth: 250,
                          transform: [
                            {
                              translateY: attachmentMenuAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [20, 0],
                              }),
                            },
                              {
                                scale: attachmentMenuAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.8, 1],
                              }),
                            },
                          ],
                          opacity: attachmentMenuAnim,
                        }}
                      >
                          <BlurView
                            intensity={80}
                            tint={isDark ? 'dark' : 'light'}
                            style={{
                              borderRadius: 16,
                              overflow: 'hidden',
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 8 },
                              shadowOpacity: 0.3,
                              shadowRadius: 20,
                              elevation: 12,
                            }}
                          >
                            <View style={{ padding: 8 }}>
                        <TouchableOpacity
                          onPress={handlePickPhoto}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                                  minHeight: 44,
                                  borderRadius: 12,
                          }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                              backgroundColor: '#5E5CE6',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}
                          >
                                  <Ionicons name="image" size={18} color="#fff" />
                          </View>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
                                  Photo
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>

                              <View
                                style={{
                                  height: 1,
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                  marginVertical: 4,
                                }}
                              />

                        <TouchableOpacity
                          onPress={handlePickVideo}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                                  minHeight: 44,
                                  borderRadius: 12,
                          }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                              backgroundColor: '#007AFF',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                            }}
                          >
                                  <Ionicons name="videocam" size={18} color="#fff" />
                          </View>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
                                  Video
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>

                              <View
                                style={{
                                  height: 1,
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                  marginVertical: 4,
                                }}
                              />

                      <TouchableOpacity
                                onPress={() => {
                                  // Placeholder for camera
                                  attachmentMenuAnim.setValue(0);
                                  setShowAttachmentMenu(false);
                                  Alert.alert('Coming Soon', 'Camera feature will be available soon.');
                                }}
                        style={{
                                  flexDirection: 'row',
                          alignItems: 'center',
                                  paddingHorizontal: 16,
                                  paddingVertical: 12,
                                  minHeight: 44,
                                  borderRadius: 12,
                        }}
                        activeOpacity={0.7}
                      >
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: '#34C759',
                            alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                  }}
                                >
                                  <Ionicons name="camera" size={18} color="#fff" />
                            </View>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
                                  Camera
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                          </BlurView>
                        </Animated.View>
                      </>
                    )}

                      {/* + button */}
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          showAttachmentOptions();
                        }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={22} color={colors.text} />
                      </TouchableOpacity>

                      {/* Text Input */}
                        <View
                          style={{
                          flex: 1,
                            flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F2F3F5',
                          borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                          minHeight: 40,
                          maxHeight: 120,
                          }}
                        >
                          <TextInput
                            ref={inputRef}
                            value={input}
                            returnKeyType="send"
                            blurOnSubmit={false}
                            onChangeText={(t) => {
                              const wasEmpty = input.trim().length === 0;
                              const willBeEmpty = t.trim().length === 0;
                              
                              // Trigger LayoutAnimation when send button appears/disappears
                              if (wasEmpty !== willBeEmpty) {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              }
                              
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
                            fontSize: 16,
                              flex: 1,
                            minHeight: 20,
                              maxHeight: 100,
                            height: Math.max(20, inputHeight - 20),
                            paddingVertical: 0,
                              textAlignVertical: "top",
                            }}
                            onContentSizeChange={(e) => {
                              const h = e.nativeEvent.contentSize.height;
                              // inputHeight represents the total container height (text + padding)
                              setInputHeight(Math.min(120, Math.max(40, h + 20)));
                            }}
                            editable={!sending}
                            multiline
                            keyboardType="default"
                            autoCorrect={true}
                            autoCapitalize="sentences"
                          />

                        {/* Send button - appears when text exists with animation */}
                        {input.trim().length > 0 && (
                          <Animated.View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              overflow: "hidden",
                              marginLeft: 8,
                              opacity: sending ? 0.6 : 1,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                sendMessage();
                              }}
                              disabled={sending}
                              style={{
                                width: '100%',
                                height: '100%',
                            }}
                          >
                            <LinearGradient
                                colors={['#007AFF', '#5E5CE6']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                            >
                              {sending ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                  <Ionicons name="arrow-up" size={18} color="#fff" />
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                          </Animated.View>
                        )}
                        </View>
                      </View>
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
      </KeyboardAvoidingView >

      {/* New Context Menu & Image Viewer */}
      <MessageActionSheet
        visible={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onReaction={handleReaction}
        onAction={handleAction}
        isOwnMessage={selectedMessage?.senderId === user?._id}
        messageContent={selectedMessage?.content}
      />

      <ImageViewerModal
        visible={!!viewingImage}
        imageUrl={viewingImage || ''}
        onClose={() => setViewingImage(null)}
      />

      {/* Bottom Sheet Modal for Community Menu */}
      <Modal
        visible={showCommunityMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommunityMenu(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowCommunityMenu(false)}
        >
          <Pressable
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 12,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: isDark ? '#38383A' : '#E5E5EA',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 20,
            }} />

            {/* Menu Options */}
            <Pressable
              onPress={() => {
                setShowCommunityMenu(false);
                goTo(1);
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? '#38383A' : '#E5E5EA',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="people-outline" size={24} color={colors.text} />
                <Text style={{
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: '500',
                  marginLeft: 16,
                }}>
                  View Members
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowCommunityMenu(false);
                confirmLeave();
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="log-out-outline" size={24} color={colors.destructive} />
                <Text style={{
                  color: colors.destructive,
                  fontSize: 17,
                  fontWeight: '500',
                  marginLeft: 16,
                }}>
                  Leave Community
                </Text>
              </View>
            </Pressable>

            {/* Cancel Button */}
            <Pressable
              onPress={() => setShowCommunityMenu(false)}
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                paddingVertical: 16,
                borderRadius: 12,
                backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: colors.text,
                fontSize: 17,
                fontWeight: '600',
              }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
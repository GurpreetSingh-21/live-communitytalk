// CommunityTalkMobile/app/(tabs)/dms.tsx

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  FlatList,
  Pressable,
  TextInput,
  View,
  Text,
  RefreshControl,
  Image, // ✅ Added Image import
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedScrollHandler,
  interpolate,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { AuthContext } from '@/src/context/AuthContext';
import { api } from '@/src/api/api';
import { useSocket } from '@/src/context/SocketContext';

/* ───────────────── Types ───────────────── */

type MessageType = 'text' | 'photo' | 'video' | 'audio' | 'file';

type MessageContent = {
  type: MessageType;
  content: string;
};

type DMThread = {
  id: string; // partnerId
  name: string;
  avatar: string;
  lastMsg: MessageContent;
  lastAt: number;
  unread?: number;
  pinned?: boolean;
  archived?: boolean; // ✅ Added local archived state
  online?: boolean;
  typing?: boolean;
};

type ActiveUser = { id: string; name: string; avatar: string };

const FILTERS = ['All', 'Unread', 'Pinned'] as const;

/* ───────────────── Sorting Helper ───────────────── */

function resortByPinnedAndRecent(list: DMThread[]) {
  return [...list].sort((a, b) => {
    // Pinned first
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    // Then recent
    return (b.lastAt || 0) - (a.lastAt || 0);
  });
}

/* ───────────────── UI Components ───────────────── */

const ShimmeringView = ({ children, isDark }: { children: ReactNode; isDark: boolean }) => {
  const translateX = useSharedValue(-300);
  useEffect(() => {
    translateX.value = withRepeat(withTiming(300, { duration: 1000 }), -1);
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  return (
    <View style={{ backgroundColor: isDark ? '#27272a' : '#e5e7eb', overflow: 'hidden' }}>
      <Animated.View style={[{ width: '100%', height: '100%', position: 'absolute' }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 'transparent']}
          style={{ width: '100%', height: '100%' }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </Animated.View>
      {children}
    </View>
  );
};

const DMRowSkeleton = () => {
  const isDark = useColorScheme() === 'dark';
  return (
    <View className="flex-row items-center gap-4 px-4 h-[93px]">
      <ShimmeringView isDark={isDark}><View className="w-14 h-14 rounded-full" /></ShimmeringView>
      <View className="flex-1">
        <ShimmeringView isDark={isDark}><View className="w-3/4 h-4 rounded-md mb-2" /></ShimmeringView>
        <ShimmeringView isDark={isDark}><View className="w-1/2 h-3 rounded-md" /></ShimmeringView>
      </View>
    </View>
  );
};

const UnreadBadge = ({ count }: { count: number }) => (
  <MotiView
    from={{ scale: 0.5 }}
    animate={{ scale: 1 }}
    transition={{ type: 'spring' }}
    className="bg-indigo-600 rounded-full h-6 w-6 items-center justify-center border-2 border-white dark:border-black"
  >
    <Text className="text-white text-xs font-bold">{count > 99 ? '99+' : count}</Text>
  </MotiView>
);

const TypingIndicator = () => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-black" style={animatedStyle} />;
};

const SmartPreview = ({ msg }: { msg: MessageContent }) => {
  const isDark = useColorScheme() === 'dark';

  let iconName: any = 'text-outline';
  let label = msg.content;

  if (msg.type === 'photo') { iconName = 'camera-outline'; label = 'Photo'; }
  else if (msg.type === 'video') { iconName = 'videocam-outline'; label = 'Video'; }
  else if (msg.type === 'audio') { iconName = 'mic-outline'; label = 'Voice Note'; }
  else if (msg.type === 'file') { iconName = 'document-text-outline'; label = 'File'; }

  if (msg.type === 'text') {
    return <Text className="text-slate-600 dark:text-zinc-400" numberOfLines={1}>{msg.content}</Text>;
  }

  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-lg">
      <Ionicons name={iconName} size={14} color={isDark ? '#a1a1aa' : '#64748b'} />
      <Text className="text-sm text-slate-600 dark:text-zinc-400 italic">{label}</Text>
    </View>
  );
};

/* ───────────────── Time Helper ───────────────── */

function timeAgoLabel(fromMs: number, nowMs: number): string {
  if (!fromMs) return '';
  const diff = Math.max(0, nowMs - fromMs);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d`;
  return new Date(fromMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ───────────────── Row Component ───────────────── */

type RowProps = {
  item: DMThread;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onPinToggle: (id: string) => void;
  onOpen: (id: string) => void;
  now: number;
};

const DMRow = React.memo(function DMRow({ item, onArchive, onDelete, onPinToggle, onOpen, now }: RowProps) {
  const isDark = useColorScheme() === 'dark';
  const translateX = useSharedValue(0);
  const ACTION_WIDTH = 72;

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationX < 0) translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const totalWidth = ACTION_WIDTH * 3;
      const shouldSnapOpen = e.translationX < -totalWidth / 2 || e.velocityX < -500;
      translateX.value = withSpring(shouldSnapOpen ? -totalWidth : 0, { damping: 15, mass: 0.8 });
      if (shouldSnapOpen) runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  const animatedRowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const animatedPinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(translateX.value, [-ACTION_WIDTH, 0], [1, 0.5], 'clamp') }]
  }));
  const animatedArchiveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(translateX.value, [-ACTION_WIDTH * 2, -ACTION_WIDTH], [1, 0.5], 'clamp') }]
  }));
  const animatedDeleteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(translateX.value, [-ACTION_WIDTH * 3, -ACTION_WIDTH * 2], [1, 0.5], 'clamp') }]
  }));

  const handlePin = () => { 'worklet'; runOnJS(onPinToggle)(item.id); translateX.value = withSpring(0); };
  const handleArchive = () => { 'worklet'; runOnJS(onArchive)(item.id); translateX.value = withSpring(0); };
  const handleDelete = () => { 'worklet'; runOnJS(onDelete)(item.id); translateX.value = withSpring(0); };

  const isAvatarUrl = item.avatar && (item.avatar.startsWith('http') || item.avatar.startsWith('file'));
  const hasUnread = !!item.unread && item.unread > 0;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'timing', duration: 250 }}
    >
      <GestureDetector gesture={pan}>
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          {/* Swipe Actions */}
          <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' }}>
            <Pressable onPress={handlePin} style={{ width: ACTION_WIDTH, backgroundColor: '#5E5CE6', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={animatedPinStyle}>
                <Ionicons name={item.pinned ? 'pin-outline' : 'pin'} size={20} color="white" />
              </Animated.View>
            </Pressable>
            <Pressable onPress={handleArchive} style={{ width: ACTION_WIDTH, backgroundColor: '#FF9F0A', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={animatedArchiveStyle}>
                <Ionicons name="archive-outline" size={20} color="white" />
              </Animated.View>
            </Pressable>
            <Pressable onPress={handleDelete} style={{ width: ACTION_WIDTH, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={animatedDeleteStyle}>
                <Ionicons name="trash-outline" size={20} color="white" />
              </Animated.View>
            </Pressable>
          </View>

          {/* Premium Card */}
          <Animated.View style={animatedRowStyle}>
            <Pressable
              onPress={() => onOpen(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 14,
                shadowColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.06)',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              {/* Avatar */}
              <View style={{ position: 'relative', marginRight: 12 }}>
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {isAvatarUrl ? (
                    <Image source={{ uri: item.avatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 24 }}>{item.avatar || '🗣️'}</Text>
                  )}
                </View>

                {/* Online indicator */}
                {item.online && !item.typing && (
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#34C759',
                    borderWidth: 2,
                    borderColor: isDark ? '#000' : '#FFF',
                  }} />
                )}

                {/* Typing indicator */}
                {item.typing && (
                  <View style={{ position: 'absolute', bottom: 0, right: 0 }}><TypingIndicator /></View>
                )}

                {/* Pinned badge */}
                {item.pinned && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#5E5CE6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: isDark ? '#000' : '#FFF',
                  }}>
                    <Ionicons name="pin" size={10} color="#FFF" />
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={{ flex: 1 }}>
                {/* Name + Time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: isDark ? '#FFFFFF' : '#000000',
                      fontSize: 16,
                      fontWeight: hasUnread ? '700' : '600',
                      letterSpacing: -0.3,
                      flex: 1,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    marginLeft: 8,
                    color: hasUnread ? '#5E5CE6' : (isDark ? '#48484A' : '#AEAEB2'),
                    fontWeight: hasUnread ? '600' : '400',
                  }}>
                    {timeAgoLabel(item.lastAt, now)}
                  </Text>
                </View>

                {/* Preview + Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        color: hasUnread ? (isDark ? '#E5E5EA' : '#3C3C43') : (isDark ? '#636366' : '#8E8E93'),
                        fontWeight: hasUnread ? '500' : '400',
                      }}
                    >
                      {item.lastMsg.type !== 'text' ? (
                        <Text>
                          <Ionicons
                            name={item.lastMsg.type === 'photo' ? 'camera' : item.lastMsg.type === 'video' ? 'videocam' : item.lastMsg.type === 'audio' ? 'mic' : 'document'}
                            size={12}
                            color={isDark ? '#636366' : '#8E8E93'}
                          />
                          {' '}{item.lastMsg.content}
                        </Text>
                      ) : item.lastMsg.content}
                    </Text>
                  </View>
                  {hasUnread && (
                    <View style={{
                      backgroundColor: '#5E5CE6',
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      paddingHorizontal: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        {item.unread! > 99 ? '99+' : item.unread}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Chevron */}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'}
                style={{ marginLeft: 8 }}
              />
            </Pressable>
          </Animated.View>
        </View>
      </GestureDetector>
    </MotiView>
  );
});

/* ───────────────── Main Screen ───────────────── */

export default function DMsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { socket, unreadThreads = {}, refreshUnread, markThreadRead } = useSocket();

  const { isAuthed, user } = React.useContext(AuthContext) as any;
  const myId = String(user?._id || '');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All');

  // Notification state for undo actions
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [lastDeletedItem, setLastDeletedItem] = useState<DMThread | null>(null);

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  const scrollY = useSharedValue(0);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  /* ------------------- Fetch DMs ------------------- */

  const fetchDMThreads = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthed) return [] as DMThread[];
    try {
      const { data } = await api.get('/api/direct-messages', { signal });
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

      const normalized: DMThread[] = list.map((t: any) => {
        const rawLast = t.lastMessage ?? t.threadData?.lastMessage;

        let content = "";
        let type: MessageType = 'text';

        if (t.lastType && ['photo', 'video', 'audio', 'file', 'text'].includes(t.lastType)) {
          type = t.lastType;
          content = t.lastMessage || "";
        }
        else if (typeof rawLast === 'string') {
          content = rawLast;
          if (content.match(/\.(jpeg|jpg|gif|png)/i)) type = 'photo';
        }

        if (!content || content === '[Photo]') {
          if (type === 'photo') content = 'Photo';
          else if (type === 'video') content = 'Video';
          else if (type === 'audio') content = 'Voice Note';
          else if (type === 'file') content = 'Attachment';
        }

        const id = String(t.partnerId ?? t.id ?? '');
        const name = String(t.fullName || t.partnerName || t.name || t.email || 'Unknown');
        const lastAt = Number(new Date(t.lastTimestamp ?? t.updatedAt ?? Date.now()).getTime());

        return {
          id,
          name,
          avatar: t.avatarEmoji || t.avatar || '🗣️',
          lastMsg: { type, content },
          lastAt,
          unread: Number(t.unread || 0),
          online: !!t.online,
          typing: !!t.typing,
          pinned: !!t.pinned,
          archived: false, // Default state from backend
        };
      });

      return normalized;
    } catch (error) {
      return [] as DMThread[];
    }
  }, [isAuthed]);

  /* ------------------- Refresh & Init ------------------- */

  const onRefresh = useCallback(async () => {
    const ac = new AbortController();
    try {
      setIsRefreshing(true);
      const dm = await fetchDMThreads(ac.signal);
      await refreshUnread?.();
      setThreads(resortByPinnedAndRecent(dm));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsRefreshing(false);
      ac.abort();
    }
  }, [fetchDMThreads, refreshUnread]);

  // INSTANT LOADING: Show cache immediately, refresh in background
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      // 1. Load cache INSTANTLY
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const cached = await AsyncStorage.getItem('@dms_cache_v1');
        if (cached) {
          const data = JSON.parse(cached);
          console.log('[DMs] 📦 Loaded from cache:', data.length, 'items');
          setThreads(resortByPinnedAndRecent(data));
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
      } catch (e) {
        console.error('[DMs] ❌ Cache load failed:', e);
        setIsLoading(true);
      }

      // 2. Fetch fresh data in background
      const dm = await fetchDMThreads(ac.signal);
      await refreshUnread?.();
      setThreads(resortByPinnedAndRecent(dm));
      setIsLoading(false);

      // 3. Save to cache (only if non-empty)
      if (dm && dm.length > 0) {
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.setItem('@dms_cache_v1', JSON.stringify(dm));
          console.log('[DMs] 💾 Saved to cache:', dm.length, 'items');
        } catch (e) {
          console.error('[DMs] ❌ Cache save failed:', e);
        }
      }
    })();

    return () => ac.abort();
  }, [fetchDMThreads, refreshUnread]);

  useEffect(() => {
    if (!threads.length) return;
    setThreads(prev =>
      prev.map(t => ({ ...t, unread: Number(unreadThreads[t.id] ?? 0) || 0 }))
    );
  }, [unreadThreads]);

  useEffect(() => {
    const online = threads
      .filter(t => (t.online || t.typing) && !t.archived) // Don't show archived users in rail
      .map(t => ({ id: t.id, name: t.name, avatar: t.avatar }));
    setActiveUsers(online);
  }, [threads]);

  /* ------------------- Realtime listeners ------------------- */

  useEffect(() => {
    const s = socket;
    if (!s) return;

    const onPresence = (payload: any) => {
      const uid = String(payload?.userId || '');
      if (!uid || uid === myId) return;

      const online = typeof payload?.online === 'boolean'
        ? payload.online
        : String(payload?.status || '').toLowerCase() === 'online';

      setThreads(prev =>
        prev.map(t => t.id === uid ? ({ ...t, online }) : t)
      );
    };

    const onTyping = (payload: any) => {
      const from = String(payload?.from || '');
      if (!from) return;
      setThreads(prev => prev.map(t =>
        t.id === from ? ({ ...t, typing: !!payload.typing }) : t
      ));
    };

    const onDirectMsg = (payload: any) => {
      const from = String(payload?.from || payload?.senderId || '');
      if (!from) return;

      const type = payload?.type || 'text';
      let contentStr = String(payload?.content ?? '');

      if (!contentStr) {
        if (type === 'photo') contentStr = 'Photo';
        else if (type === 'video') contentStr = 'Video';
        else if (type === 'audio') contentStr = 'Voice Note';
        else if (type === 'file') contentStr = 'File';
      }

      const content: MessageContent = { type, content: contentStr };
      const lastAt = Number(new Date(payload?.createdAt ?? Date.now()).getTime());

      setThreads(prev => {
        const idx = prev.findIndex(t => t.id === from);
        if (idx >= 0) {
          const copy = [...prev];
          const th = copy[idx];
          // Unarchive if new message comes
          copy[idx] = { ...th, lastMsg: content, lastAt, unread: (th.unread || 0) + 1, archived: false };
          return resortByPinnedAndRecent(copy);
        }
        const created: DMThread = {
          id: from,
          name: String(payload?.fromName || 'New Message'),
          avatar: payload?.fromAvatar || '🗣️',
          lastMsg: content,
          lastAt,
          unread: 1,
          online: true,
          pinned: false,
          archived: false
        };
        return resortByPinnedAndRecent([created, ...prev]);
      });
    };

    s.on?.('presence:update', onPresence);
    s.on?.('typing', onTyping);
    s.on?.('dm:message', onDirectMsg);

    return () => {
      s.off?.('presence:update', onPresence);
      s.off?.('typing', onTyping);
      s.off?.('dm:message', onDirectMsg);
    };
  }, [socket, myId]);

  /* ------------------- UX actions ------------------- */

  const handleArchive = useCallback((id: string) => {
    setThreads(cur => {
      const target = cur.find(t => t.id === id);
      if (target) setLastDeletedItem({ ...target, archived: true });
      // Optimistically remove from view
      return cur.map(t => t.id === id ? { ...t, archived: true } : t);
    });
    setSnackbarMsg("Conversation archived");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => setSnackbarMsg(null), 4000);
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      "Delete Conversation",
      "Are you sure you want to delete this chat? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setThreads(cur => cur.filter(t => t.id !== id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Note: Ideally you call an API here to delete on backend
          }
        }
      ]
    );
  }, []);

  const handleUndo = () => {
    if (lastDeletedItem) {
      setThreads(cur => resortByPinnedAndRecent(
        cur.map(t => t.id === lastDeletedItem.id ? { ...t, archived: false } : t)
      ));
      setSnackbarMsg(null);
      setLastDeletedItem(null);
    }
  };

  const handlePinToggle = (id: string) => {
    setThreads(cur =>
      resortByPinnedAndRecent(
        cur.map(t => (t.id === id ? { ...t, pinned: !t.pinned } : t))
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const openDM = async (partnerId: string) => {
    const thread = threads.find(t => t.id === partnerId);
    await markThreadRead?.(partnerId);

    setThreads(cur => cur.map(t => (t.id === partnerId ? { ...t, unread: 0 } : t)));

    router.push({
      pathname: "/dm/[id]",
      params: {
        id: partnerId,
        name: thread?.name || "Chat",
        avatar: thread?.avatar
      }
    });
  };

  // Search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const filteredThreads = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let filtered = threads.filter((t) => !t.archived && t.name.toLowerCase().includes(q)); // Filter out archived

    if (activeFilter === 'Unread') filtered = filtered.filter((t) => t.unread && t.unread > 0);
    if (activeFilter === 'Pinned') filtered = filtered.filter((t) => t.pinned);

    return filtered;
  }, [threads, debouncedQuery, activeFilter]);

  /* ------------------- Header animation ------------------- */

  const scrollHandler = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });

  // Collapse header logic
  const animatedHeaderStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(scrollY.value, [0, 100], [0, -60], 'clamp') }] }));
  const animatedOpacityStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 60], [1, 0], 'clamp') }));

  /* ------------------- Render ------------------- */

  if (isLoading && !threads.length) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }} className="bg-white dark:bg-black">
        <Text className="text-3xl font-extrabold text-black dark:text-white px-4 mt-2 mb-4">Messages</Text>
        {[...Array(6)].map((_, i) => (<DMRowSkeleton key={i} />))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#F9FAFB' }}>
      {/* List */}
      <Animated.FlatList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DMRow
            item={item}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onPinToggle={handlePinToggle}
            onOpen={openDM}
            now={now}
          />
        )}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={isDark ? '#FFF' : '#000'} />}
        contentContainerStyle={{ paddingTop: 200, paddingBottom: insets.bottom + 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80, opacity: 0.6 }}>
            <Ionicons name="chatbubbles-outline" size={48} color={isDark ? '#FFF' : '#000'} />
            <Text style={{ fontWeight: '700', fontSize: 18, marginTop: 12, color: isDark ? '#FFFFFF' : '#000000' }}>
              No conversations
            </Text>
            <Text style={{ fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 32, color: isDark ? '#636366' : '#8E8E93' }}>
              {searchQuery ? 'Try a different search' : 'Tap "+" to start messaging'}
            </Text>
          </View>
        }
      />

      {/* Premium Header */}
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 12, zIndex: 10 }, animatedHeaderStyle]}
      >
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />

        {/* Title Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: isDark ? '#FFFFFF' : '#000000', letterSpacing: -0.8 }}>
            Messages
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
        </View>

        {/* Premium Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 42,
            marginBottom: 12,
          }}
        >
          <Ionicons name="search" size={18} color={isDark ? '#636366' : '#8E8E93'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations..."
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 15,
              color: isDark ? '#FFFFFF' : '#000000',
              fontWeight: '400',
              letterSpacing: -0.2,
            }}
            placeholderTextColor={isDark ? '#48484A' : '#AEAEB2'}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={isDark ? '#636366' : '#8E8E93'} />
            </Pressable>
          )}
        </View>

        {/* Elegant Underline Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 20 }}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => { setActiveFilter(f); Haptics.selectionAsync(); }}
                style={{ paddingBottom: 8 }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? (isDark ? '#FFFFFF' : '#000000') : (isDark ? '#636366' : '#8E8E93'),
                  letterSpacing: -0.2,
                }}>
                  {f}
                </Text>
                {isActive && (
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: '#5E5CE6',
                    borderRadius: 1,
                  }} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Archive Snackbar */}
      <AnimatePresence>
        {snackbarMsg && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: 20 }}
            transition={{ type: 'spring' }}
            style={{ position: 'absolute', bottom: insets.bottom + 20, left: 20, right: 20 }}
          >
            <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, overflow: 'hidden' }}>
              <Text style={{ color: isDark ? '#FFFFFF' : '#000000', fontWeight: '500' }}>{snackbarMsg}</Text>
              <Pressable onPress={handleUndo} hitSlop={10}>
                <Text style={{ color: '#5E5CE6', fontWeight: '700' }}>Undo</Text>
              </Pressable>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}
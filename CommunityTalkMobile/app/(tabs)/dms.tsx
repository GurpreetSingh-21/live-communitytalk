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
  const ACTION_WIDTH = 70; // Width of each action button

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => { 
        // Only allow swiping left
        if (e.translationX < 0) translateX.value = e.translationX; 
    })
    .onEnd((e) => {
      // Snap points: 0 (closed), -140 (2 buttons), -210 (3 buttons)
      const totalWidth = ACTION_WIDTH * 3;
      const shouldSnapOpen = e.translationX < -totalWidth / 2 || e.velocityX < -500;
      translateX.value = withSpring(shouldSnapOpen ? -totalWidth : 0, { damping: 15, mass: 0.8 });
      if (shouldSnapOpen) runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  const animatedRowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  
  // Action buttons animations
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

  // ✅ Avatar check
  const isAvatarUrl = item.avatar && (item.avatar.startsWith('http') || item.avatar.startsWith('file'));

  return (
    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <GestureDetector gesture={pan}>
        <View className="relative">
          {/* Hidden Actions Layer (Right Side) */}
          <View className="absolute right-0 top-0 bottom-0 flex-row h-full">
            
            {/* 1. PIN Button */}
            <Pressable onPress={handlePin} style={{ width: ACTION_WIDTH, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Animated.View style={animatedPinStyle} className="items-center">
                <Ionicons name={item.pinned ? 'pin-outline' : 'pin'} size={22} color="white" />
                <Text className="text-white text-[10px] font-bold mt-1">{item.pinned ? 'Unpin' : 'Pin'}</Text>
              </Animated.View>
            </Pressable>

            {/* 2. ARCHIVE Button */}
            <Pressable onPress={handleArchive} style={{ width: ACTION_WIDTH, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Animated.View style={animatedArchiveStyle} className="items-center">
                <Ionicons name="archive-outline" size={22} color="white" />
                <Text className="text-white text-[10px] font-bold mt-1">Archive</Text>
              </Animated.View>
            </Pressable>

            {/* 3. DELETE Button */}
            <Pressable onPress={handleDelete} style={{ width: ACTION_WIDTH, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Animated.View style={animatedDeleteStyle} className="items-center">
                <Ionicons name="trash-outline" size={22} color="white" />
                <Text className="text-white text-[10px] font-bold mt-1">Delete</Text>
              </Animated.View>
            </Pressable>

          </View>

          {/* Foreground Row */}
          <Animated.View style={[animatedRowStyle, { backgroundColor: isDark ? '#000' : '#fff' }]}>
            <Pressable 
                className="flex-row items-center gap-4 px-4 h-[93px] active:bg-slate-50 dark:active:bg-zinc-900" 
                onPress={() => onOpen(item.id)}
            >
              <View>
                <View className="w-14 h-14 rounded-full items-center justify-center overflow-hidden bg-slate-200 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
                    {isAvatarUrl ? (
                       <Image 
                         source={{ uri: item.avatar }} 
                         style={{ width: '100%', height: '100%' }} 
                         resizeMode="cover" 
                       />
                    ) : (
                       <Text className="text-3xl">{item.avatar || '🗣️'}</Text>
                    )}
                </View>
                {item.online && !item.typing && (
                    <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-black" />
                )}
                {item.typing && (
                  <View className="absolute bottom-0 right-0"><TypingIndicator /></View>
                )}
              </View>

              <View className="flex-1 py-4 h-full justify-center border-b border-slate-100 dark:border-zinc-800">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1">
                      <Text className="text-base font-bold text-black dark:text-white" numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.pinned && <Ionicons name="pin" size={12} color={isDark ? '#fbbf24' : '#d97706'} />}
                  </View>
                  <Text className="text-xs text-slate-400 dark:text-zinc-500">
                    {timeAgoLabel(item.lastAt, now)}
                  </Text>
                </View>
                
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <SmartPreview msg={item.lastMsg} />
                  </View>
                  {!!item.unread && item.unread > 0 && <UnreadBadge count={item.unread} />}
                </View>
              </View>
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

  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    
    (async () => {
      const dm = await fetchDMThreads(ac.signal);
      await refreshUnread?.();
      setThreads(resortByPinnedAndRecent(dm));
      setIsLoading(false);
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
        if(target) setLastDeletedItem({...target, archived: true});
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
    <View className="flex-1" style={{ backgroundColor: isDark ? '#000' : '#F3F4F6' }}>
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
        // ✅ Adjusted padding to prevent overlap
        contentContainerStyle={{ paddingTop: 260, paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          <View className="items-center mt-20 opacity-50">
            <Ionicons name="chatbubbles-outline" size={48} color={isDark ? '#FFF' : '#000'} />
            <Text className="font-bold text-lg mt-2 text-black dark:text-white">No conversations</Text>
            <Text className="text-sm mt-1 text-center px-6 text-slate-500">
              {searchQuery ? 'Try a different search' : 'Tap "+" to start messaging'}
            </Text>
          </View>
        }
      />

      {/* Fixed Header */}
      <Animated.View 
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top, zIndex: 10 }, animatedHeaderStyle]} 
      >
        <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
        
        <View className="px-4 pb-2">
            {/* Top Bar */}
            <View className="flex-row items-center justify-between mt-2 mb-4">
                <Text className="text-3xl font-extrabold text-black dark:text-white">Messages</Text>
                <Pressable 
                    className="h-10 w-10 items-center justify-center rounded-full bg-slate-200/80 dark:bg-zinc-800/80 active:opacity-70" 
                    onPress={() => router.push('/(tabs)/explore')}
                >
                    <IconSymbol name="plus" size={20} color={isDark ? '#FFF' : '#000'} />
                </Pressable>
            </View>

            {/* Active Users Rail (Collapsible) */}
            <Animated.View style={[{ overflow: 'hidden' }, animatedOpacityStyle]}>
                {activeUsers.length > 0 ? (
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={activeUsers}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <Pressable onPress={() => openDM(item.id)} className="items-center mr-4">
                                <View className="relative">
                                    <View className="w-14 h-14 rounded-full bg-slate-200 dark:bg-zinc-800 items-center justify-center border-2 border-transparent active:border-indigo-500 overflow-hidden">
                                        {item.avatar && (item.avatar.startsWith('http') || item.avatar.startsWith('file')) ? (
                                            <Image source={{ uri: item.avatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        ) : (
                                            <Text className="text-2xl">{item.avatar || '🗣️'}</Text>
                                        )}
                                    </View>
                                    <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-black" />
                                </View>
                                <Text className="text-[10px] mt-1 text-slate-600 dark:text-zinc-400 font-medium" numberOfLines={1}>
                                    {item.name.split(' ')[0]}
                                </Text>
                            </Pressable>
                        )}
                        className="mb-4"
                    />
                ) : (
                    // Placeholder spacing if no active users
                    <View className="h-2" /> 
                )}
            </Animated.View>

            {/* Search Bar */}
            <View className="flex-row items-center gap-2 rounded-xl bg-black/5 dark:bg-white/10 px-3 h-11 mb-3">
                <IconSymbol name="magnifyingglass" size={18} color={isDark ? '#9ca3af' : '#64748b'} />
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search conversations..."
                    className="flex-1 h-full text-base text-black dark:text-white"
                    placeholderTextColor={isDark ? '#9ca3af' : '#64748b'}
                    clearButtonMode="while-editing"
                />
            </View>

            {/* Filters */}
            <View className="flex-row gap-2">
                {FILTERS.map((f) => (
                    <Pressable
                        key={f}
                        onPress={() => { setActiveFilter(f); Haptics.selectionAsync(); }}
                        className={`px-3 py-1.5 rounded-full border ${
                            activeFilter === f 
                            ? 'bg-black dark:bg-white border-transparent' 
                            : 'bg-transparent border-slate-200 dark:border-zinc-700'
                        }`}
                    >
                        <Text className={`text-xs font-semibold ${activeFilter === f ? 'text-white dark:text-black' : 'text-slate-600 dark:text-zinc-400'}`}>
                            {f}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
        
        {/* Divider Line */}
        <View className="h-[1px] w-full bg-slate-200 dark:bg-zinc-800 mt-2" />
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
            <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} className="flex-row items-center justify-between p-4 rounded-2xl overflow-hidden shadow-lg">
              <Text className="text-black dark:text-white font-medium">{snackbarMsg}</Text>
              <Pressable onPress={handleUndo} hitSlop={10}>
                  <Text className="text-indigo-600 dark:text-indigo-400 font-bold">Undo</Text>
              </Pressable>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}
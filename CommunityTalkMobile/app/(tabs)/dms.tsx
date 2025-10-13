// app/(tabs)/dms.tsx
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { ComponentProps } from 'react';
import {
  FlatList,
  Pressable,
  TextInput,
  View,
  Text,
  SectionList,
  type SectionListData,
  RefreshControl,
  ActivityIndicator,
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

type MessageContent =
  | { type: 'text'; content: string }
  | { type: 'photo'; content: 'Photo' }
  | { type: 'voice'; content: 'Voice Memo' };

type BaseThread = {
  id: string;              // partnerId for DM, communityId for community
  name: string;
  avatar: string;
  lastMsg: MessageContent;
  time: string;
  unread?: number;
  pinned?: boolean;
};

type DMThread = BaseThread & { kind: 'dm'; online?: boolean; typing?: boolean };
type CommunityThread = BaseThread & { kind: 'community' };

type Thread = DMThread | CommunityThread;

type ActiveUser = { id: string; name: string; avatar: string };

const FILTERS = ['All', 'Unread', 'Pinned', 'Work', 'Friends'] as const;

/* ───────────────── UI Bits (kept from your original) ───────────────── */

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
    <Text className="text-white text-xs font-bold">{count}</Text>
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
  if (msg.type === 'text') {
    return <Text className="text-slate-600 dark:text-zinc-400" numberOfLines={1}>{msg.content}</Text>;
  }
  return (
    <View className="flex-row items-center gap-1.5 bg-slate-200 dark:bg-zinc-800 self-start px-2 py-1 rounded-lg">
      <Ionicons name={(msg.type === 'photo' ? 'camera-outline' : 'mic-outline') as any} size={14} color={isDark ? '#FFF' : '#000'} style={{ opacity: 0.6 }} />
      <Text className="text-xs font-medium text-slate-600 dark:text-zinc-300">{msg.content}</Text>
    </View>
  );
};

/* ───────────────── Row (now generic Thread) ───────────────── */

type RowProps = {
  item: Thread;
  onDelete: (id: string, kind: Thread['kind']) => void;
  onPinToggle: (id: string, kind: Thread['kind']) => void;
  onOpen: (id: string, kind: Thread['kind']) => void;
};

const ThreadRow = React.memo(({ item, onDelete, onPinToggle, onOpen }: RowProps) => {
  const isDark = useColorScheme() === 'dark';
  const translateX = useSharedValue(0);
  const ACTION_WIDTH = 90;

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => { if (e.translationX < 0) translateX.value = e.translationX; })
    .onEnd((e) => {
      const shouldSnapOpen = e.translationX < -ACTION_WIDTH / 2 || e.velocityX < -500;
      translateX.value = withSpring(shouldSnapOpen ? -ACTION_WIDTH * 2 : 0, { damping: 15, mass: 0.8 });
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  const animatedRowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const animatedActionStyle = (inputRange: number[], outputRange: number[]) =>
    useAnimatedStyle(() => ({ transform: [{ scale: interpolate(translateX.value, inputRange, outputRange, 'clamp') }] }));

  const handleDelete = () => { 'worklet'; runOnJS(onDelete)(item.id, item.kind); };
  const handlePin = () => { 'worklet'; runOnJS(onPinToggle)(item.id, item.kind); translateX.value = withSpring(0); };

  return (
    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <GestureDetector gesture={pan}>
        <View>
          <View className="absolute right-0 top-0 bottom-0 flex-row">
            <Pressable onPress={handlePin} className="w-[90px] h-full bg-indigo-600 items-center justify-center">
              <Animated.View style={animatedActionStyle([-180, -90], [1, 0.5])}>
                <Ionicons name={item.pinned ? 'pin-outline' : 'pin'} size={24} color="white" />
              </Animated.View>
            </Pressable>
            <Pressable onPress={handleDelete} className="w-[90px] h-full bg-red-600 items-center justify-center">
              <Animated.View style={animatedActionStyle([-90, 0], [1, 0.5])}>
                <Ionicons name="trash" size={24} color="white" />
              </Animated.View>
            </Pressable>
          </View>

          <Animated.View style={animatedRowStyle}>
            <Pressable className="flex-row items-center gap-4 px-4 bg-white dark:bg-black h-[93px]" onPress={() => onOpen(item.id, item.kind)}>
              <View>
                <View className="w-14 h-14 rounded-full items-center justify-center overflow-hidden">
                  {item.kind === 'community' ? (
                    <LinearGradient colors={['#4f46e5', '#a855f7']} className="absolute inset-0" />
                  ) : null}
                  <View className="w-[52px] h-[52px] rounded-full bg-slate-200 dark:bg-zinc-800 items-center justify-center">
                    <Text className="text-3xl">
                      {item.kind === 'community' ? '🏛️' : (item as DMThread).online ? '🟢' : item.avatar || '🗣️'}
                    </Text>
                  </View>
                </View>
                {item.kind === 'dm' && (item as DMThread).typing ? (
                  <View className="absolute bottom-0 right-0"><TypingIndicator /></View>
                ) : null}
              </View>

              <View className="flex-1 py-4 border-b border-slate-100 dark:border-zinc-800 h-full justify-center">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-bold text-black dark:text-white">{item.name}</Text>
                  <Text className="text-xs text-slate-400 dark:text-zinc-500">{item.time}</Text>
                </View>
                <View className="flex-row items-center justify-between mt-1">
                  <SmartPreview msg={item.lastMsg} />
                  {!!item.unread && <UnreadBadge count={item.unread} />}
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

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<Thread>);

export default function InboxScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { socket, unreadThreads = {}, refreshUnread, markThreadRead } = useSocket();

  const { isAuthed, user, communities: myCommunities } = React.useContext(AuthContext) as any;
  const myId = String(user?._id || "");
  // Build a stable set of the user's community IDs (top-level hook, not inside effects)
  const myCommunityIds = useMemo<Set<string>>(
    () =>
      new Set(
        (myCommunities || []).map((c: any) => String(c?._id || c?.id || ""))
      ),
    [myCommunities]
  );

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All');
  const [archivedItem, setArchivedItem] = useState<Thread | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const scrollY = useSharedValue(0);

  /* ------------------- Fetchers ------------------- */

  // 1) Existing DM thread list (kept as-is, will be empty until you build DMs)
  const fetchDMThreads = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthed) return [] as DMThread[];
    try {
      const { data } = await api.get('/api/direct-messages', { signal });
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const normalized: DMThread[] = list.map((t: any) => {
        const last = t?.lastMessage ?? {};
        const type = last?.type && (last.type === 'photo' || last.type === 'voice') ? last.type : 'text';
        const content = type === 'text' ? String(last?.content ?? '') : (type === 'photo' ? 'Photo' : 'Voice Memo');
        const id = String(t.partnerId ?? t.id ?? '');
        return {
          kind: 'dm',
          id,
          name: String(t.partnerName ?? t.fullName ?? 'Unknown'),
          avatar: t.avatarEmoji || t.avatar || '🗣️',
          lastMsg: { type, content } as MessageContent,
          time: shortTime(t?.lastTimestamp ?? last?.createdAt),
          unread: 0,
          online: !!t.online,
          typing: !!t.typing,
          pinned: !!t.pinned,
        };
      });
      return normalized;
    } catch {
      return [] as DMThread[];
    }
  }, [isAuthed]);

  // 2) NEW: Community threads list
  // 2) NEW: Community threads list
  const fetchCommunityThreads = useCallback(
    async (signal?: AbortSignal) => {
      if (!isAuthed) return [] as CommunityThread[];

      const mine = Array.isArray(myCommunities) ? myCommunities : [];

      const results = await Promise.all(
        mine.map(async (c: any) => {
          const cId = String(c?._id || c?.id || '');
          if (!cId) return null;

          try {
            // ✅ your working endpoint (shows in logs)
            const { data } = await api.get(`/api/messages/${cId}`, {
              params: { limit: 1, order: 'desc' },
              signal,
            });

            const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
            const last = list[0];
            if (!last) return null; // ⬅️ skip communities with no messages

            const type =
              last?.type === 'photo' ? 'photo' :
                last?.type === 'voice' ? 'voice' : 'text';

            const content =
              type === 'text' ? String(last?.content ?? '') :
                type === 'photo' ? 'Photo' : 'Voice Memo';

            const th: CommunityThread = {
              kind: 'community',
              id: cId,
              name: String(c?.name || 'Community'),
              avatar: '🏛️',
              lastMsg: { type, content } as MessageContent, // ⬅️ SmartPreview will render type chips for non-text
              time: shortTime(last?.createdAt),
              unread: 0,
              pinned: !!c?.pinned,
            };
            return th;
          } catch {
            return null;
          }
        })
      );

      return results.filter(Boolean) as CommunityThread[];
    },
    [isAuthed, myCommunities]
  );

  // Initial load
  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    (async () => {
      const [dm, communities] = await Promise.all([
        fetchDMThreads(ac.signal),
        fetchCommunityThreads(ac.signal),
        refreshUnread?.(),
      ]);
      setThreads(resortByPinnedAndRecent([...communities, ...dm]));
      setIsLoading(false);
    })();
    return () => ac.abort();
  }, [fetchDMThreads, fetchCommunityThreads, refreshUnread]);

  // Keep unread in sync for DMs (community unread can be added later)
  useEffect(() => {
    if (!threads.length) return;
    setThreads(prev =>
      prev.map(t => t.kind === 'dm'
        ? { ...t, unread: Number(unreadThreads[t.id] ?? 0) || 0 }
        : t
      )
    );
  }, [unreadThreads, threads.length]);

  /* ------------------- Realtime ------------------- */

  useEffect(() => {
    const s = socket;
    if (!s) return;

    // community message arrived
    const onCommunityMsg = (payload: any) => {
      const cid = String(payload?.communityId || '');
      if (!cid || !myCommunityIds.has(cid)) return; // ⬅️ only my memberships

      const newMsg: MessageContent =
        payload?.type === 'photo'
          ? { type: 'photo', content: 'Photo' }
          : payload?.type === 'voice'
            ? { type: 'voice', content: 'Voice Memo' }
            : { type: 'text', content: String(payload?.content ?? '') };

      setThreads(prev => {
        const idx = prev.findIndex(t => t.kind === 'community' && t.id === cid);
        if (idx >= 0) {
          const copy = [...prev];
          const th = copy[idx] as CommunityThread;
          copy[idx] = { ...th, lastMsg: newMsg, time: shortTime(payload?.createdAt) };
          return resortByPinnedAndRecent(copy);
        } else {
          // If it wasn't visible yet (no history), add it now
          const name = (myCommunities || []).find((c: any) => String(c?._id) === cid)?.name || 'Community';
          const added: CommunityThread = {
            kind: 'community',
            id: cid,
            name,
            avatar: '🏛️',
            lastMsg: newMsg,
            time: shortTime(payload?.createdAt),
            unread: 0,
            pinned: false,
          };
          return resortByPinnedAndRecent([added, ...prev]);
        }
      });
    };

    // presence from server → convert to boolean
    const onPresence = (payload: any) => {
      const uid = String(payload?.userId || '');
      if (!uid) return;
      const online =
        typeof payload?.online === 'boolean'
          ? payload.online
          : String(payload?.status || '').toLowerCase() === 'online';

      setThreads(prev => prev.map(t =>
        t.kind === 'dm' && t.id === uid ? ({ ...(t as DMThread), online }) : t
      ));
      // optional: active users reel (kept from your version)
      setActiveUsers(prev => {
        const exists = prev.some(u => u.id === uid);
        const user = { id: uid, name: 'User', avatar: '🟢' };
        return online ? (exists ? prev : [user, ...prev].slice(0, 12)) : prev.filter(u => u.id !== uid);
      });
    };

    const onTyping = (payload: any) => {
      const from = String(payload?.from || '');
      if (!from) return;
      setThreads(prev => prev.map(t =>
        t.kind === 'dm' && t.id === from ? ({ ...(t as DMThread), typing: !!payload.typing }) : t
      ));
    };

    s.on?.('receive_message', onCommunityMsg);
    s.on?.('presence:update', onPresence);
    s.on?.('typing', onTyping);

    return () => {
      s.off?.('receive_message', onCommunityMsg);
      s.off?.('presence:update', onPresence);
      s.off?.('typing', onTyping);
    };
  }, [socket, myCommunityIds, myCommunities]);

  /* ------------------- UX actions ------------------- */

  const handleArchive = (id: string, _kind: Thread['kind']) => {
    const itemToArchive = threads.find(t => t.id === id);
    if (itemToArchive) {
      setArchivedItem(itemToArchive);
      setThreads(cur => cur.filter(t => t.id !== id));
      setTimeout(() => setArchivedItem(null), 4000);
    }
  };

  const handleUndoArchive = () => {
    if (archivedItem) {
      setThreads(cur => resortByPinnedAndRecent([archivedItem!, ...cur]));
      setArchivedItem(null);
    }
  };

  const handlePinToggle = (id: string, kind: Thread['kind']) => {
    setThreads(cur =>
      resortByPinnedAndRecent(
        cur.map(t => (t.id === id && t.kind === kind ? { ...t, pinned: !t.pinned } : t))
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const openDM = async (partnerId: string) => {
    await markThreadRead?.(partnerId);
    setThreads(cur => cur.map(t => (t.kind === 'dm' && t.id === partnerId ? { ...t, unread: 0 } : t)));
    router.push('/(tabs)/dms'); // placeholder until you add DM thread route
  };

  const openCommunity = (communityId: string) => {
    // TODO: route to your community chat screen
    // Example if you have /community/[id] registered:
    router.push({ pathname: '/community/[id]', params: { id: communityId } });
  };

  const handleOpenThread = (id: string, kind: Thread['kind']) => {
    if (kind === 'dm') openDM(id);
    else openCommunity(id);
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    const ac = new AbortController();
    try {
      setIsRefreshing(true);
      const [dm, communities] = await Promise.all([
        fetchDMThreads(ac.signal),
        fetchCommunityThreads(ac.signal),
        refreshUnread?.(),
      ]);
      setThreads(resortByPinnedAndRecent([...communities, ...dm]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsRefreshing(false);
      ac.abort();
    }
  }, [fetchDMThreads, fetchCommunityThreads, refreshUnread]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Sections + Filters (now split by kind)
  const sections = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let filtered = threads.filter((t) => t.name.toLowerCase().includes(q));
    if (activeFilter === 'Unread') filtered = filtered.filter((t) => t.unread);
    if (activeFilter === 'Pinned') filtered = filtered.filter((t) => t.pinned);

    const communities = filtered.filter((t) => t.kind === 'community');
    const dms = filtered.filter((t) => t.kind === 'dm');

    const out: Array<{ title: string; data: Thread[] }> = [];
    if (communities.length) out.push({ title: 'Communities', data: communities });
    if (dms.length) out.push({ title: 'Direct Messages (coming soon)', data: dms });
    return out;
  }, [threads, debouncedQuery, activeFilter]);

  /* ------------------- Header animation (unchanged) ------------------- */

  const scrollHandler = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  const animatedHeaderStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(scrollY.value, [0, 80], [0, -80], 'clamp') }] }));
  const animatedHeaderTitleStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 20], [1, 0], 'clamp') }));
  const animatedHeaderActiveRail = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [20, 50], [1, 0], 'clamp') }));
  const animatedHeaderBorderStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [80, 81], [0, 1], 'clamp') }));

  /* ------------------- First-load skeleton ------------------- */

  if (isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }} className="bg-white dark:bg-black">
        <Text className="text-3xl font-extrabold text-black dark:text-white px-4 mt-2 mb-4">Messages</Text>
        {[...Array(8)].map((_, i) => (<DMRowSkeleton key={i} />))}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#000' : '#F3F4F6' }}>
      <AnimatedSectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={({ item }) => (
          <ThreadRow
            item={item}
            onDelete={handleArchive}
            onPinToggle={handlePinToggle}
            onOpen={handleOpenThread}
          />
        )}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={isDark ? '#FFF' : '#000'} />}
        renderSectionHeader={({ section }: { section: SectionListData<Thread> }) => (
          <View className="bg-neutral-100 dark:bg-black pt-4 pb-2">
            <Text className="font-bold text-slate-500 dark:text-zinc-400 px-4">{section.title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingTop: 300, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-2xl">📪</Text>
            <Text className="font-bold text-lg mt-2 text-black dark:text-white">All clear!</Text>
            <Text className="text-slate-500 dark:text-zinc-400 mt-1">Your inbox is empty.</Text>
          </View>
        }
      />

      {/* Frosted header (unchanged UI) */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top }, animatedHeaderStyle]} className="px-4 pb-2">
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }, animatedHeaderBorderStyle]} />
        <Animated.View style={animatedHeaderTitleStyle}>
         <View className="flex-row items-center justify-between mt-2 mb-5">
            <Text className="text-3xl font-extrabold text-black dark:text-white">Messages</Text>
            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-slate-200/80 dark:bg-zinc-800/80" onPress={() => router.push('/(tabs)/dms')}>
              <IconSymbol name="plus" size={18} color={isDark ? '#FFF' : '#000'} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Online reel (kept) */}
        <Animated.View style={animatedHeaderActiveRail}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={activeUsers}
            keyExtractor={(item: ActiveUser) => item.id}
            renderItem={({ item }: { item: ActiveUser }) => (
              <View className="items-center">
  {/* smaller avatar */}
  <View className="w-12 h-12 rounded-full bg-slate-200/80 dark:bg-zinc-800/80 items-center justify-center">
    <Text className="text-2xl">{item.avatar}</Text>
  </View>
  <Text className="text-[10px] mt-1 text-slate-500 dark:text-zinc-400" numberOfLines={1}>
    {item.name}
  </Text>
</View>
            )}
            contentContainerStyle={{ gap: 10, paddingVertical: 6, paddingLeft: 4 }}
          />
        </Animated.View>

        {/* Search + Filters (kept) */}
        <View className="flex-row items-center gap-2 rounded-xl bg-slate-200/80 dark:bg-zinc-800/80 px-3 mt-2">
          <IconSymbol name="magnifyingglass" size={20} color={isDark ? '#9ca3af' : '#64748b'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search..."
            className="flex-1 h-11 text-base text-black dark:text-white"
            placeholderTextColor={isDark ? '#9ca3af' : '#64748b'}
          />
        </View>
        <View className="mt-4">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTERS as unknown as string[]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setActiveFilter(item as (typeof FILTERS)[number]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                className={`px-4 py-2 rounded-lg ${activeFilter === item ? 'bg-indigo-600' : 'bg-slate-200/50 dark:bg-zinc-800/50'}`}
              >
                <Text className={`font-semibold ${activeFilter === item ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>{item}</Text>
              </Pressable>
            )}
            contentContainerStyle={{ gap: 8 }}
          />
        </View>
      </Animated.View>

      {/* Archive Snackbar */}
      <AnimatePresence>
        {archivedItem && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: 20 }}
            transition={{ type: 'spring' }}
            style={{ position: 'absolute', bottom: insets.bottom + 10, left: 20, right: 20 }}
          >
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} className="flex-row items-center justify-between p-3 rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
              <Text className="text-black dark:text-white font-medium">Chat archived</Text>
              <Pressable onPress={handleUndoArchive}><Text className="text-indigo-600 dark:text-indigo-400 font-bold">Undo</Text></Pressable>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

/* ───────────────── Helpers ───────────────── */
function shortTime(dateLike?: string | number) {
  if (!dateLike) return 'now';
  try {
    const d = new Date(dateLike);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    if (days === 1) return 'yesterday';
    return `${days}d`;
  } catch {
    return 'now';
  }
}

function resortByPinnedAndRecent(list: Thread[]) {
  const score = (t: string) => {
    if (t === 'now') return 1e12;
    if (t === 'yesterday') return 1e9;
    const m = /(\d+)([mh])/.exec(t);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return m[2] === 'h' ? 60 - n : 1000 - n;
  };
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return score(a.time) > score(b.time) ? -1 : 1;
  });
}
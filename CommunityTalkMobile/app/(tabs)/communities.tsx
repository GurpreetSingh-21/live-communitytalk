import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  FlatList,
  Pressable,
  TextInput,
  View,
  Text,
  RefreshControl,
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

type MessageContent = {
  type: 'text' | 'photo' | 'voice';
  content: string;
};

type CommunityThread = {
  id: string;
  name: string;
  avatar: string;
  lastMsg: MessageContent;
  lastAt: number;
  unread?: number;
  pinned?: boolean;
  memberCount?: number;
};

/* ───────────────── UI Components ───────────────── */

const ShimmeringView = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => {
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

const CommunityRowSkeleton = () => {
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

const UnreadBadge = ({ count, pulseKey }: { count: number; pulseKey?: number }) => (
  <MotiView
    key={pulseKey} // re-run tiny pop when unread changes
    from={{ scale: 0.8, opacity: 0.8 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', damping: 12, mass: 0.6 }}
    className="bg-indigo-600 rounded-full h-6 px-2 min-w-[24px] items-center justify-center border-2 border-white dark:border-black"
  >
    <Text className="text-white text-xs font-bold">{count}</Text>
  </MotiView>
);

const SmartPreview = ({ msg, isUnread }: { msg: MessageContent; isUnread: boolean }) => {
  const isDark = useColorScheme() === 'dark';
  const baseColor = isUnread ? (isDark ? '#A1A1AA' : '#71717A') : (isDark ? '#71717A' : '#A1A1AA');
  const baseWeight: any = isUnread ? '600' : '400';

  if (msg.type === 'text') {
    return (
      <Text
        numberOfLines={1}
        style={{ color: baseColor, fontWeight: baseWeight, fontSize: 14, letterSpacing: 0 }}
      >
        {msg.content}
      </Text>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: isDark ? '#18181B' : '#F9FAFB',
        alignSelf: 'flex-start',
      }}
    >
      <Ionicons
        name={(msg.type === 'photo' ? 'image-outline' : 'mic-outline') as any}
        size={14}
        color={isDark ? '#71717A' : '#A1A1AA'}
      />
      <Text
        style={{
          flexShrink: 1,
          color: baseColor,
          fontWeight: baseWeight,
          fontSize: 13,
          letterSpacing: 0,
        }}
        numberOfLines={1}
      >
        {msg.content}
      </Text>
    </View>
  );
};

/* ───────────────── Time helper ───────────────── */

function timeAgoLabel(fromMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - fromMs);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d}d`;
}

/* ───────────────── Row Component ───────────────── */

type RowProps = {
  item: CommunityThread;
  onDelete: (id: string) => void;
  onPinToggle: (id: string) => void;
  onOpen: (id: string) => void;
  now: number;
};

const CommunityRow = React.memo(({ item, onDelete, onPinToggle, onOpen, now }: RowProps) => {
  const isDark = useColorScheme() === 'dark';
  const translateX = useSharedValue(0);
  const ACTION_WIDTH = 90;

  // Track previous unread to animate when it increases
  const prevUnreadRef = useRef<number>(item.unread ?? 0);
  const justIncreased = (item.unread ?? 0) > prevUnreadRef.current;
  useEffect(() => { prevUnreadRef.current = item.unread ?? 0; }, [item.unread]);

  // Soft pulse background when a new unread arrives
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (justIncreased) {
      pulse.value = 1;
      pulse.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [justIncreased]);

  const isUnread = (item.unread ?? 0) > 0;

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => { if (e.translationX < 0) translateX.value = e.translationX; })
    .onEnd((e) => {
      const shouldSnapOpen = e.translationX < -ACTION_WIDTH / 2 || e.velocityX < -500;
      translateX.value = withSpring(shouldSnapOpen ? -ACTION_WIDTH * 2 : 0, { damping: 15, mass: 0.8 });
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  const animatedRowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // Read highlight styles
  const bgTint = isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.10)';
  const accentBar = isDark ? '#818cf8' : '#6366f1';

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const animatedActionStyle = (inputRange: number[], outputRange: number[]) =>
    useAnimatedStyle(() => ({ transform: [{ scale: interpolate(translateX.value, inputRange, outputRange, 'clamp') }] }));

  const handleDelete = () => { 'worklet'; runOnJS(onDelete)(item.id); };
  const handlePin = () => { 'worklet'; runOnJS(onPinToggle)(item.id); translateX.value = withSpring(0); };

  return (
    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <GestureDetector gesture={pan}>
        <View>
          {/* Right swipe actions */}
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

          {/* Modern Row */}
          <Animated.View style={animatedRowStyle}>
            <Pressable
              className="flex-row items-center px-5 h-[88px]"
              onPress={() => onOpen(item.id)}
              style={{
                backgroundColor: isDark ? '#000000' : '#FFFFFF',
              }}
            >
              {/* Subtle unread indicator */}
              {isUnread && (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    backgroundColor: '#6366F1',
                    borderTopRightRadius: 2,
                    borderBottomRightRadius: 2,
                  }}
                />
              )}

              {/* Subtle pulse overlay */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 3,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
                    borderRadius: 0,
                  },
                  pulseStyle,
                ]}
                pointerEvents="none"
              />

              {/* Modern Avatar */}
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: isDark ? '#18181B' : '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 28 }}>{item.avatar || '🏛️'}</Text>
              </View>

              {/* Content */}
              <View style={{ flex: 1, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? '#18181B' : '#F9FAFB', height: '100%', justifyContent: 'center' }}>
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isDark ? '#FFFFFF' : '#111827',
                        fontSize: 16,
                        fontWeight: isUnread ? '700' : '600',
                        letterSpacing: -0.2,
                      }}
                    >
                      {item.name}
                    </Text>
                    {!!item.memberCount && (
                      <Text style={{ fontSize: 12, color: isDark ? '#71717A' : '#A1A1AA', marginTop: 2 }}>
                        {item.memberCount} members
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      marginLeft: 8,
                      color: isUnread ? (isDark ? '#A1A1AA' : '#71717A') : (isDark ? '#71717A' : '#A1A1AA'),
                      fontWeight: isUnread ? '600' : '500',
                    }}
                  >
                    {timeAgoLabel(item.lastAt, now)}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between mt-0.5">
                  <View className="flex-1">
                    <SmartPreview msg={item.lastMsg} isUnread={isUnread} />
                  </View>
                  {!!item.unread && <UnreadBadge count={item.unread} pulseKey={item.unread} />}
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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<CommunityThread>);

export default function CommunitiesScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { socket, unreadThreads = {}, refreshUnread } = useSocket();
  const { isAuthed, communities: myCommunities } = React.useContext(AuthContext) as any;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [archivedItem, setArchivedItem] = useState<CommunityThread | null>(null);
  const scrollY = useSharedValue(0);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const myCommunityIds = useMemo(
    () => new Set((Array.isArray(myCommunities) ? myCommunities : []).map((c: any) => String(c?._id || c?.id || ''))),
    [myCommunities]
  );

  /* ------------------- Fetch Communities ------------------- */

  /* ------------------- Fetch Communities ------------------- */

  const fetchCommunityThreads = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthed) return [] as CommunityThread[];
    const mine = Array.isArray(myCommunities) ? myCommunities : [];

    const results = await Promise.all(
      mine.map(async (c: any) => {
        const cId = String(c?._id || c?.id || '');
        if (!cId) return null;
        try {
          const { data } = await api.get(`/api/messages/${cId}`, {
            params: { limit: 1, order: 'desc' },
            signal,
          });
          const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          const last = list[0];

          // ✅ FIX: Don't return null if no messages. Use fallback values.
          // if (!last) return null; <--- THIS WAS THE BUG

          const type = last?.type === 'photo' ? 'photo' : last?.type === 'voice' ? 'voice' : 'text';

          // Show real message content OR "No messages yet"
          let content = 'No messages yet';
          if (last) {
            if (type === 'photo') content = '📷 Image';
            else if (type === 'voice') content = '🎤 Voice Memo';
            else {
              const text = String(last.content ?? '');
              if (text.includes('cloudinary.com') || text.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                content = '📷 Image';
              } else {
                content = text;
              }
            }
          }

          // Use message time OR community join/create time
          const lastAt = last
            ? Number(new Date(last.createdAt ?? last.timestamp ?? Date.now()).getTime())
            : Number(new Date(c.createdAt || c.updatedAt || Date.now()).getTime());

          const th: CommunityThread = {
            id: cId,
            name: String(c?.name || 'Community'),
            avatar: '🏛️',
            lastMsg: { type: last ? type : 'text', content },
            lastAt,
            unread: 0,
            pinned: !!c?.pinned,
            memberCount: c?.memberCount || 0,
          };
          return th;
        } catch (err) {
          // ✅ Fallback: If API fails (e.g. 404), still show the community so it's clickable
          console.log(`[Community] Failed to load thread ${cId}`, err);
          return {
            id: cId,
            name: String(c?.name || 'Community'),
            avatar: '🏛️',
            lastMsg: { type: 'text', content: 'Tap to start chatting' },
            lastAt: Number(new Date(c.createdAt || Date.now()).getTime()),
            unread: 0,
            pinned: !!c?.pinned,
            memberCount: c?.memberCount || 0,
          };
        }
      })
    );

    return results.filter(Boolean) as CommunityThread[];
  }, [isAuthed, myCommunities]);

  // Initial load
  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    (async () => {
      const communities = await fetchCommunityThreads(ac.signal);
      await refreshUnread?.();
      setThreads(resortByPinnedAndRecent(communities));
      setIsLoading(false);
    })();
    return () => ac.abort();
  }, [fetchCommunityThreads, refreshUnread]);

  // Keep unread in sync and drive highlight styles
  useEffect(() => {
    if (!threads.length) return;
    setThreads(prev =>
      prev.map(t => ({ ...t, unread: Number(unreadThreads[t.id] ?? 0) || 0 }))
    );
  }, [unreadThreads, threads.length]);

  /* ------------------- Realtime listeners ------------------- */

  useEffect(() => {
    const s = socket;
    if (!s) return;

    const onCommunityMsg = (payload: any) => {
      const cid = String(payload?.communityId || '');
      if (!cid || !myCommunityIds.has(cid)) return;

      let newContent = String(payload?.content ?? '');
      if (payload?.type === 'photo' || newContent.includes('cloudinary.com') || newContent.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        newContent = '📷 Image';
      } else if (payload?.type === 'voice') {
        newContent = '🎤 Voice Memo';
      }

      const newMsg: MessageContent = {
        type: payload?.type === 'photo' ? 'photo' : payload?.type === 'voice' ? 'voice' : 'text',
        content: newContent
      };

      const lastAt = Number(new Date(payload?.createdAt ?? Date.now()).getTime());

      setThreads(prev => {
        const idx = prev.findIndex(t => t.id === cid);
        if (idx >= 0) {
          const copy = [...prev];
          const th = copy[idx];
          copy[idx] = { ...th, lastMsg: newMsg, lastAt };
          return resortByPinnedAndRecent(copy);
        }
        const name = (Array.isArray(myCommunities) ? myCommunities : []).find((c: any) => String(c?._id || c?.id) === cid)?.name || 'Community';
        const added: CommunityThread = {
          id: cid,
          name,
          avatar: '🏛️',
          lastMsg: newMsg,
          lastAt,
          unread: 0,
          pinned: false,
        };
        return resortByPinnedAndRecent([added, ...prev]);
      });
    };

    s.on?.('receive_message', onCommunityMsg);

    return () => {
      s.off?.('receive_message', onCommunityMsg);
    };
  }, [socket, myCommunities, myCommunityIds]);

  /* ------------------- Join rooms ------------------- */

  useEffect(() => {
    const s = socket;
    if (!s) return;

    const joinAll = () => {
      const ids = Array.from(myCommunityIds);
      if (ids.length) s.emit?.('subscribe:communities', { ids });
    };

    joinAll();
    const handleConnect = () => joinAll();
    s.on?.('connect', handleConnect);
    return () => {
      s.off?.('connect', handleConnect);
    };
  }, [socket, myCommunityIds]);

  /* ------------------- UX actions ------------------- */

  const handleArchive = (id: string) => {
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

  const handlePinToggle = (id: string) => {
    setThreads(cur =>
      resortByPinnedAndRecent(
        cur.map(t => (t.id === id ? { ...t, pinned: !t.pinned } : t))
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const openCommunity = (communityId: string) => {
    router.push({ pathname: '/community/[id]', params: { id: communityId } });
  };

  const onRefresh = useCallback(async () => {
    const ac = new AbortController();
    try {
      setIsRefreshing(true);
      const communities = await fetchCommunityThreads(ac.signal);
      await refreshUnread?.();
      setThreads(resortByPinnedAndRecent(communities));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsRefreshing(false);
      ac.abort();
    }
  }, [fetchCommunityThreads, refreshUnread]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Filter threads
  const filteredThreads = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.name.toLowerCase().includes(q));
  }, [threads, debouncedQuery]);

  /* ------------------- Header animation ------------------- */

  const scrollHandler = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  const animatedHeaderStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(scrollY.value, [0, 80], [0, -80], 'clamp') }] }));
  const animatedHeaderTitleStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 20], [1, 0], 'clamp') }));
  const animatedHeaderBorderStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [80, 81], [0, 1], 'clamp') }));

  /* ------------------- Render ------------------- */

  if (isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: isDark ? '#000000' : '#FFFFFF' }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: isDark ? '#FFFFFF' : '#111827', paddingHorizontal: 20, marginTop: 4, marginBottom: 16, letterSpacing: -1 }}>
          Communities
        </Text>
        {[...Array(8)].map((_, i) => (<CommunityRowSkeleton key={i} />))}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#000000' : '#FFFFFF' }}>
      <AnimatedFlatList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommunityRow
            item={item}
            onDelete={handleArchive}
            onPinToggle={handlePinToggle}
            onOpen={openCommunity}
            now={now}
          />
        )}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={isDark ? '#FFF' : '#000'} />}
        contentContainerStyle={{ paddingTop: 200, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-2xl">🏛️</Text>
            <Text style={{ fontWeight: '700', fontSize: 18, marginTop: 8, color: isDark ? '#FFFFFF' : '#111827' }}>
              No Communities
            </Text>
            <Text style={{ color: isDark ? '#71717A' : '#A1A1AA', marginTop: 4, textAlign: 'center', paddingHorizontal: 24, fontSize: 14 }}>
              {searchQuery ? 'No communities match your search' : 'Join a community to get started'}
            </Text>
          </View>
        }
      />

      {/* Modern Frosted Header */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top }, animatedHeaderStyle]} className="px-5 pb-3">
        <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }, animatedHeaderBorderStyle]} />

        <Animated.View style={animatedHeaderTitleStyle}>
          <View className="flex-row items-center justify-between mt-1 mb-4">
            <Text style={{ fontSize: 32, fontWeight: '700', color: isDark ? '#FFFFFF' : '#111827', letterSpacing: -1 }}>
              Communities
            </Text>
          </View>
        </Animated.View>

        {/* Modern Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 44,
            borderWidth: 1,
            borderColor: isDark ? '#27272A' : '#F4F4F5',
          }}
        >
          <Ionicons name="search-outline" size={20} color={isDark ? '#71717A' : '#A1A1AA'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search communities"
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 15,
              color: isDark ? '#FFFFFF' : '#111827',
              fontWeight: '500',
              letterSpacing: 0,
            }}
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
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
              <Text className="text-black dark:text-white font-medium">Community archived</Text>
              <Pressable onPress={handleUndoArchive}><Text className="text-indigo-600 dark:text-indigo-400 font-bold">Undo</Text></Pressable>
            </BlurView>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

/* ───────────────── Sorting helper ───────────────── */
function resortByPinnedAndRecent(list: CommunityThread[]) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.lastAt || 0) - (a.lastAt || 0);
  });
}
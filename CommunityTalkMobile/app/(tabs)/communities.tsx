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
import { Colors, Fonts } from '@/constants/theme';

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

const UnreadBadge = ({ count, pulseKey }: { count: number; pulseKey?: number }) => {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  return (
    <MotiView
      key={pulseKey}
      from={{ scale: 0.8, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 12, mass: 0.6 }}
      style={{
        backgroundColor: Colors.light.danger, // Always red for urgency
        borderRadius: 12,
        height: 20,
        paddingHorizontal: 6,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: theme.background,
        borderWidth: 2,
      }}
    >
      <Text style={{ color: 'white', fontSize: 10, fontFamily: Fonts.bold }}>{count}</Text>
    </MotiView>
  );
};

const SmartPreview = ({ msg, isUnread }: { msg: MessageContent; isUnread: boolean }) => {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  // 600 weight -> Fonts.ios.sans (Medium), 400 -> Regular/Light
  // But isUnread usually implies Bold.

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {msg.type !== 'text' && (
        <Ionicons
          name={(msg.type === 'photo' ? 'image-outline' : 'mic-outline') as any}
          size={14}
          color={isUnread ? theme.primary : theme.textMuted}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        numberOfLines={1}
        style={{
          color: isUnread ? theme.text : theme.textMuted,
          fontFamily: isUnread ? Fonts.sans : Fonts.regular, // Medium if unread
          fontSize: 14,
        }}
      >
        {msg.type !== 'text' ? (msg.type === 'photo' ? 'Photo' : 'Voice Memo') : msg.content}
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
  const ACTION_WIDTH = 80;

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

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.15,
  }));

  const animatedActionStyle = (inputRange: number[], outputRange: number[]) =>
    useAnimatedStyle(() => ({ transform: [{ scale: interpolate(translateX.value, inputRange, outputRange, 'clamp') }] }));

  const handleDelete = () => { 'worklet'; runOnJS(onDelete)(item.id); };
  const handlePin = () => { 'worklet'; runOnJS(onPinToggle)(item.id); translateX.value = withSpring(0); };

  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'timing', duration: 250 }}>
      <GestureDetector gesture={pan}>
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          {/* Right swipe actions */}
          <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' }}>
            {/* Primary Action: Pin */}
            <Pressable onPress={handlePin} style={{ width: 72, height: '100%', backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={animatedActionStyle([-160, -80], [1, 0.5])}>
                <Ionicons name={item.pinned ? 'pin-outline' : 'pin'} size={22} color="white" />
              </Animated.View>
            </Pressable>
            {/* Destructive Action: Delete */}
            <Pressable onPress={handleDelete} style={{ width: 72, height: '100%', backgroundColor: theme.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={animatedActionStyle([-80, 0], [1, 0.5])}>
                <Ionicons name="trash-outline" size={22} color="white" />
              </Animated.View>
            </Pressable>
          </View>

          {/* Modern Premium Card */}
          <Animated.View style={animatedRowStyle}>
            <Pressable
              onPress={() => onOpen(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.surface,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 14,
                // Premium shadow
                shadowColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.05)',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 10,
                elevation: 3,
                borderWidth: isDark ? 1 : 0,
                borderColor: theme.border,
              }}
            >
              {/* Pulse overlay */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: theme.primary,
                    borderRadius: 16,
                  },
                  pulseStyle,
                ]}
                pointerEvents="none"
              />

              {/* Modern Avatar with gradient background */}
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: theme.muted,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Text style={{ fontSize: 26 }}>{item.avatar || '🏛️'}</Text>

                {/* Pinned indicator */}
                {item.pinned && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: theme.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.surface,
                  }}>
                    <Ionicons name="pin" size={10} color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={{ flex: 1 }}>
                {/* Top row: Name + Time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.text,
                        fontSize: 16,
                        fontFamily: isUnread ? Fonts.bold : Fonts.sans, // Bold if unread, Medium otherwise
                        letterSpacing: -0.3,
                        flex: 1,
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      marginLeft: 8,
                      color: isUnread ? theme.primary : theme.textMuted,
                      fontFamily: isUnread ? Fonts.sans : Fonts.regular,
                    }}
                  >
                    {timeAgoLabel(item.lastAt, now)}
                  </Text>
                </View>

                {/* Middle row: Member count */}
                <Text style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  marginBottom: 4,
                  fontFamily: Fonts.regular,
                }}>
                  {item.memberCount || 0} members
                </Text>

                {/* Bottom row: Preview + Unread badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <SmartPreview msg={item.lastMsg} isUnread={isUnread} />
                  </View>
                  {!!item.unread && (
                    <UnreadBadge count={item.unread} pulseKey={item.unread} />
                  )}
                </View>
              </View>

              {/* Chevron */}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.icon}
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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<CommunityThread>);

export default function CommunitiesScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { socket, unreadThreads = {}, refreshUnread, subscribeToLocalMessages } = useSocket();
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

    try {
      const { data } = await api.get('/api/communities/my-threads', { signal });
      const items = data?.items || [];

      // Map to CommunityThread shape if needed, but backend now returns mostly correct shape
      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        avatar: item.avatar || '🏛️',
        lastMsg: item.lastMsg,
        lastAt: item.lastAt,
        unread: item.unread || 0,
        pinned: !!item.pinned,
        memberCount: item.memberCount
      }));
    } catch (err) {
      console.log('[Communities] Batch fetch failed', err);
      return [];
    }
  }, [isAuthed]);

  // INSTANT LOADING: Show cache immediately, refresh in background (Discord/WhatsApp strategy)
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      console.log('[Communities] 🔄 Component mounted, attempting cache load...');

      // 1. Load cache INSTANTLY (0ms perceived load time!)
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        console.log('[Communities] ✅ AsyncStorage imported');

        const cached = await AsyncStorage.getItem('@communities_cache_v1');
        console.log('[Communities] Cache read result:', cached ? `${cached.length} chars` : 'null');

        if (cached) {
          const data = JSON.parse(cached);
          console.log('[Communities] 📦 Loaded from cache:', data.length, 'items');
          setThreads(resortByPinnedAndRecent(data));
          setIsLoading(false); // Show immediately!
        } else {
          console.log('[Communities] ⚠️ No cache found, showing skeleton');
          setIsLoading(true); // First load, show skeleton
        }
      } catch (e) {
        console.error('[Communities] ❌ Cache load failed:', e);
        setIsLoading(true);
      }

      // 2. Fetch fresh data in background (user doesn't wait!)
      console.log('[Communities] 🌐 Fetching fresh data...');
      const communities = await fetchCommunityThreads(ac.signal);
      await refreshUnread?.();

      // 3. Update UI with fresh data
      setThreads(resortByPinnedAndRecent(communities));
      setIsLoading(false);

      // 4. Save to cache for next time (ONLY if we have data!)
      if (communities && communities.length > 0) {
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.setItem('@communities_cache_v1', JSON.stringify(communities));
          console.log('[Communities] 💾 Saved to cache:', communities.length, 'items');
        } catch (e) {
          console.error('[Communities] ❌ Cache save failed:', e);
        }
      } else {
        console.log('[Communities] ⚠️ Skipping cache save (empty data)');
      }
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

  /* ------------------- Local message events (instant update) ------------------- */
  useEffect(() => {
    if (!subscribeToLocalMessages) return;

    const unsubscribe = subscribeToLocalMessages((event: any) => {
      const cid = String(event?.communityId || '');
      if (!cid || !myCommunityIds.has(cid)) return;

      // Immediately update the thread with new message
      const newContent = event.type === 'photo' ? '📷 Image' : String(event.content ?? '');
      const newMsg: MessageContent = {
        type: event.type === 'photo' ? 'photo' : event.type === 'video' ? 'voice' : 'text',
        content: newContent.length > 50 ? newContent.substring(0, 50) + '...' : newContent,
      };

      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === cid);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], lastMsg: newMsg, lastAt: event.timestamp || Date.now() };
          return resortByPinnedAndRecent(copy);
        }
        return prev;
      });
    });

    return unsubscribe;
  }, [subscribeToLocalMessages, myCommunityIds]);

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
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
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
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={21}
        initialNumToRender={10}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.text} />}
        contentContainerStyle={{ paddingTop: 200, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-2xl">🏛️</Text>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 18, marginTop: 8, color: theme.text }}>
              No Communities
            </Text>
            <Text style={{ color: theme.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24, fontSize: 14, fontFamily: Fonts.regular }}>
              {searchQuery ? 'No communities match your search' : 'Join a community to get started'}
            </Text>
          </View>
        }
      />

      {/* Modern Frosted Header */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 12 }, animatedHeaderStyle]}>
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: theme.border }, animatedHeaderBorderStyle]} />

        <Animated.View style={animatedHeaderTitleStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 }}>
            <Text style={{ fontSize: 28, fontFamily: Fonts.bold, color: theme.text, letterSpacing: -0.8 }}>
              Communities
            </Text>
          </View>
        </Animated.View>

        {/* Premium Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 42,
          }}
        >
          <Ionicons name="search" size={18} color={isDark ? '#636366' : '#8E8E93'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search communities..."
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
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ color: theme.text, fontFamily: Fonts.sans }}>Community archived</Text>
              <Pressable onPress={handleUndoArchive}><Text style={{ color: theme.primary, fontFamily: Fonts.bold }}>Undo</Text></Pressable>
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
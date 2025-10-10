// CommunityTalkMobile/app/(tabs)/dms.tsx
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
// LIVE: API + Socket
import { api } from '@/src/api/api';
import { useSocket } from '@/src/context/SocketContext';

// --- Types (UI-shape; we normalize backend to this)
type MessageContent =
  | { type: 'text'; content: string }
  | { type: 'photo'; content: 'Photo' }
  | { type: 'voice'; content: 'Voice Memo' };

type DM = {
  id: string;              // partnerId
  name: string;
  avatar: string;          // keep emoji avatar for look
  lastMsg: MessageContent;
  time: string;            // short label
  unread?: number;
  online?: boolean;
  typing?: boolean;
  pinned?: boolean;
};

type ActiveUser = { id: string; name: string; avatar: string };

const FILTERS = ['All', 'Unread', 'Pinned', 'Work', 'Friends'] as const;

/* ───────────────── UI Pieces ───────────────── */

const ShimmeringView = ({
  children,
  isDark,
}: {
  children: ReactNode;
  isDark: boolean;
}): React.JSX.Element => {
  const translateX = useSharedValue(-300);
  useEffect(() => {
    translateX.value = withRepeat(withTiming(300, { duration: 1000 }), -1);
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  return (
    <View style={{ backgroundColor: isDark ? '#27272a' : '#e5e7eb', overflow: 'hidden' }}>
      <Animated.View
        style={[{ width: '100%', height: '100%', position: 'absolute' }, animatedStyle]}
      >
        <LinearGradient
          colors={[
            'transparent',
            isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            'transparent',
          ]}
          style={{ width: '100%', height: '100%' }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </Animated.View>
      {children}
    </View>
  );
};

const DMRowSkeleton = (): React.JSX.Element => {
  const isDark = useColorScheme() === 'dark';
  return (
    <View className="flex-row items-center gap-4 px-4 h-[93px]">
      <ShimmeringView isDark={isDark}>
        <View className="w-14 h-14 rounded-full" />
      </ShimmeringView>
      <View className="flex-1">
        <ShimmeringView isDark={isDark}>
          <View className="w-3/4 h-4 rounded-md mb-2" />
        </ShimmeringView>
        <ShimmeringView isDark={isDark}>
          <View className="w-1/2 h-3 rounded-md" />
        </ShimmeringView>
      </View>
    </View>
  );
};

const UnreadBadge = ({ count }: { count: number }): React.JSX.Element => (
  <MotiView
    from={{ scale: 0.5 }}
    animate={{ scale: 1 }}
    transition={{ type: 'spring' }}
    onDidAnimate={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    className="bg-indigo-600 rounded-full h-6 w-6 items-center justify-center border-2 border-white dark:border-black"
  >
    <Text className="text-white text-xs font-bold">{count}</Text>
  </MotiView>
);

const TypingIndicator = (): React.JSX.Element => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-black"
      style={animatedStyle}
    />
  );
};

const SmartPreview = ({ msg }: { msg: MessageContent }): React.JSX.Element => {
  const isDark = useColorScheme() === 'dark';
  if (msg.type === 'text') {
    return (
      <Text className="text-slate-600 dark:text-zinc-400" numberOfLines={1}>
        {msg.content}
      </Text>
    );
  }
  return (
    <View className="flex-row items-center gap-1.5 bg-slate-200 dark:bg-zinc-800 self-start px-2 py-1 rounded-lg">
      <Ionicons
        name={(msg.type === 'photo' ? 'camera-outline' : 'mic-outline') as any}
        size={14}
        color={isDark ? '#FFF' : '#000'}
        style={{ opacity: 0.6 }}
      />
      <Text className="text-xs font-medium text-slate-600 dark:text-zinc-300">
        {msg.content}
      </Text>
    </View>
  );
};

/* ───────────────── Row ───────────────── */

type DMRowProps = {
  item: DM;
  onDelete: (id: string) => void;
  onPinToggle: (id: string) => void;
  onOpen: (partnerId: string) => void;
};

const DMRow = React.memo(
  ({ item, onDelete, onPinToggle, onOpen }: DMRowProps): React.JSX.Element => {
    const translateX = useSharedValue(0);
    const ACTION_WIDTH = 90;

    const pan = Gesture.Pan()
      .activeOffsetX([-20, 20])
      .onUpdate((e) => {
        if (e.translationX < 0) translateX.value = e.translationX;
      })
      .onEnd((e) => {
        const shouldSnapOpen = e.translationX < -ACTION_WIDTH / 2 || e.velocityX < -500;
        translateX.value = withSpring(shouldSnapOpen ? -ACTION_WIDTH * 2 : 0, {
          damping: 15,
          mass: 0.8,
        });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      });

    const animatedRowStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));
    const animatedActionStyle = (inputRange: number[], outputRange: number[]) =>
      useAnimatedStyle(() => ({
        transform: [
          { scale: interpolate(translateX.value, inputRange, outputRange, 'clamp') },
        ],
      }));

    const handleDelete = () => {
      'worklet';
      runOnJS(onDelete)(item.id);
    };
    const handlePin = () => {
      'worklet';
      runOnJS(onPinToggle)(item.id);
      translateX.value = withSpring(0);
    };

    return (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ type: 'timing', duration: 300 }}
      >
        <GestureDetector gesture={pan}>
          <View>
            <View className="absolute right-0 top-0 bottom-0 flex-row">
              <Pressable
                onPress={handlePin}
                className="w-[90px] h-full bg-indigo-600 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={
                  item.pinned ? `Unpin chat with ${item.name}` : `Pin chat with ${item.name}`
                }
              >
                <Animated.View style={animatedActionStyle([-180, -90], [1, 0.5])}>
                  <Ionicons name={item.pinned ? 'pin-outline' : 'pin'} size={24} color="white" />
                </Animated.View>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="w-[90px] h-full bg-red-600 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={`Delete chat with ${item.name}`}
              >
                <Animated.View style={animatedActionStyle([-90, 0], [1, 0.5])}>
                  <Ionicons name="trash" size={24} color="white" />
                </Animated.View>
              </Pressable>
            </View>

            <Animated.View style={animatedRowStyle}>
              <Pressable
                className="flex-row items-center gap-4 px-4 bg-white dark:bg-black h-[93px]"
                onPress={() => onOpen(item.id)}
              >
                <View>
                  <View className="w-14 h-14 rounded-full items-center justify-center overflow-hidden">
                    {item.online && (
                      <LinearGradient
                        colors={['#8B5CF6', '#EC4899']}
                        className="absolute inset-0"
                      />
                    )}
                    <View className="w-[52px] h-[52px] rounded-full bg-slate-200 dark:bg-zinc-800 items-center justify-center">
                      <Text className="text-3xl">{item.avatar}</Text>
                    </View>
                  </View>
                  {item.typing && (
                    <View className="absolute bottom-0 right-0">
                      <TypingIndicator />
                    </View>
                  )}
                </View>

                <View className="flex-1 py-4 border-b border-slate-100 dark:border-zinc-800 h-full justify-center">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-bold text-black dark:text-white">
                      {item.name}
                    </Text>
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
  }
);

/* ───────────────── Main Screen ───────────────── */

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<DM>);

export default function DMListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { socket, unreadThreads = {}, refreshUnread, markThreadRead } = useSocket();
  const { isAuthed } = React.useContext(AuthContext) as any;

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dms, setDms] = useState<DM[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All');
  const [archivedItem, setArchivedItem] = useState<DM | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const scrollY = useSharedValue(0);

  // ⛔️ DO NOT depend on unreadThreads here (prevents render loop).
  const fetchThreads = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthed) {
      setDms([]);
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/api/direct-messages', { signal });
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const normalized: DM[] = list.map((t: any): DM => {
        const last = t?.lastMessage ?? {};
        const type =
          last?.type && (last.type === 'photo' || last.type === 'voice') ? last.type : 'text';
        const content =
          type === 'text'
            ? String(last?.content ?? '')
            : (type === 'photo' ? 'Photo' : 'Voice Memo');

        const id = String(t.partnerId ?? t.id ?? '');
        return {
          id,
          name: String(t.partnerName ?? t.fullName ?? 'Unknown'),
          avatar: t.avatarEmoji || t.avatar || '🗣️',
          lastMsg: { type, content } as MessageContent,
          time: shortTime(t?.lastTimestamp ?? last?.createdAt),
          unread: 0, // applied later from unreadThreads
          online: !!t.online,
          typing: !!t.typing,
          pinned: !!t.pinned,
        };
      });
      setDms(normalized);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setDms([]);
      } else {
        console.log('[dms] fetchThreads error:', err?.message || err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthed]);

  // Initial load (threads + unread), with abort on unmount
  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    Promise.all([fetchThreads(ac.signal), refreshUnread?.()]).finally(() => {
      // fetchThreads handles isLoading in its finally
    });
    return () => ac.abort();
  }, [fetchThreads, refreshUnread]);

  // Keep unread badges in sync with SocketContext
  useEffect(() => {
    if (!dms.length) return;
    setDms((prev) =>
      prev.map((dm) => ({
        ...dm,
        unread: Number(unreadThreads[dm.id] ?? 0) || 0,
      }))
    );
  }, [unreadThreads, dms.length]);

  // Realtime socket events
  useEffect(() => {
    const s = socket;
    if (!s) return;

    const onIncoming = (payload: any) => {
      const from = String(payload?.from || '');
      if (!from) return;

      setDms((prev) => {
        const idx = prev.findIndex((x) => x.id === from);
        const newMsg: DM['lastMsg'] =
          payload?.type === 'photo'
            ? { type: 'photo', content: 'Photo' }
            : payload?.type === 'voice'
            ? { type: 'voice', content: 'Voice Memo' }
            : { type: 'text', content: String(payload?.content ?? '') };

        if (idx >= 0) {
          const copy = [...prev];
          const existing = copy[idx];
          copy[idx] = {
            ...existing,
            lastMsg: newMsg,
            time: shortTime(payload?.createdAt),
            unread: (existing.unread ?? 0) + 1, // optimistic bump
          };
          return resortPinned(copy);
        } else {
          const added: DM = {
            id: from,
            name: payload?.fromName || 'Unknown',
            avatar: '🗣️',
            lastMsg: newMsg,
            time: shortTime(payload?.createdAt),
            unread: 1,
            online: true,
            typing: false,
            pinned: false,
          };
          return resortPinned([added, ...prev]);
        }
      });
    };

    const onPresence = (payload: any) => {
      const uid = String(payload?.userId || '');
      if (!uid) return;
      setDms((prev) => prev.map((dm) => (dm.id === uid ? { ...dm, online: !!payload.online } : dm)));

      setActiveUsers((prev) => {
        const exists = prev.some((u) => u.id === uid);
        const user: ActiveUser = { id: uid, name: payload?.name ?? 'User', avatar: '🟢' };
        if (payload?.online) {
          return exists ? prev : [user, ...prev].slice(0, 12);
        } else {
          return prev.filter((u) => u.id !== uid);
        }
      });
    };

    const onTyping = (payload: any) => {
      const from = String(payload?.from || '');
      if (!from) return;
      setDms((prev) => prev.map((dm) => (dm.id === from ? { ...dm, typing: !!payload.typing } : dm)));
    };

    s.on?.('receive_direct_message', onIncoming);
    s.on?.('presence:update', onPresence);
    s.on?.('typing', onTyping);

    return () => {
      s.off?.('receive_direct_message', onIncoming);
      s.off?.('presence:update', onPresence);
      s.off?.('typing', onTyping);
    };
  }, [socket]);

  // Pull to refresh (abortable)
  const onRefresh = useCallback(async () => {
    const ac = new AbortController();
    try {
      setIsRefreshing(true);
      await Promise.all([fetchThreads(ac.signal), refreshUnread?.()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsRefreshing(false);
      ac.abort();
    }
  }, [fetchThreads, refreshUnread]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Sections + Filters
  const sections = useMemo(() => {
    let filtered = dms.filter((d) =>
      d.name.toLowerCase().includes(debouncedQuery.trim().toLowerCase())
    );
    if (activeFilter === 'Unread') filtered = filtered.filter((d) => d.unread);
    if (activeFilter === 'Pinned') filtered = filtered.filter((d) => d.pinned);

    const pinned = filtered.filter((d) => d.pinned);
    const recents = filtered.filter((d) => !d.pinned);
    return [
      { title: 'Pinned', data: pinned },
      { title: 'Recents', data: recents },
    ].filter((s) => s.data.length > 0);
  }, [dms, debouncedQuery, activeFilter]);

  // Archive (local)
  const handleArchive = (id: string) => {
    const itemToArchive = dms.find((dm) => dm.id === id);
    if (itemToArchive) {
      setArchivedItem(itemToArchive);
      setDms((cur) => cur.filter((dm) => dm.id !== id));
      setTimeout(() => setArchivedItem(null), 4000);
    }
  };

  const handleUndoArchive = () => {
    if (archivedItem) {
      setDms((cur) => resortPinned([archivedItem!, ...cur]));
      setArchivedItem(null);
    }
  };

  // Pin/unpin (local)
  const handlePinToggle = (id: string) => {
    setDms((cur) => resortPinned(cur.map((dm) => (dm.id === id ? { ...dm, pinned: !dm.pinned } : dm))));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Open a thread: mark read then navigate (keep same route for now)
  const handleOpenThread = async (partnerId: string) => {
    await markThreadRead?.(partnerId);
    setDms((cur) => cur.map((dm) => (dm.id === partnerId ? { ...dm, unread: 0 } : dm)));
    router.push('/(tabs)/dms');
  };

  // Header animations
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [0, -80], 'clamp') }],
  }));
  const animatedHeaderTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20], [1, 0], 'clamp'),
  }));
  const animatedHeaderActiveRail = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 50], [1, 0], 'clamp'),
  }));
  const animatedHeaderBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 81], [0, 1], 'clamp'),
  }));

  // Skeleton on first load
  if (isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }} className="bg-white dark:bg-black">
        <Text className="text-3xl font-extrabold text-black dark:text-white px-4 mt-2 mb-4">
          Messages
        </Text>
        {[...Array(8)].map((_, i) => (
          <DMRowSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#000' : '#F3F4F6' }}>
      <AnimatedSectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: DM }) => (
          <DMRow
            item={item}
            onDelete={handleArchive}
            onPinToggle={handlePinToggle}
            onOpen={handleOpenThread}
          />
        )}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#FFF' : '#000'}
          />
        }
        renderSectionHeader={({ section }: { section: SectionListData<DM> }) => (
          <View className="bg-neutral-100 dark:bg-black pt-4 pb-2">
            <Text className="font-bold text-slate-500 dark:text-zinc-400 px-4">
              {section.title}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingTop: 240, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-2xl">📪</Text>
            <Text className="font-bold text-lg mt-2 text-black dark:text-white">
              All clear!
            </Text>
            <Text className="text-slate-500 dark:text-zinc-400 mt-1">
              Your inbox is empty.
            </Text>
          </View>
        }
      />

      {/* Frosted header */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top },
          animatedHeaderStyle,
        ]}
        className="px-4 pb-2"
      >
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
            animatedHeaderBorderStyle,
          ]}
        />
        <Animated.View style={animatedHeaderTitleStyle}>
          <View className="flex-row items-center justify-between mt-2 mb-4">
            <Text className="text-3xl font-extrabold text-black dark:text-white">Messages</Text>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-200/80 dark:bg-zinc-800/80"
              accessibilityRole="button"
              accessibilityLabel="New Message"
              onPress={() => router.push('/(tabs)/dms')}
            >
              <IconSymbol name="plus" size={18} color={isDark ? '#FFF' : '#000'} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Online reel */}
        <Animated.View style={animatedHeaderActiveRail}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={activeUsers}
            keyExtractor={(item: ActiveUser) => item.id}
            renderItem={({ item }: { item: ActiveUser }) => (
              <View className="items-center">
                <View className="w-16 h-16 rounded-full bg-slate-200/80 dark:bg-zinc-800/80 items-center justify-center">
                  <Text className="text-3xl">{item.avatar}</Text>
                </View>
                <Text className="text-xs mt-1 text-slate-500 dark:text-zinc-400">
                  {item.name}
                </Text>
              </View>
            )}
            contentContainerStyle={{ gap: 12, paddingVertical: 10 }}
          />
        </Animated.View>

        {/* Search + Filters */}
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
                onPress={() => {
                  setActiveFilter(item as (typeof FILTERS)[number]);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`px-4 py-2 rounded-lg ${
                  activeFilter === item
                    ? 'bg-indigo-600'
                    : 'bg-slate-200/50 dark:bg-zinc-800/50'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    activeFilter === item
                      ? 'text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {item}
                </Text>
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
            style={{
              position: 'absolute',
              bottom: insets.bottom + 10,
              left: 20,
              right: 20,
            }}
          >
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              className="flex-row items-center justify-between p-3 rounded-xl overflow-hidden border border-black/10 dark:border-white/10"
            >
              <Text className="text-black dark:text-white font-medium">Chat archived</Text>
              <Pressable onPress={handleUndoArchive}>
                <Text className="text-indigo-600 dark:text-indigo-400 font-bold">Undo</Text>
              </Pressable>
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

function resortPinned(list: DM[]) {
  return [...list].sort((a, b) => {
    if (!!a.pinned === !!b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });
}
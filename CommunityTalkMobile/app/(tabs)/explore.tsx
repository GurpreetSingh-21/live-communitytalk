// app/(tabs)/explore.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSocket } from '@/src/context/SocketContext';
import { AuthContext } from '@/src/context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '@/src/api/api';

type EventItem = {
  _id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  collegeId: string;
  faithId: string;
  communityId?: string | null;
  cover?: string;
  tags?: string[];
  location?: { kind: 'in-person' | 'online'; address?: string; url?: string };
  createdAt?: string;
  updatedAt?: string;
};

// survive remounts: only first focus per scope fetches
const fetchedScopes: Record<string, boolean> = {};

export default function ExploreScreen() {
  const { top } = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { socket } = (useSocket() ?? {}) as { socket?: any };
  const { isAuthed, user } = React.useContext(AuthContext) as any;

  // scope from backend
  const collegeKey = user?.collegeSlug ?? null;
  const faithKey   = user?.religionKey ?? null;
  const scopeKey = `${Boolean(isAuthed)}:${collegeKey ?? ''}:${faithKey ?? ''}`;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemsState, _setItems] = useState<EventItem[]>([]);

  // refs (single source of truth in callbacks)
  const itemsRef   = useRef<EventItem[]>([]);
  const cursorRef  = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const fetchingRef = useRef(false);
  const pagingReadyRef = useRef(false);
  const scopedFetchedRef = useRef<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const setItems = (next: EventItem[]) => { itemsRef.current = next; _setItems(next); };
  const setCursor = (next: string | null) => { cursorRef.current = next; };
  const setHasMore = (next: boolean) => { hasMoreRef.current = next; };

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [scopeKey]);

  // core fetcher (kept robust; no logs)
  const doFetch = useCallback(async (opts: { reset?: boolean } = {}) => {
    if (fetchingRef.current) return;
    if (!isAuthed || !collegeKey || !faithKey) { setLoading(false); setRefreshing(false); return; }
    fetchingRef.current = true;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      if (opts.reset) {
        setItems([]);
        setCursor(null);
        setHasMore(false);
        pagingReadyRef.current = false;
      }
      setError(null);
      if (opts.reset || itemsRef.current.length === 0) setLoading(true);

      const params: any = { limit: 20 };
      if (!opts.reset && cursorRef.current) params.cursor = cursorRef.current;

      const { data } = await api.get('/api/events', {
        params,
        signal: abortRef.current.signal,
      });

      const list: EventItem[] = Array.isArray(data?.items) ? data.items : [];
      setItems(opts.reset ? list : [...itemsRef.current, ...list]);
      setCursor(data?.nextCursor ?? null);
      setHasMore(Boolean(data?.hasMore));
      pagingReadyRef.current = true;
    } catch (e: any) {
      const canceled = e?.name === 'CanceledError' || e?.message === 'canceled';
      if (!canceled) {
        const msg = e?.response?.data?.error || 'Failed to load events';
        setError(msg);
        if (itemsRef.current.length > 0) pagingReadyRef.current = true;
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      fetchingRef.current = false;
    }
  }, [isAuthed, collegeKey, faithKey]);

  const fetchReset = useCallback(() => doFetch({ reset: true }), [doFetch]);
  const fetchNext  = useCallback(() => doFetch({ reset: false }), [doFetch]);

  // fetch exactly once per scope while focused
  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthed || !collegeKey || !faithKey) { setLoading(false); return; }
      if (!fetchedScopes[scopeKey] && !scopedFetchedRef.current[scopeKey]) {
        fetchedScopes[scopeKey] = true;
        scopedFetchedRef.current[scopeKey] = true;
        fetchReset();
      } else {
        setLoading(false);
      }
      return () => {};
    }, [scopeKey, isAuthed, collegeKey, faithKey, fetchReset])
  );

  // socket live updates (no refetch)
  useEffect(() => {
    if (!socket || !isAuthed || !collegeKey || !faithKey) return;
    const room = `college:${collegeKey}:faith:${faithKey}`;
    socket.emit?.('events:join', { room });

    const onCreated = (e: EventItem) => setItems([e, ...itemsRef.current]);
    const onUpdated = (e: EventItem) =>
      setItems(itemsRef.current.map(x => (x._id === e._id ? { ...x, ...e } : x)));
    const onDeleted = ({ eventId, id }: { eventId?: string; id?: string }) =>
      setItems(itemsRef.current.filter(x => x._id !== (eventId ?? id)));

    socket.on?.('events:created', onCreated);
    socket.on?.('events:updated', onUpdated);
    socket.on?.('events:deleted', onDeleted);

    return () => {
      socket.emit?.('events:leave', { room });
      socket.off?.('events:created', onCreated);
      socket.off?.('events:updated', onUpdated);
      socket.off?.('events:deleted', onDeleted);
    };
  }, [socket, isAuthed, collegeKey, faithKey]);

  // pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReset();
  }, [fetchReset]);

  // scroll anim (optional)
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // --------- UI pieces (2025 modern look) ---------
  const EventCard = ({ e }: { e: EventItem }) => {
    const start = new Date(e.startsAt);
    const dateStr = start.toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    return (
      <Pressable
        className="mx-4 mb-5 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/90"
        style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
      >
        <View className="relative w-full" style={{ height: 160 }}>
          {e.cover ? (
            <Image source={{ uri: e.cover }} style={{ height: '100%', width: '100%' }} />
          ) : (
            <LinearGradient
              colors={isDark ? ['#0B0B0E', '#16181D'] : ['#EEF2FF', '#E0E7FF']}
              style={{ height: '100%', width: '100%' }}
            />
          )}
          <View className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1.5 dark:bg-white/15">
            <Text className="text-xs font-semibold text-white dark:text-zinc-100" numberOfLines={1}>
              {e.location?.kind === 'online' ? 'Online' : e.location?.address ? e.location.address : 'In person'}
            </Text>
          </View>
        </View>

        <View className="p-4">
          <Text className="mb-1 text-xl font-extrabold tracking-tight text-black dark:text-white" numberOfLines={2}>
            {e.title}
          </Text>
          <Text className="text-[13px] text-slate-600 dark:text-slate-400" numberOfLines={2}>
            {dateStr}
          </Text>

          {!!e.tags?.length && (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {e.tags.slice(0, 3).map((t) => (
                <View key={t} className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-zinc-800/80">
                  <Text className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{t}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="mt-4 flex-row items-center">
            <Ionicons name="school" size={16} color={isDark ? '#a1a1aa' : '#64748b'} />
            <Text className="ml-1 text-[13px] text-slate-600 dark:text-slate-400" numberOfLines={1}>
              {e.collegeId}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const Header = (
    <View className="mb-2">
      <LinearGradient
        colors={isDark ? ['#0f1115', '#090a0f'] : ['#f8fafc', '#eef2ff']}
        style={{ paddingTop: top + 18, paddingBottom: 18 }}
      >
        <View className="px-4">
          <Text className="text-4xl font-extrabold leading-tight text-black dark:text-white">
            What’s happening
          </Text>
          <Text className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            For your campus & faith community
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const Empty = !loading ? (
    <View className="items-center py-24">
      <LinearGradient
        colors={isDark ? ['#0f1115', '#0b0d12'] : ['#f1f5f9', '#e2e8f0']}
        style={{ height: 96, width: 96, borderRadius: 24, marginBottom: 16 }}
      />
      <Text className="text-lg font-bold text-black dark:text-white">Nothing scheduled yet</Text>
      <Text className="mt-1 text-slate-500 dark:text-slate-400">Check back soon.</Text>
    </View>
  ) : null;

  return (
    <View style={{ paddingTop: top, flex: 1 }} className="bg-slate-100 dark:bg-zinc-950">
      {loading && !itemsState.length ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <Animated.FlatList
          data={itemsState}
          keyExtractor={(e) => e._id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => <EventCard e={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.25}
          onEndReached={() => {
            if (!pagingReadyRef.current) return;
            if (loading || refreshing) return;
            if (fetchingRef.current) return;
            if (!hasMoreRef.current) return;
            if (itemsRef.current.length === 0) return;
            fetchNext();
          }}
          ListEmptyComponent={Empty}
          ListHeaderComponent={Header}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 28 }}
          initialNumToRender={6}
          removeClippedSubviews
        />
      )}
      {!!error && (
        <View className="absolute bottom-6 left-4 right-4 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-900/20">
          <Text className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</Text>
        </View>
      )}
    </View>
  );
}
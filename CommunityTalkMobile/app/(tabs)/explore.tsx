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
import { Colors, Fonts } from '@/constants/theme';

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
  const theme = isDark ? Colors.dark : Colors.light;
  const { socket } = (useSocket() ?? {}) as { socket?: any };
  const { isAuthed, user } = React.useContext(AuthContext) as any;

  // scope from backend
  const collegeKey = user?.collegeSlug ?? null;
  const faithKey = user?.religionKey ?? null;
  const scopeKey = `${Boolean(isAuthed)}:${collegeKey ?? ''}:${faithKey ?? ''}`;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemsState, _setItems] = useState<EventItem[]>([]);

  // refs (single source of truth in callbacks)
  const itemsRef = useRef<EventItem[]>([]);
  const cursorRef = useRef<string | null>(null);
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
  const fetchNext = useCallback(() => doFetch({ reset: false }), [doFetch]);

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
      return () => { };
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
        style={{
          marginHorizontal: 16,
          marginBottom: 20,
          overflow: 'hidden',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2
        }}
      >
        <View style={{ height: 160, width: '100%' }}>
          {e.cover ? (
            <Image source={{ uri: e.cover }} style={{ height: '100%', width: '100%' }} />
          ) : (
            <LinearGradient
              colors={[theme.muted, theme.border]}
              style={{ height: '100%', width: '100%' }}
            />
          )}
          <View style={{ position: 'absolute', left: 12, top: 12, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: '#FFF' }} numberOfLines={1}>
              {e.location?.kind === 'online' ? 'Online' : e.location?.address ? e.location.address : 'In person'}
            </Text>
          </View>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={{ marginBottom: 4, fontSize: 20, fontFamily: Fonts.bold, letterSpacing: -0.5, color: theme.text }} numberOfLines={2}>
            {e.title}
          </Text>
          <Text style={{ fontSize: 13, color: theme.textMuted, fontFamily: Fonts.regular }} numberOfLines={2}>
            {dateStr}
          </Text>

          {!!e.tags?.length && (
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {e.tags.slice(0, 3).map((t) => (
                <View key={t} style={{ borderRadius: 999, backgroundColor: theme.muted, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: theme.textMuted }}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="school" size={16} color={theme.icon} />
            <Text style={{ marginLeft: 6, fontSize: 13, color: theme.textMuted, fontFamily: Fonts.regular }} numberOfLines={1}>
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
        colors={[theme.background, theme.background]} // Or gradient if needed, keeping simple matching background for now to look seamless
        style={{ paddingTop: top + 18, paddingBottom: 18 }}
      >
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 36, fontFamily: Fonts.bold, lineHeight: 40, color: theme.text }}>
            What’s happening
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: theme.textMuted, fontFamily: Fonts.regular }}>
            For your campus & faith community
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const Empty = !loading ? (
    <View style={{ alignItems: 'center', paddingVertical: 96 }}>
      <LinearGradient
        colors={[theme.muted, theme.border]}
        style={{ height: 96, width: 96, borderRadius: 24, marginBottom: 16 }}
      />
      <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: theme.text }}>Nothing scheduled yet</Text>
      <Text style={{ marginTop: 4, color: theme.textMuted, fontFamily: Fonts.regular }}>Check back soon.</Text>
    </View>
  ) : null;

  return (
    <View style={{ paddingTop: top, flex: 1, backgroundColor: theme.background }}>
      {loading && !itemsState.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <Animated.FlatList
          data={itemsState}
          keyExtractor={(e) => e._id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => <EventCard e={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
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
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 28 }}
          initialNumToRender={6}
          removeClippedSubviews
        />
      )}
      {!!error && (
        <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.danger + '40', backgroundColor: theme.surface, padding: 12 }}>
          <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: theme.danger }}>{error}</Text>
        </View>
      )}
    </View>
  );
}
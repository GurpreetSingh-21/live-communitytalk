// CommunityTalkMobile/app/(tabs)/profile.tsx
import React from 'react';
import {
  Pressable,
  View,
  Text,
  SectionList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useColorScheme as useDeviceColorScheme,
  type SectionListRenderItemInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// LIVE: auth + api + socket
import { AuthContext } from '@/src/context/AuthContext';
import { api } from '@/src/api/api';
import { useSocket } from '@/src/context/SocketContext';

/* ───────────────── types ───────────────── */
type ProfileData = {
  type: 'profile';
  name: string;
  isVerified: boolean;
  avatar?: string | null;
  stats: { communities: number; messages: number; connections: number };
};

type SettingRowData = {
  type: 'setting';
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  badge?: string;
  screen: string;
};

type QuickActionData = {
  type: 'quick_action';
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  screen: string;
};

type LogoutData = { type: 'logout'; title: 'Log Out'; icon: React.ComponentProps<typeof Ionicons>['name'] };

type SectionItem = ProfileData | SettingRowData | QuickActionData | LogoutData;
type SectionData = { title: string; data: SectionItem[] };

/* ─────────── static scaffold (we’ll mutate with live data) ─────────── */
const buildSections = (profile: ProfileData, notificationsBadge?: string): SectionData[] => [
  { title: 'Profile', data: [profile] },
  {
    title: 'Settings',
    data: [
      {
        type: 'setting',
        title: 'Account Settings',
        icon: 'person-circle-outline',
        screen: '/profile/account',
      },
      {
        type: 'setting',
        title: 'Notifications',
        icon: 'notifications-outline',
        badge: notificationsBadge,
        screen: '/profile/notifications',
      },
      {
        type: 'setting',
        title: 'Privacy & Security',
        icon: 'shield-checkmark-outline',
        screen: '/profile/security',
      },
      {
        type: 'setting',
        title: 'Help & Support',
        icon: 'help-circle-outline',
        screen: '/profile/help',
      },
    ],
  },
  {
    title: 'Quick Actions',
    data: [
      {
        type: 'quick_action',
        title: 'View Landing',
        icon: 'color-wand-outline',
        color: '#8B5CF6',
        screen: '/landing',
      },
      {
        type: 'quick_action',
        title: 'Your Activity',
        icon: 'stats-chart-outline',
        color: '#10B981',
        screen: '/profile/activity',
      },
      {
        type: 'quick_action',
        title: 'Invite Friends',
        icon: 'person-add-outline',
        color: '#3B82F6',
        screen: '/profile/invite',
      },
    ],
  },
  {
    title: 'Danger Zone',
    data: [
      {
        type: 'logout',
        title: 'Log Out',
        icon: 'log-out-outline',
      },
    ],
  },
];

/* ─────────── UI cells ─────────── */
const ProfileHeader = ({
  item,
  scrollY,
  isDark,
  insets,
}: {
  item: ProfileData;
  scrollY: SharedValue<number>;
  isDark: boolean;
  insets: EdgeInsets;
}) => {
  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [-200, 0], [-50, 0], 'clamp') }],
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], 'clamp'),
  }));
  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [-200, 0], [1.5, 1], 'clamp') }],
  }));

  const gradientColors = isDark ? (['#581c87', '#1e293b'] as const) : (['#f5f3ff', '#e0e7ff'] as const);

  // initials from name, fallback CT
  const initials =
    item.name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2) || 'CT';

  return (
    <View className="mb-6 overflow-hidden">
      <Animated.View style={animatedBackgroundStyle} className="absolute inset-0">
        <LinearGradient colors={gradientColors} className="w-full h-full" />
      </Animated.View>

      <Animated.View
        style={[
          animatedContentStyle,
          { paddingTop: insets.top + 80, paddingBottom: 32, paddingHorizontal: 24 },
        ]}
        className="items-center"
      >
        <View className="h-20 w-20 rounded-3xl items-center justify-center shadow-lg mb-4 border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/20">
          <Text className="font-black text-3xl tracking-tighter text-gray-700 dark:text-white">
            {initials}
          </Text>
        </View>

        <Text className="text-2xl font-bold shadow-sm text-gray-900 dark:text-white">
          {item.name}
        </Text>

        <View className="flex-row justify-center items-center mt-6 gap-6 p-4 rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
          <View className="items-center px-2">
            <Text className="font-bold text-lg text-gray-900 dark:text-white">
              {item.stats.communities}
            </Text>
            <Text className="text-xs text-gray-600 dark:text-slate-300">Communities</Text>
          </View>
          <View className="w-px h-6 bg-black/10 dark:bg-white/20" />
          <View className="items-center px-2">
            <Text className="font-bold text-lg text-gray-900 dark:text-white">
              {item.stats.messages}
            </Text>
            <Text className="text-xs text-gray-600 dark:text-slate-300">Messages</Text>
          </View>
          <View className="w-px h-6 bg-black/10 dark:bg-white/20" />
          <View className="items-center px-2">
            <Text className="font-bold text-lg text-gray-900 dark:text-white">
              {item.stats.connections}
            </Text>
            <Text className="text-xs text-gray-600 dark:text-slate-300">Connections</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const SettingsRow = ({ item, isDark }: { item: SettingRowData; isDark: boolean }) => {
  const handlePress = () => router.push(item.screen as any);
  const iconColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center justify-between p-4 bg-white dark:bg-zinc-900"
    >
      <View className="flex-row items-center gap-4">
        <View className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 items-center justify-center">
          <Ionicons name={item.icon} size={18} color={iconColor} />
        </View>
        <Text className="font-semibold text-base text-black dark:text-white">{item.title}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {item.badge && (
          <View
            className={`px-2 py-0.5 rounded-full ${
              item.badge === 'Required'
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-indigo-100 dark:bg-indigo-900/30'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                item.badge === 'Required'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {item.badge}
            </Text>
          </View>
        )}
        <Ionicons
          name="chevron-forward-outline"
          size={18}
          color={isDark ? '#71717a' : '#9ca3af'}
        />
      </View>
    </Pressable>
  );
};

const QuickActionsRow = ({ items, isDark }: { items: QuickActionData[]; isDark: boolean }) => (
  <View className="flex-row gap-3 mx-4">
    {items.map((item) => (
      <Pressable
        key={item.title}
        onPress={() => router.push(item.screen as any)}
        className="flex-1 bg-white dark:bg-zinc-900 p-4 rounded-2xl items-center shadow-sm"
      >
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : (`${item.color}1A` as any),
          }}
          className="w-12 h-12 rounded-lg items-center justify-center mb-2"
        >
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <Text className="font-semibold text-sm text-center text-black dark:text-white">
          {item.title}
        </Text>
      </Pressable>
    ))}
  </View>
);

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList<SectionItem, SectionData>,
);

/* ─────────── screen ─────────── */
export default function ProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === 'dark';

  // Auth
  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.user;
  const logout = auth?.signOut;

  // Socket (safe even if provider missing → defaults)
  const { unreadDMs = 0, socket = null } = useSocket() ?? {};

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileData>({
    type: 'profile',
    name: 'Student Name',
    isVerified: true,
    stats: { communities: 0, messages: 0, connections: 0 },
  });

  // INITIAL + PULL REFRESH: try /api/bootstrap then fall back to /api/profile
  const load = React.useCallback(async () => {
    try {
      let data: any | null = null;

      try {
        const res = await api.get('/api/bootstrap');
        data = res?.data ?? null;
      } catch (e: any) {
        if (e?.response?.status === 404) {
          const res2 = await api.get('/api/profile');
          data = res2?.data ?? null;
        } else {
          throw e;
        }
      }

      const u = data?.user ?? auth?.user ?? {};
      const communities = Array.isArray(data?.communities) ? data.communities : [];
      const fullName = (u.fullName || '').trim() || (u.email || 'Student').split('@')[0];

      setProfile((p) => ({
        ...p,
        name: fullName,
        isVerified: true,
        stats: {
          communities: communities.length || 0,
          messages: p.stats.messages,
          connections: 0,
        },
      }));
    } catch {
      // 401 handled globally
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth?.user?._id]);

  React.useEffect(() => {
    load();
  }, [load]);

  // LIVE: keep "Messages" counter in sync with realtime events
  React.useEffect(() => {
    const me = String(auth?.user?._id || '');
    if (!socket || !me) return;

    const onNew = (payload: any) => {
      if (String(payload?.senderId || '') !== me) return;
      setProfile((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          messages: Math.max(0, (prev.stats.messages ?? 0) + 1),
        },
      }));
    };
    const onDeleted = (payload: any) => {
      if (String(payload?.senderId || '') !== me) return;
      setProfile((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          messages: Math.max(0, (prev.stats.messages ?? 0) - 1),
        },
      }));
    };

    socket.on?.('receive_message', onNew);
    socket.on?.('message:deleted', onDeleted);
    return () => {
      socket.off?.('receive_message', onNew);
      socket.off?.('message:deleted', onDeleted);
    };
  }, [socket, auth?.user?._id]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const animatedLargeHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [1, 0]),
    transform: [{ translateY: interpolate(scrollY.value, [0, 40], [0, -10]) }],
  }));
  const animatedSmallHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 60], [0, 1]),
  }));

  const handleLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout?.();
          } catch {}
          router.replace('/landing');
        },
      },
    ]);

  const sections = React.useMemo(
    () => buildSections(profile, unreadDMs > 0 ? String(unreadDMs) : undefined),
    [profile, unreadDMs],
  );

  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        className="bg-slate-100 dark:bg-zinc-950"
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} className="bg-slate-100 dark:bg-zinc-950">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {!isAuthed ? (
        <View className="flex-1 items-center justify-center" style={{ paddingTop: insets.top }}>
          <Text className="text-2xl font-bold text-black dark:text-white mb-2">
            You’re not signed in
          </Text>
          <Text className="text-slate-600 dark:text-slate-300 mb-6">
            Please log in to view your profile.
          </Text>
          <Pressable
            onPress={() => router.push('/modal?context=auth')}
            className="px-5 py-3 rounded-2xl bg-indigo-600"
            accessibilityRole="button"
            accessibilityLabel="Log in"
          >
            <Text className="text-white font-semibold">Log in</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <AnimatedSectionList
            sections={sections}
            keyExtractor={(item, index) => {
              if ('title' in item) return item.title + index;
              if ((item as any).type === 'profile') return (item as ProfileData).name + index;
              return `item-${index}`;
            }}
            renderItem={(
              info: SectionListRenderItemInfo<SectionItem, SectionData>,
            ) => {
              const { item, section, index } = info;
              switch (item.type) {
                case 'profile':
                  return (
                    <ProfileHeader
                      item={item}
                      scrollY={scrollY}
                      isDark={isDark}
                      insets={insets}
                    />
                  );
                case 'setting':
                  return <SettingsRow item={item} isDark={isDark} />;
                case 'quick_action':
                  return index === 0 ? (
                    <QuickActionsRow items={section.data as QuickActionData[]} isDark={isDark} />
                  ) : null;
                case 'logout':
                  return (
                    <Pressable
                      onPress={handleLogout}
                      className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex-row items-center gap-4 mx-4 shadow-sm"
                    >
                      <Ionicons name={item.icon} size={18} color="#EF4444" />
                      <Text className="font-semibold text-base text-red-500">
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                default:
                  return null;
              }
            }}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            renderSectionHeader={({ section: { title } }) => {
              if (title === 'Profile' || title === 'Settings') return null;
              return (
                <Text className="text-lg font-bold text-black dark:text-white mx-6 mt-6 mb-2">
                  {title}
                </Text>
              );
            }}
            renderSectionFooter={({ section }) =>
              section.title === 'Settings' ? <View className="h-4" /> : null
            }
            ListFooterComponent={<View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          />

          {/* sticky header */}
          <View
            style={{ paddingTop: insets.top, height: insets.top + 56 }}
            className="absolute top-0 left-0 right-0 z-10 px-5 justify-end pb-2"
          >
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              className="absolute inset-0"
            />
            <Animated.View style={animatedLargeHeaderStyle}>
              <Text className="text-3xl font-bold text-black dark:text-white">Profile</Text>
            </Animated.View>
            <Animated.View
              style={[{ position: 'absolute', bottom: 12, left: 0, right: 0 }, animatedSmallHeaderStyle]}
              className="items-center"
            >
              <Text className="text-base font-semibold text-black dark:text-white">
                {profile.name}
              </Text>
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}
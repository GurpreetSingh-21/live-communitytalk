// CommunityTalkMobile/app/(tabs)/_layout.tsx
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Tabs, router, useSegments, type Href } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Realtime unread badge from socket context (safe if provider isn't ready)
import { useSocket } from '@/src/context/SocketContext';

// --- Floating Action Button ---
const Fab = ({ isDark }: { isDark: boolean }) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value * 45}deg` }] }));

  const onPressIn = () => { scale.value = withSpring(0.9); rotate.value = withTiming(1); };
  const onPressOut = () => {
    scale.value = withSpring(1);
    rotate.value = withTiming(0);
    router.push('/modal');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="button" accessibilityLabel="New Post">
      <Animated.View
        className="top-[-35px] h-[64px] w-[64px] items-center justify-center rounded-full shadow-lg shadow-black/30 dark:shadow-white/20"
        style={animatedStyle}
      >
        <LinearGradient
          colors={isDark ? ['#4A4A4A', '#2B2B2B'] : ['#333333', '#1a1a1a']}
          className="absolute inset-0 rounded-full"
        />
        <Animated.View style={animatedIconStyle}>
          <IconSymbol name="plus" size={28} color="white" weight="bold" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

type CustomTabButtonProps = {
  name: string;
  activeName: string;
  color: string;
  focused: boolean;
  route: Href;
  label: string;
  badgeCount?: number;
};

const CustomTabButton = ({
  name,
  activeName,
  color,
  focused,
  route,
  label,
  badgeCount = 0,
}: CustomTabButtonProps) => {
  const scale = useSharedValue(focused ? 1.15 : 1);
  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 12 });
  }, [focused]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        router.navigate(route);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      className="flex-1 items-center justify-center"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <View className="relative items-center justify-center">
        <Animated.View style={animatedStyle}>
          <IconSymbol size={28} name={(focused ? activeName : name) as any} color={color} />
        </Animated.View>

        {badgeCount > 0 && (
          <View
            className="absolute -right-2 -top-1 min-h-[16px] min-w-[16px] items-center justify-center rounded-full px-1"
            style={{ backgroundColor: '#ef4444' }}
            accessibilityLabel={`${badgeCount} unread`}
          >
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
              {badgeCount > 99 ? '99+' : String(badgeCount)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { bottom } = useSafeAreaInsets();
  const segments = useSegments();

  // If the provider isn't mounted yet, this won't throw (we default to 0)
  let unreadDMs = 0;
  try {
    unreadDMs = (useSocket()?.unreadDMs ?? 0) as number;
  } catch {
    unreadDMs = 0;
  }

  const activeColor = isDark ? '#FFFFFF' : '#000000';
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';

  const last = segments[segments.length - 1];
  const isIndexActive = last === '(tabs)' || last === undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 50 + bottom,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
        },
        tabBarBackground: () => (
          <View className="absolute inset-0">
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              className="flex-1 border-t border-black/10 dark:border-white/10"
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarButton: () => (
            <CustomTabButton
              label="Home Tab"
              name="house"
              activeName="house.fill"
              color={isIndexActive ? activeColor : inactiveColor}
              focused={isIndexActive}
              route="/(tabs)"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          tabBarButton: () => (
            <CustomTabButton
              label="Explore Tab"
              name="sparkles"
              activeName="sparkles"
              color={last === 'explore' ? activeColor : inactiveColor}
              focused={last === 'explore'}
              route="/(tabs)/explore"
            />
          ),
        }}
      />

      <Tabs.Screen name="add-modal" options={{ tabBarButton: () => <Fab isDark={isDark} /> }} />

      <Tabs.Screen
        name="dms"
        options={{
          tabBarButton: () => (
            <CustomTabButton
              label="Messages Tab"
              name="paperplane"
              activeName="paperplane.fill"
              color={last === 'dms' ? activeColor : inactiveColor}
              focused={last === 'dms'}
              route="/(tabs)/dms"
              badgeCount={Number.isFinite(unreadDMs) ? unreadDMs : 0}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarButton: () => (
            <CustomTabButton
              label="Profile Tab"
              name="person"
              activeName="person.fill"
              color={last === 'profile' ? activeColor : inactiveColor}
              focused={last === 'profile'}
              route="/(tabs)/profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}
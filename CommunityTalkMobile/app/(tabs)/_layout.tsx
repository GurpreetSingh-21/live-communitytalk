// CommunityTalkMobile/app/(tabs)/_layout.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Tabs, router, useSegments, type Href } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSocket } from '@/src/context/SocketContext';

const Fab = ({ isDark }: { isDark: boolean }) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: -14 },
    ],
  }));
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value * 45}deg` }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.92, { damping: 16, stiffness: 220 });
    rotate.value = withTiming(1, { duration: 120 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    rotate.value = withTiming(0, { duration: 140 });
    router.push('/modal');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Define gradient colors based on theme
  const gradientColors: readonly [string, string] = isDark
    ? ['#0F0F10', '#1A1B1E']
    : ['#0E0E10', '#1A1B1E'];

  return (
    <View className="flex-1 items-center justify-center">
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="button" accessibilityLabel="New Post">
        <Animated.View
          className="h-[60px] w-[60px] items-center justify-center rounded-full"
          style={[
            animatedStyle,
            {
              shadowColor: '#000',
              shadowOpacity: 0.22,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            }}
          />

          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 60,
              height: 60,
              borderRadius: 30,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.26)',
            }}
          />

          <Animated.View style={animatedIconStyle}>
            <IconSymbol name="plus" size={28} color="#FFFFFF" weight="bold" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
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
  const scale = useSharedValue(focused ? 1.1 : 1);
  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, { damping: 14 });
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

  // Safely get unread counts from socket context
  const socketContext = useSocket();
  const unreadDMs = Number(socketContext?.unreadDMs ?? 0) || 0;
  const unreadCommunities = Number(socketContext?.unreadCommunities ?? 0) || 0;

  const activeColor = isDark ? '#FFFFFF' : '#000000';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  const last = segments[segments.length - 1];
  const isIndexActive = last === '(tabs)' || last === undefined;

  return (
    <Tabs
      initialRouteName="dms"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarItemStyle: { flex: 1 },
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 58 + bottom,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
        },
        tabBarBackground: () => (
          <View className="absolute inset-0">
            <BlurView
              intensity={75}
              tint={isDark ? 'dark' : 'light'}
              className="flex-1"
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
              label="Updates"
              name="sparkles"
              activeName="sparkles"
              color={isIndexActive ? activeColor : inactiveColor}
              focused={isIndexActive}
              route="/(tabs)"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="communities"
        options={{
          tabBarButton: () => (
            <CustomTabButton
              label="Communities Tab"
              name="building.2"
              activeName="building.2.fill"
              color={last === 'communities' ? activeColor : inactiveColor}
              focused={last === 'communities'}
              route="/(tabs)/communities"
              badgeCount={unreadCommunities}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="add-modal"
        options={{
          tabBarButton: () => <Fab isDark={isDark} />,
        }}
      />

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
              badgeCount={unreadDMs}
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

      {/* Keep explore but hide from tab bar */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
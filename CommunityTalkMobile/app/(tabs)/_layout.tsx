// CommunityTalkMobile/app/(tabs)/_layout.tsx
import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet, LayoutChangeEvent, Dimensions, Platform } from 'react-native';
import { Tabs, router, useSegments, type Href } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSocket } from '@/src/context/SocketContext';

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

type TabRoute = {
  name: string;
  label: string;
  icon: string;
  activeIcon: string;
  path: Href;
  isSpecial?: boolean; // For the FAB
};

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const SPRING_CONFIG = { damping: 16, stiffness: 200, mass: 0.8 };
const ACTIVE_SCALE = 1.15;
const INACTIVE_SCALE = 1.0;

/* -------------------------------------------------------------------------- */
/*                                     FAB                                    */
/* -------------------------------------------------------------------------- */

const Fab = ({ isDark }: { isDark: boolean }) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: -4 },
    ],
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value * 90}deg` }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
    rotate.value = withTiming(1, { duration: 200 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
    rotate.value = withTiming(0, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/modal');
  };

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel="Create Post"
    >
      <Animated.View
        style={[
          {
            width: 52,
            height: 52,
            borderRadius: 18,
            backgroundColor: isDark ? '#FFFFFF' : '#000000',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: isDark ? '#000' : '#007AFF',
            shadowOpacity: isDark ? 0.3 : 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          },
          animatedStyle,
        ]}
      >
        <Animated.View style={animatedIconStyle}>
          <IconSymbol name="plus" size={26} color={isDark ? '#000000' : '#FFFFFF'} weight="bold" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

/* -------------------------------------------------------------------------- */
/*                               TAB BUTTON                                   */
/* -------------------------------------------------------------------------- */

const TabButton = ({
  item,
  isFocused,
  onPress,
  color,
  badgeCount
}: {
  item: TabRoute;
  isFocused: boolean;
  onPress: () => void;
  color: string;
  badgeCount?: number;
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={item.label}
    >
      <View>
        <IconSymbol
          size={26}
          name={(isFocused ? item.activeIcon : item.icon) as any}
          color={color}
          weight={isFocused ? 'bold' : 'regular'} // San Francisco Symbols support weight
          style={{
            opacity: isFocused ? 1 : 0.6,
            transform: [{ scale: isFocused ? 1.05 : 1 }]
          }}
        />
        {(badgeCount || 0) > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: '#EF4444',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 2,
              borderWidth: 2,
              borderColor: 'transparent' // could match bg for cutout effect
            }}
          >
            <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>
              {badgeCount && badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

/* -------------------------------------------------------------------------- */
/*                               CUSTOM TAB BAR                               */
/* -------------------------------------------------------------------------- */

const CustomTabBar = ({ state, descriptors, navigation, isDark, insets, unreadCounts }: any) => {
  // Routes config (order matters)
  const routes: TabRoute[] = [
    { name: 'index', label: 'Updates', icon: 'sparkles', activeIcon: 'sparkles', path: '/(tabs)' },
    { name: 'communities', label: 'Communities', icon: 'building.2', activeIcon: 'building.2.fill', path: '/(tabs)/communities' },
    { name: 'add-modal', label: 'Add', icon: 'plus', activeIcon: 'plus', path: '/modal', isSpecial: true },
    { name: 'dating', label: 'Dating', icon: 'heart', activeIcon: 'heart.fill', path: '/(tabs)/dating' },
    { name: 'dms', label: 'Messages', icon: 'paperplane', activeIcon: 'paperplane.fill', path: '/(tabs)/dms' },
    { name: 'profile', label: 'Profile', icon: 'person', activeIcon: 'person.fill', path: '/(tabs)/profile' },
  ];

  const totalTabs = routes.length;
  const activeIndex = state.index;
  // Map internal state index to our routes array index 
  // (expo-router adds extra routes sometimes, but here we control the array order)
  // Actually, state.routes contains the actual routes. We need to match names.

  const currentRouteName = state.routes[activeIndex].name;
  const currentTabIdx = routes.findIndex(r => r.name === currentRouteName);

  // Animated Value for the "Pill" position
  // 0 -> 1 -> 2 -> 3 -> 4
  const tabPosition = useSharedValue(0);

  React.useEffect(() => {
    if (currentTabIdx !== -1) {
      tabPosition.value = withSpring(currentTabIdx, SPRING_CONFIG);
    }
  }, [currentTabIdx]);

  // Don't show tab bar on 'explore' if it was part of this navigator, 
  // but we usually hide it via options.href: null. 
  // Double check if 'explore' ends up in state.routes
  // Yes, hidden routes are still in state usually? No, href:null removes them.

  // Pill Style (Sliding Background)
  const pillStyle = useAnimatedStyle(() => {
    if (currentTabIdx === 2 || currentTabIdx === -1) { // 2 is FAB
      return { opacity: 0 };
    }

    // Calculate percentage based on total Tabs
    const widthPercent = 100 / totalTabs;

    return {
      opacity: withTiming(1, { duration: 200 }),
      left: `${(tabPosition.value * widthPercent)}%`,
      // We want to center the pill in that slot. 
      // Slot width is 20% (if 5 tabs). Pill width is say 40px. 
      // Easier to just move a container that is matched to slot width.
      width: `${widthPercent}%`,
    };
  });

  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <BlurView
        intensity={90}
        tint={isDark ? 'dark' : 'light'}
        style={{
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          overflow: 'hidden',
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
          borderTopWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch' }}>

          {/* Animated Indicator Pill */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center', // Center vertically
              },
              pillStyle
            ]}
          >
            <View
              style={{
                width: 48,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                marginTop: 10
              }}
            />
          </Animated.View>

          {routes.map((route, index) => {
            if (route.isSpecial) {
              return <Fab key={route.name} isDark={isDark} />;
            }

            const isFocused = currentTabIdx === index;
            const badge = route.name === 'dms' ? unreadCounts.dms :
              route.name === 'communities' ? unreadCounts.communities : 0;

            return (
              <TabButton
                key={route.name}
                item={route}
                isFocused={isFocused}
                color={isFocused ? (isDark ? '#FFF' : '#000') : (isDark ? '#8E8E93' : '#8E8E93')}
                badgeCount={badge}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate(route.name);
                }}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                               MAIN LAYOUT                                  */
/* -------------------------------------------------------------------------- */

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  // Socket Context for Badges
  const socketContext = useSocket();
  const unreadCounts = useMemo(() => ({
    dms: Number(socketContext?.unreadDMs ?? 0) || 0,
    communities: Number(socketContext?.unreadCommunities ?? 0) || 0
  }), [socketContext?.unreadDMs, socketContext?.unreadCommunities]);

  return (
    <Tabs
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          isDark={isDark}
          insets={insets}
          unreadCounts={unreadCounts}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true, // Auto hide
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Updates' }} />
      <Tabs.Screen name="communities" options={{ title: 'Communities' }} />
      <Tabs.Screen name="add-modal" options={{ title: 'Add' }} />
      <Tabs.Screen name="dating" options={{ title: 'Dating' }} />
      <Tabs.Screen name="dms" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      {/* Hidden Routes */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
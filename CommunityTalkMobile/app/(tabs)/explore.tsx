// app/(tabs)/explore.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View, FlatList, Text, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
// TYPESCRIPT FIX: Import SharedValue directly for Reanimated v2+
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, type SharedValue } from 'react-native-reanimated';

// --- Types and Mock Data ---
type Community = {
  id: string;
  name: string;
  members: number;
  topic: string;
  emoji: string;
  gradient: Readonly<[string, string]>;
};

const MOCK_COMMUNITIES: Community[] = [
  { id: 'react', name: 'React Developers', members: 18324, topic: 'Frontend', emoji: '⚛️', gradient: ['#007CF0', '#00DFD8'] },
  { id: 'rn', name: 'React Native', members: 14211, topic: 'Mobile', emoji: '📱', gradient: ['#7928CA', '#FF0080'] },
  { id: 'backend', name: 'Backend Builders', members: 9860, topic: 'APIs', emoji: '⚙️', gradient: ['#17C964', '#006C2E'] },
  { id: 'design', name: 'Design Critics', members: 5211, topic: 'UI/UX', emoji: '🎨', gradient: ['#FF4D4D', '#F9CB28'] },
  { id: 'ai', name: 'AI & LLMs', members: 23120, topic: 'ML/AI', emoji: '🤖', gradient: ['#FF7000', '#E54E00'] },
];

const FILTERS = ['All', 'Frontend', 'Mobile', 'APIs', 'UI/UX', 'ML/AI'];

// --- Components ---

const CommunityRow = React.memo(({ item, index }: { item: Community, index: number }) => {
  const isDark = useColorScheme() === 'dark';
  return (
    <MotiView
      from={{ opacity: 0, transform: [{ translateY: 20 }] }}
      animate={{ opacity: 1, transform: [{ translateY: 0 }] }}
      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
    >
      <Link href={`/community/${item.id}`} asChild>
        <Pressable className="flex-row items-center p-4 bg-slate-100 dark:bg-zinc-950">
          <LinearGradient colors={item.gradient} className="w-12 h-12 rounded-xl items-center justify-center">
            <Text className="text-2xl">{item.emoji}</Text>
          </LinearGradient>
          <View className="flex-1 ml-4">
            <Text className="text-base font-bold text-black dark:text-white">{item.name}</Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{item.members.toLocaleString()} members</Text>
          </View>
          <Pressable className="bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-lg mr-4">
            <Text className="text-sm font-bold text-black dark:text-white">Join</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#71717a' : '#9ca3af'} />
        </Pressable>
      </Link>
    </MotiView>
  );
});

const Header = ({ q, setQ, activeFilter, setActiveFilter, scrollY }: {
  q: string;
  setQ: (q: string) => void;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  // TYPESCRIPT FIX: Use the imported SharedValue type, not Animated.SharedValue
  scrollY: SharedValue<number>;
}) => {
  const isDark = useColorScheme() === 'dark';

  const animatedHeaderStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [0, 50], [0, -50], 'clamp');
    return { transform: [{ translateY }] };
  });

  const animatedTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 20], [1, 0], 'clamp');
    return { opacity };
  });

  return (
    <Animated.View style={animatedHeaderStyle} className="pt-4 px-4 bg-slate-100 dark:bg-zinc-950 z-10">
      <Animated.View style={animatedTitleStyle}>
        <Text className="text-4xl font-extrabold text-black dark:text-white">Discover</Text>
      </Animated.View>
      <View className="flex-row items-center gap-2 rounded-xl bg-slate-200 dark:bg-zinc-800 px-3 my-4">
        <Ionicons name="search" size={20} color={isDark ? '#9ca3af' : '#64748b'} />
        <TextInput
          placeholder="Search..."
          onChangeText={setQ}
          value={q}
          className="flex-1 h-11 text-base text-black dark:text-white"
          placeholderTextColor={isDark ? '#9ca3af' : '#64748b'}
        />
      </View>
      <View className="mb-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { setActiveFilter(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              className={`py-2 rounded-lg overflow-hidden`}
            >
              {activeFilter === item ? (
                <LinearGradient colors={['#8B5CF6', '#EC4899']} className="px-4 py-2">
                  <Text className="font-semibold text-white">{item}</Text>
                </LinearGradient>
              ) : (
                <View className="px-4 py-2">
                  <Text className="font-semibold text-slate-500 dark:text-slate-400">{item}</Text>
                </View>
              )}
            </Pressable>
          )}
          contentContainerStyle={{ gap: 8 }}
        />
      </View>
    </Animated.View>
  );
};

// --- Main Screen ---
export default function ExploreScreen() {
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const filteredData = useMemo(() => {
    let result = MOCK_COMMUNITIES;
    if (activeFilter !== 'All') result = result.filter((c) => c.topic === activeFilter);
    if (q.trim()) result = result.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    return result;
  }, [q, activeFilter]);

  return (
    <View style={{ paddingTop: insets.top, flex: 1 }} className="bg-slate-100 dark:bg-zinc-950">
      <Animated.FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => <CommunityRow item={item} index={index} />}
        ListHeaderComponent={<Header q={q} setQ={setQ} activeFilter={activeFilter} setActiveFilter={setActiveFilter} scrollY={scrollY} />}
        ItemSeparatorComponent={() => <View className="h-px bg-slate-200 dark:bg-zinc-800" style={{ marginLeft: 88 }} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="mb-4 text-6xl">🔭</Text>
            <Text className="mb-2 text-lg font-bold text-black dark:text-white">No Results Found</Text>
            <Text className="text-center text-slate-500 dark:text-slate-400">Try a different search or filter.</Text>
          </View>
        }
      />
    </View>
  );
}
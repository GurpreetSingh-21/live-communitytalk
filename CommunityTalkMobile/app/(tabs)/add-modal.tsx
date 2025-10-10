// CommunityTalkMobile/app/(tabs)/add-modal.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

/**
 * This screen is not meant to be displayed directly.
 * The central FAB in _layout.tsx uses router.push('/modal'),
 * which loads app/modal.tsx instead.
 *
 * However, this fallback ensures no crashes if the route
 * is somehow accessed manually.
 */
export default function AddModalPlaceholder() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <View className="flex-1 items-center justify-center">
      {/* Subtle frosted background */}
      <LinearGradient
        colors={isDark ? ['#111827', '#1f2937'] : ['#f3f4f6', '#e5e7eb']}
        className="absolute inset-0"
      />
      <BlurView
        intensity={90}
        tint={isDark ? 'dark' : 'light'}
        className="absolute inset-0"
      />

      <View className="items-center gap-3">
        <IconSymbol name="plus.circle" size={48} color={isDark ? '#a78bfa' : '#7c3aed'} />
        <Text className="text-lg font-semibold text-black dark:text-white">
          Add New Post
        </Text>
        <Text className="text-sm text-black/60 dark:text-white/60 text-center px-6">
          This is just a placeholder tab. Use the + button to open the real modal.
        </Text>

        <Pressable
          onPress={() => router.push('/modal')}
          className="mt-6 rounded-full bg-indigo-500 px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel="Open Add Modal"
        >
          <Text className="text-white font-bold">Open Modal</Text>
        </Pressable>
      </View>
    </View>
  );
}
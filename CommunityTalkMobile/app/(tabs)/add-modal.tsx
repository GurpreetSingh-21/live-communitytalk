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
import { Colors, Fonts } from '@/constants/theme';

export default function AddModalPlaceholder() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      {/* Subtle frosted background */}
      <LinearGradient
        colors={[colors.background, colors.surface]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <BlurView
        intensity={90}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ alignItems: 'center', gap: 12 }}>
        <IconSymbol name="plus.circle" size={48} color={colors.primary} />
        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text }}>
          Add New Post
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 }}>
          This is just a placeholder tab. Use the + button to open the real modal.
        </Text>

        <Pressable
          onPress={() => router.push('/modal')}
          style={{ marginTop: 24, borderRadius: 9999, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Open Add Modal"
        >
          <Text style={{ color: 'white', fontFamily: Fonts.bold }}>Open Modal</Text>
        </Pressable>
      </View>
    </View>
  );
}
// app/landing.tsx
import React, { useRef } from 'react';
import { Animated, View, Image, Pressable, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

const HERO = require('@/assets/images/react-logo.png'); // swap to require('@/assets/images/hero.jpeg') when ready

export default function Landing() {
  const scheme = useColorScheme();
  const y = useRef(new Animated.Value(0)).current;

  // subtle parallax for watermark
  const imgTranslate = y.interpolate({
    inputRange: [0, 360],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });
  const imgOpacity = y.interpolate({
    inputRange: [0, 220],
    outputRange: [0.12, 0.04],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RNStatusBar translucent />

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO (full-bleed) */}
        <View className="relative overflow-hidden">
          <LinearGradient
            // typed as a const tuple so TS is happy with expo-linear-gradient
            colors={['#5B67F1', '#8B5CF6', '#EC4899'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-6 pt-16 pb-10"
          >
            {/* watermark */}
            <Animated.View
              style={{
                position: 'absolute',
                right: -36,
                bottom: -18,
                transform: [{ translateY: imgTranslate }],
                opacity: imgOpacity as any,
              }}
              pointerEvents="none"
            >
              <Image source={HERO} resizeMode="contain" className="w-64 h-64" />
            </Animated.View>

            {/* top bar */}
            <View className="mb-7 flex-row items-center justify-between z-10">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go Home"
                onPress={() => router.replace('/')}
                hitSlop={12}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                    <ThemedText className="text-white font-extrabold">CT</ThemedText>
                  </View>
                  <View>
                    <ThemedText className="text-white text-xl font-extrabold">Community</ThemedText>
                    <ThemedText className="text-yellow-300 text-xl font-extrabold">Talk</ThemedText>
                  </View>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Register"
                onPress={() => router.push('/register')}
                className="rounded-xl px-5 py-2.5 bg-white shadow-xl"
                hitSlop={12}
              >
                <ThemedText className="text-indigo-600 font-bold">Register</ThemedText>
              </Pressable>
            </View>

            {/* headline */}
            <ThemedText className="mb-3 text-[32px] leading-[36px] font-extrabold text-white">
              Connect with <ThemedText className="text-yellow-300">campus</ThemedText> and{' '}
              <ThemedText className="text-pink-300">faith groups</ThemedText> across NYC
            </ThemedText>

            {/* subhead */}
            <ThemedText className="mb-6 text-base leading-6 text-white/90">
              Your hub for CUNY and NYC college communities. Connect with classmates, discover faith groups,
              and chat privately—without the ads or distractions.
            </ThemedText>

            {/* stats */}
            <View className="mb-6 flex-row justify-between rounded-2xl bg-white/12 p-4">
              {[
                ['25+', 'NY campuses'],
                ['350+', 'Student groups'],
                ['E2E', 'Encryption'],
              ].map(([n, l], i) => (
                <View key={i} className="items-center flex-1">
                  <ThemedText className="mb-1 text-2xl font-extrabold text-white">{n}</ThemedText>
                  <ThemedText className="text-xs text-white/80">{l}</ThemedText>
                </View>
              ))}
            </View>

            {/* CTAs */}
            <View className="z-10 flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Get started"
                onPress={() => router.push('/register')}
                className="flex-1 items-center rounded-2xl bg-white px-6 py-4 shadow-xl"
                hitSlop={12}
              >
                <ThemedText className="font-bold text-indigo-600">Get started →</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log in"
                onPress={() => router.push('/modal')}
                className="flex-1 items-center rounded-2xl border-2 border-white/40 px-6 py-4"
                hitSlop={12}
              >
                <ThemedText className="font-bold text-white">Log in</ThemedText>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        {/* FEATURES */}
        <View className="px-6 py-8">
          <ThemedText className="mb-6 text-2xl font-extrabold">Everything you need for campus life</ThemedText>

          {([
            { title: 'Campus email verification', desc: 'Sign up with your .edu email to keep spaces authentic and student-focused.', emoji: '🎓', color: ['#3B82F6', '#2563EB'] as const },
            { title: 'Find your faith community', desc: 'Connect with Sikh, Muslim, Hindu, Christian, Jewish, and Buddhist groups citywide.', emoji: '🛕', color: ['#8B5CF6', '#7C3AED'] as const },
            { title: 'Smart moderation tools', desc: 'Built-in roles, reporting, and safety features keep conversations respectful.', emoji: '🛡️', color: ['#10B981', '#059669'] as const },
            { title: 'Event planning made easy', desc: 'Create events, track RSVPs, and send reminders—all in one place.', emoji: '📅', color: ['#F59E0B', '#D97706'] as const },
            { title: 'Share anything, anywhere', desc: 'Send photos, files, and voice messages that work even on slow campus Wi-Fi.', emoji: '🎞️', color: ['#EF4444', '#DC2626'] as const },
            { title: 'Privacy first, always', desc: 'End-to-end encrypted messaging means your conversations stay private.', emoji: '🔒', color: ['#6366F1', '#4F46E5'] as const },
          ] as const).map((item, i) => (
            <View key={i} className="mb-4 overflow-hidden rounded-3xl bg-white p-5 shadow-xl dark:bg-zinc-900">
              <LinearGradient
                colors={item.color}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute right-0 top-0 h-full w-1.5"
              />
              <View className="mb-3 flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
                  <ThemedText className="text-2xl">{item.emoji}</ThemedText>
                </View>
                <ThemedText className="flex-1 text-lg font-bold">{item.title}</ThemedText>
              </View>
              <ThemedText className="leading-6 text-slate-600 dark:text-slate-400">{item.desc}</ThemedText>
            </View>
          ))}
        </View>

        {/* GET STARTED */}
        <View className="px-6 pb-4">
          <ThemedText className="mb-4 text-2xl font-extrabold">Get started</ThemedText>
          {([
            ['Join your campus', 'Find and verify your CUNY/NY college.', '🎓'],
            ['Find a faith group', 'Search by your Community across all campuses.', '🛕'],
            ['Create a new group', 'Start a club, study circle, or volunteer team.', '➕'],
          ] as const).map(([title, desc, emoji], i) => (
            <Pressable
              key={i}
              onPress={() => router.push('/register')}
              className="mb-3 rounded-2xl bg-white p-5 shadow-lg dark:bg-zinc-900"
              hitSlop={12}
            >
              <View className="mb-2 flex-row items-center gap-3">
                <ThemedText className="text-3xl">{emoji}</ThemedText>
                <ThemedText className="flex-1 text-base font-bold">{title}</ThemedText>
              </View>
              <ThemedText className="mb-2 text-slate-600 dark:text-slate-400">{desc}</ThemedText>
              <ThemedText className="font-semibold text-indigo-600">Get started →</ThemedText>
            </Pressable>
          ))}
        </View>

        {/* ABOUT */}
        <View className="px-6 py-4">
          <View className="overflow-hidden rounded-3xl bg-slate-900 p-6 dark:bg-zinc-900">
            <ThemedText className="mb-4 text-2xl font-extrabold text-white">What is CommunityTalk?</ThemedText>
            <ThemedText className="mb-6 leading-6 text-white/80">
              A straightforward platform built specifically for NYC college students. Verified communities, trusted faith
              groups, and the tools you actually need—minus the clutter.
            </ThemedText>

            <View className="mb-2 flex-row gap-4">
              <Pressable
                onPress={() => router.push('/register')}
                className="flex-1 items-center rounded-2xl bg-white px-5 py-4"
                hitSlop={12}
              >
                <ThemedText className="font-bold text-slate-900">Create account</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => router.push('/modal')}
                className="flex-1 items-center rounded-2xl border-2 border-white/30 px-5 py-4"
                hitSlop={12}
              >
                <ThemedText className="font-bold text-white">Log in</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <View className="px-6 mt-4">
          <View className="rounded-2xl bg-slate-100 p-5 dark:bg-zinc-900">
            <View className="flex-row items-center justify-between">
              <View>
                <ThemedText className="text-lg font-bold">Community</ThemedText>
                <ThemedText className="text-lg font-bold text-indigo-600">Talk</ThemedText>
              </View>
              <View className="flex-row gap-2">
                {['⚡', '✉️', '❤️'].map((e, i) => (
                  <View key={i} className="h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-zinc-800">
                    <ThemedText>{e}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
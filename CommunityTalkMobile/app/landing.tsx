import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/src/context/AuthContext";

const useTokens = (isDark: boolean) => ({
  pageBg: isDark ? "#000000" : "#FAFBFC",
  cardBg: isDark ? "#0A0A0A" : "#FFFFFF",
  textPrimary: isDark ? "#FFFFFF" : "#0A0A0A",
  textSecondary: isDark ? "#9CA3AF" : "#6B7280",
  border: isDark ? "#1F1F1F" : "#E5E7EB",
  shadow: Platform.OS === "ios" ? (isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.03)") : undefined,
  primary: "#6366F1",
  primaryAlt: "#10B981",
});

type Feature = {
  emoji: string;
  title: string;
  desc: string;
  gradient: readonly [string, string];
};

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, delay = 0, style }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

interface PulseButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}

const PulseButton: React.FC<PulseButtonProps> = ({ children, onPress, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={12}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function Landing() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const t = useTokens(isDark);
  const auth = React.useContext(AuthContext);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (auth?.isAuthed) router.replace("/(tabs)");
  }, [auth?.isAuthed]);

  useFocusEffect(
    React.useCallback(() => {
      if (auth?.isAuthed) router.replace("/(tabs)");
    }, [auth?.isAuthed])
  );

  const FEATURES: Feature[] = useMemo(
    () => [
      {
        emoji: "🎓",
        title: "Verified Communities",
        desc: "Connect with 25+ NYC campuses through .edu verification",
        gradient: ["#6366F1", "#8B5CF6"] as const,
      },
      {
        emoji: "🛕",
        title: "Faith Groups",
        desc: "Sikh, Muslim, Hindu, Christian, Jewish & Buddhist communities",
        gradient: ["#8B5CF6", "#EC4899"] as const,
      },
      {
        emoji: "📅",
        title: "Campus Events",
        desc: "Discover and share what's happening around you",
        gradient: ["#F59E0B", "#EF4444"] as const,
      },
      {
        emoji: "🔒",
        title: "Private & Secure",
        desc: "End-to-end encryption with no ads or tracking",
        gradient: ["#10B981", "#14B8A6"] as const,
      },
      {
        emoji: "💬",
        title: "Real-time Chat",
        desc: "Fast messaging that works anywhere on campus",
        gradient: ["#06B6D4", "#3B82F6"] as const,
      },
      {
        emoji: "🛡️",
        title: "Safe Communities",
        desc: "Built-in moderation and safety tools",
        gradient: ["#EF4444", "#F97316"] as const,
      },
    ],
    []
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.pageBg }} edges={["top", "left", "right"]}>
      <StatusBar style={isDark ? "light" : "dark"} translucent={false} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <AnimatedCard>
          <View className="px-5 pt-4 pb-6 flex-row items-center justify-between">
          <View className="flex-row items-start gap-4">
              <View
                className="items-center justify-center"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: t.primary,
                  shadowColor: t.primary,
                  shadowOpacity: 0.35,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <ThemedText style={{ fontSize: 26, fontWeight: "900", color: "#FFFFFF" }}>
                  CT
                </ThemedText>
              </View>
              <ThemedText
                style={{
                  color: t.textPrimary,
                  fontSize: 22,
                  fontWeight: "900",
                  letterSpacing: -0.6,
                }}
              >
                CommunityTalk
              </ThemedText>
            </View>

            <PulseButton onPress={() => router.push("/modal")}>
              <View
                className="px-6 py-2.5 rounded-xl"
                style={{
                  borderWidth: 1.5,
                  borderColor: t.border,
                  backgroundColor: t.cardBg,
                }}
              >
                <ThemedText style={{ color: t.primary, fontWeight: "700", fontSize: 15 }}>
                  Sign in
                </ThemedText>
              </View>
            </PulseButton>
          </View>
        </AnimatedCard>

        {/* Hero Section */}
        <AnimatedCard delay={100}>
          <View className="px-5 pb-10">
            <ThemedText
              style={{
                color: t.textPrimary,
                fontSize: 44,
                fontWeight: "900",
                lineHeight: 50,
                marginBottom: 18,
                letterSpacing: -1.2,
              }}
            >
              Connect{" "}
              <ThemedText style={{ fontSize: 44, fontWeight: "900", color: t.primary }}>
                campus
              </ThemedText>
              {"\n"}and faith groups
            </ThemedText>

            <ThemedText
              style={{
                color: t.textSecondary,
                fontSize: 18,
                lineHeight: 28,
                marginBottom: 32,
                fontWeight: "400",
              }}
            >
              NYC's hub for verified student communities
            </ThemedText>

            <PulseButton onPress={() => router.push("/register")}>
              <View
                className="rounded-2xl py-5 items-center"
                style={{
                  backgroundColor: t.primary,
                  shadowColor: t.primary,
                  shadowOpacity: 0.4,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 10,
                }}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 18 }}>
                  Get Started →
                </ThemedText>
              </View>
            </PulseButton>
          </View>
        </AnimatedCard>

        {/* Features Section */}
        <View className="px-5">
          <AnimatedCard delay={200}>
            <ThemedText
              style={{
                color: t.textPrimary,
                fontSize: 30,
                fontWeight: "900",
                marginBottom: 24,
                letterSpacing: -0.6,
              }}
            >
              Why students love us
            </ThemedText>
          </AnimatedCard>

          <View style={{ gap: 16 }}>
            {FEATURES.map((f, i) => (
              <AnimatedCard key={i} delay={300 + i * 60}>
                <View
                  className="rounded-3xl p-6"
                  style={{
                    backgroundColor: t.cardBg,
                    borderWidth: 1,
                    borderColor: t.border,
                    shadowColor: t.shadow,
                    shadowOpacity: isDark ? 0.5 : 1,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 12 },
                    elevation: 4,
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={[f.gradient[0], f.gradient[1]]}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 6,
                      opacity: 0.85,
                    }}
                  />

                  <View className="flex-row items-center gap-4">
                    <View
                      className="items-center justify-center"
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        backgroundColor: isDark ? "#141414" : "#F9FAFB",
                      }}
                    >
                      <ThemedText style={{ fontSize: 28 }}>{f.emoji}</ThemedText>
                    </View>

                    <View className="flex-1">
                      <ThemedText
                        style={{
                          color: t.textPrimary,
                          fontSize: 19,
                          fontWeight: "800",
                          marginBottom: 6,
                          letterSpacing: -0.3,
                        }}
                      >
                        {f.title}
                      </ThemedText>
                      <ThemedText
                        style={{
                          color: t.textSecondary,
                          fontSize: 15,
                          lineHeight: 22,
                          fontWeight: "400",
                        }}
                      >
                        {f.desc}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </AnimatedCard>
            ))}
          </View>
        </View>

        {/* Footer CTA */}
        <AnimatedCard delay={900}>
          <View className="px-5 mt-8">
            <View
              className="rounded-3xl p-7"
              style={{
                backgroundColor: t.cardBg,
                borderWidth: 1,
                borderColor: t.border,
                shadowColor: t.shadow,
                shadowOpacity: isDark ? 0.5 : 1,
                shadowRadius: 28,
                shadowOffset: { width: 0, height: 14 },
                elevation: 5,
              }}
            >
              <ThemedText
                style={{
                  color: t.textPrimary,
                  fontSize: 28,
                  fontWeight: "900",
                  marginBottom: 12,
                  letterSpacing: -0.6,
                }}
              >
                Ready to connect?
              </ThemedText>
              <ThemedText
                style={{
                  color: t.textSecondary,
                  lineHeight: 26,
                  marginBottom: 24,
                  fontSize: 17,
                  fontWeight: "400",
                }}
              >
                Join authentic student communities across NYC—no noise, no ads, just real connections.
              </ThemedText>

              <PulseButton onPress={() => router.push("/register")}>
                <View
                  className="rounded-2xl py-5 items-center"
                  style={{
                    backgroundColor: t.primaryAlt,
                    shadowColor: t.primaryAlt,
                    shadowOpacity: 0.4,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 10,
                  }}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 18 }}>
                    Create Account
                  </ThemedText>
                </View>
              </PulseButton>
            </View>
          </View>
        </AnimatedCard>
      </ScrollView>
    </SafeAreaView>
  );
}
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
  pageBg: isDark ? "#000000" : "#FFFFFF",
  cardBg: isDark ? "#0F0F0F" : "#FAFBFC",
  textPrimary: isDark ? "#FFFFFF" : "#111827",
  textSecondary: isDark ? "#A1A1AA" : "#71717A",
  textTertiary: isDark ? "#71717A" : "#A1A1AA",
  border: isDark ? "#27272A" : "#F4F4F5",
  borderSubtle: isDark ? "#18181B" : "#FAFAFA",
  shadow: Platform.OS === "ios" ? (isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.04)") : undefined,
  primary: "#6366F1",
  primaryLight: isDark ? "#818CF8" : "#6366F1",
  primaryAlt: "#10B981",
  accentPurple: "#8B5CF6",
  accentPink: "#EC4899",
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
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        tension: 50,
        friction: 7,
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

interface InteractiveCardProps {
  children: React.ReactNode;
  onPress?: () => void;
}

const InteractiveCard: React.FC<InteractiveCardProps> = ({ children, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(4)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }),
      Animated.timing(shadowAnim, {
        toValue: 2,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(shadowAnim, {
        toValue: 4,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
        >
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return <>{children}</>;
};

interface AnimatedEmojiProps {
  emoji: string;
  delay?: number;
}

const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({ emoji, delay = 0 }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [delay, bounceAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: bounceAnim }, { rotate }],
      }}
    >
      <ThemedText style={{ fontSize: 22 }}>{emoji}</ThemedText>
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
  const glowAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle pulse glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 100,
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

const PulsingLogo: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: pulseAnim }],
      }}
    >
      <ThemedText style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>
        CT
      </ThemedText>
    </Animated.View>
  );
};

interface StaggeredTextProps {
  text: string;
  delay?: number;
  style?: any;
}

const StaggeredText: React.FC<StaggeredTextProps> = ({ text, delay = 0, style }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <ThemedText style={style}>{text}</ThemedText>
    </Animated.View>
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Minimal Header */}
        <AnimatedCard>
          <View className="px-6 pt-2 pb-6 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View
                className="items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: t.primary,
                }}
              >
                <PulsingLogo />
              </View>
              <ThemedText
                style={{
                  color: t.textPrimary,
                  fontSize: 18,
                  fontWeight: "600",
                  letterSpacing: -0.3,
                }}
              >
                CommunityTalk
              </ThemedText>
            </View>

            <PulseButton onPress={() => router.push("/modal")}>
              <View
                className="px-4 py-1.5 rounded-lg"
                style={{
                  backgroundColor: isDark ? t.cardBg : "#F5F5F5",
                  borderWidth: 1,
                  borderColor: isDark ? t.border : "transparent",
                }}
              >
                <ThemedText style={{ color: t.textPrimary, fontWeight: "500", fontSize: 14 }}>
                  Sign in
                </ThemedText>
              </View>
            </PulseButton>
          </View>
        </AnimatedCard>

        {/* Clean Minimal Hero Section */}
        <View className="px-6 pb-20">
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
              <StaggeredText
                text="Connect "
                delay={150}
                style={{
                  color: t.textPrimary,
                  fontSize: 46,
                  fontWeight: "700",
                  lineHeight: 52,
                  letterSpacing: -1.4,
                }}
              />
              <StaggeredText
                text="campus"
                delay={250}
                style={{
                  color: t.primary,
                  fontSize: 46,
                  fontWeight: "700",
                  lineHeight: 52,
                  letterSpacing: -1.4,
                }}
              />
            </View>
            <StaggeredText
              text="and faith groups"
              delay={350}
              style={{
                color: t.textPrimary,
                fontSize: 46,
                fontWeight: "700",
                lineHeight: 52,
                letterSpacing: -1.4,
              }}
            />
          </View>

          <AnimatedCard delay={450}>
            <ThemedText
              style={{
                color: t.textSecondary,
                fontSize: 16,
                lineHeight: 24,
                marginBottom: 32,
                fontWeight: "400",
              }}
            >
              NYC's hub for verified student communities
            </ThemedText>
          </AnimatedCard>

          <AnimatedCard delay={550}>
            <PulseButton onPress={() => router.push("/register")}>
              <View
                className="rounded-xl py-3.5 items-center"
                style={{
                  backgroundColor: t.primary,
                  shadowColor: "#000000",
                  shadowOpacity: isDark ? 0.3 : 0.08,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}>
                  Get Started →
                </ThemedText>
              </View>
            </PulseButton>
          </AnimatedCard>
        </View>

        {/* Clean Features Section */}
        <View className="px-6" style={{ marginTop: 12 }}>
          <AnimatedCard delay={650}>
            <ThemedText
              style={{
                color: t.textPrimary,
                fontSize: 26,
                fontWeight: "600",
                letterSpacing: -0.6,
                marginBottom: 20,
              }}
            >
              Why students love us
            </ThemedText>
          </AnimatedCard>

          <View style={{ gap: 10 }}>
            {FEATURES.map((f, i) => (
              <AnimatedCard key={i} delay={750 + i * 40}>
                <InteractiveCard>
                  <View
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: t.cardBg,
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  >
                    <View className="flex-row items-start gap-3">
                      <View
                        className="items-center justify-center"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: isDark ? "#1C1C1C" : "#F5F5F5",
                        }}
                      >
                        <AnimatedEmoji emoji={f.emoji} delay={750 + i * 40 + 200} />
                      </View>

                      <View className="flex-1" style={{ paddingTop: 1 }}>
                        <ThemedText
                          style={{
                            color: t.textPrimary,
                            fontSize: 16,
                            fontWeight: "600",
                            marginBottom: 3,
                            letterSpacing: -0.1,
                          }}
                        >
                          {f.title}
                        </ThemedText>
                        <ThemedText
                          style={{
                            color: t.textSecondary,
                            fontSize: 14,
                            lineHeight: 19,
                            fontWeight: "400",
                          }}
                        >
                          {f.desc}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </InteractiveCard>
              </AnimatedCard>
            ))}
          </View>
        </View>

        {/* Clean Footer CTA */}
        <AnimatedCard delay={1100}>
          <View className="px-6 mt-12">
            <View
              className="rounded-xl p-5"
              style={{
                backgroundColor: isDark ? "#0F0F0F" : "#FAFAFA",
                borderWidth: 1,
                borderColor: t.border,
              }}
            >
              <ThemedText
                style={{
                  color: t.textPrimary,
                  fontSize: 22,
                  fontWeight: "600",
                  marginBottom: 8,
                  letterSpacing: -0.4,
                }}
              >
                Ready to connect?
              </ThemedText>
              <ThemedText
                style={{
                  color: t.textSecondary,
                  lineHeight: 22,
                  marginBottom: 20,
                  fontSize: 14,
                  fontWeight: "400",
                }}
              >
                Join authentic student communities across NYC—no noise, no ads, just real connections.
              </ThemedText>

              <PulseButton onPress={() => router.push("/register")}>
                <View
                  className="rounded-xl py-3.5 items-center"
                  style={{
                    backgroundColor: t.primary,
                    shadowColor: "#000000",
                    shadowOpacity: isDark ? 0.3 : 0.08,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}>
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
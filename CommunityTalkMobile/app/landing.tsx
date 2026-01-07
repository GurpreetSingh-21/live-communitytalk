import React, { useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from 'moti';

import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/src/context/AuthContext";
import { Colors, Fonts } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- Configuration ---
const NODE_SIZE = 52;
const VERTICAL_SPACING = 140;

type Feature = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  gradientStart: string;
  gradientEnd: string;
};

// --- Glowing Node Component ---
const GlowingNode: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  gradientStart: string;
  gradientEnd: string;
  index: number;
}> = ({ icon, gradientStart, gradientEnd, index }) => (
  <MotiView
    from={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 300 + index * 120, type: 'spring', damping: 12 }}
  >
    {/* Outer Glow */}
    <View
      style={{
        width: NODE_SIZE + 16,
        height: NODE_SIZE + 16,
        borderRadius: (NODE_SIZE + 16) / 2,
        backgroundColor: gradientStart,
        opacity: 0.2,
        position: 'absolute',
        top: -8,
        left: -8,
      }}
    />
    {/* Main Node */}
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: NODE_SIZE,
        height: NODE_SIZE,
        borderRadius: NODE_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: gradientStart,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
    </LinearGradient>
  </MotiView>
);

// --- Connecting Line (Vertical with Gradient) ---
const VerticalConnector: React.FC<{ isDark: boolean; index: number }> = ({ isDark, index }) => (
  <MotiView
    from={{ scaleY: 0 }}
    animate={{ scaleY: 1 }}
    transition={{ delay: 400 + index * 120, type: 'timing', duration: 600 }}
    style={{
      width: 2,
      height: VERTICAL_SPACING - NODE_SIZE - 24,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      alignSelf: 'center',
      marginVertical: 12,
      borderRadius: 1,
      transformOrigin: 'top',
    }}
  />
);

// --- Feature Row Component ---
const FeatureRow: React.FC<{
  item: Feature;
  index: number;
  isRight: boolean;
  isDark: boolean;
  colors: any;
}> = ({ item, index, isRight, isDark, colors }) => (
  <MotiView
    from={{ opacity: 0, translateX: isRight ? 30 : -30 }}
    animate={{ opacity: 1, translateX: 0 }}
    transition={{ delay: 350 + index * 120, type: 'spring', damping: 14 }}
    style={{
      flexDirection: isRight ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 16,
    }}
  >
    {/* Node */}
    <GlowingNode
      icon={item.icon}
      gradientStart={item.gradientStart}
      gradientEnd={item.gradientEnd}
      index={index}
    />

    {/* Content Card */}
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }}
    >
      <ThemedText
        numberOfLines={1}
        style={{
          fontSize: 17,
          fontFamily: Fonts.bold,
          color: colors.text,
          marginBottom: 4,
          textAlign: isRight ? 'right' : 'left',
        }}
      >
        {item.title}
      </ThemedText>
      <ThemedText
        numberOfLines={2}
        style={{
          fontSize: 13,
          fontFamily: Fonts.regular,
          color: isDark ? '#999' : '#666',
          lineHeight: 18,
          textAlign: isRight ? 'right' : 'left',
        }}
      >
        {item.desc}
      </ThemedText>
    </View>
  </MotiView>
);

export default function Landing() {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === "dark";
  const colors = Colors[scheme];
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

  const FEATURES: Feature[] = [
    {
      id: '1',
      icon: "school",
      title: "Verified Students",
      desc: ".edu email required. No imposters.",
      gradientStart: "#10B981",
      gradientEnd: "#059669",
    },
    {
      id: '2',
      icon: "heart",
      title: "Campus Dating",
      desc: "Find your match nearby.",
      gradientStart: "#F43F5E",
      gradientEnd: "#E11D48",
    },
    {
      id: '3',
      icon: "people",
      title: "Communities",
      desc: "Clubs, Greek life, faith groups.",
      gradientStart: "#8B5CF6",
      gradientEnd: "#7C3AED",
    },
    {
      id: '4',
      icon: "chatbubbles",
      title: "Real-time Chat",
      desc: "Instant messaging that works.",
      gradientStart: "#06B6D4",
      gradientEnd: "#0891B2",
    },
    {
      id: '5',
      icon: "shield-checkmark",
      title: "Private & Encrypted",
      desc: "No ads. No tracking. Ever.",
      gradientStart: "#3B82F6",
      gradientEnd: "#2563EB",
    },
  ];

  const bgColor = isDark ? '#050505' : '#FFFFFF';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HERO ===== */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24 }}>

          {/* Minimal Header - Single Sign In */}
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <LinearGradient
                  colors={[colors.primary, '#1A6B3F']}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <ThemedText style={{ color: '#fff', fontFamily: Fonts.bold, fontSize: 14 }}>CT</ThemedText>
                </LinearGradient>
                <ThemedText style={{ fontSize: 16, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -0.3 }}>
                  CommunityTalk
                </ThemedText>
              </View>

              <Pressable onPress={() => router.push("/modal")}>
                <View style={{
                  paddingHorizontal: 16, paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isDark ? '#333' : '#E0E0E0',
                }}>
                  <ThemedText style={{ fontSize: 13, fontFamily: Fonts.bold, color: colors.text }}>Log in</ThemedText>
                </View>
              </Pressable>
            </View>
          </MotiView>

          {/* Hero Text - Clean & Bold */}
          <View style={{ marginBottom: 20 }}>
            <MotiView
              from={{ opacity: 0, translateY: 15 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 100 }}
            >
              <ThemedText style={{
                fontSize: 44,
                fontFamily: Fonts.bold,
                color: colors.text,
                lineHeight: 48,
                letterSpacing: -1.5,
              }}>
                Your Campus.
              </ThemedText>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 15 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 180 }}
            >
              <ThemedText style={{
                fontSize: 44,
                fontFamily: Fonts.bold,
                color: colors.primary,
                lineHeight: 48,
                letterSpacing: -1.5,
              }}>
                Your People.
              </ThemedText>
            </MotiView>
          </View>

          {/* Subtitle */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 260 }}
          >
            <ThemedText style={{
              fontSize: 15,
              fontFamily: Fonts.regular,
              color: isDark ? '#888' : '#555',
              lineHeight: 22,
              marginBottom: 28,
            }}>
              The exclusive network for verified .edu students.
            </ThemedText>
          </MotiView>

          {/* Single Primary CTA */}
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 340, type: 'spring' }}
          >
            <Pressable
              onPress={() => router.push("/register")}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <LinearGradient
                colors={[colors.primary, '#1A6B3F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <ThemedText style={{ color: '#fff', fontSize: 16, fontFamily: Fonts.bold }}>
                  Get Started →
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </MotiView>
        </View>

        {/* ===== ZIGZAG JOURNEY ===== */}
        <View style={{ marginTop: 56, alignItems: 'center' }}>

          {/* Start Dot */}
          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 450, type: 'spring' }}
            style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: colors.text,
              marginBottom: 16,
            }}
          />

          {/* Features with Connectors */}
          {FEATURES.map((item, index) => {
            const isRight = index % 2 !== 0;
            const isLast = index === FEATURES.length - 1;

            return (
              <React.Fragment key={item.id}>
                <FeatureRow
                  item={item}
                  index={index}
                  isRight={isRight}
                  isDark={isDark}
                  colors={colors}
                />
                {!isLast && (
                  <VerticalConnector isDark={isDark} index={index} />
                )}
              </React.Fragment>
            );
          })}

          {/* End Dot */}
          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1000, type: 'spring' }}
            style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: colors.primary,
              marginTop: 24,
            }}
          />
        </View>

        {/* ===== FINAL CTA ===== */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 1100 }}
          style={{ paddingHorizontal: 24, marginTop: 48 }}
        >
          <Pressable
            onPress={() => router.push("/register")}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
          >
            <View
              style={{
                backgroundColor: isDark ? '#111' : '#F8F8F8',
                borderRadius: 24,
                paddingVertical: 32,
                paddingHorizontal: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: isDark ? '#222' : '#EEE',
              }}
            >
              <ThemedText style={{
                fontSize: 22,
                fontFamily: Fonts.bold,
                color: colors.text,
                marginBottom: 16,
              }}>
                Ready to connect?
              </ThemedText>

              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 12,
                }}
              >
                <ThemedText style={{ color: '#fff', fontSize: 15, fontFamily: Fonts.bold }}>
                  Join Free →
                </ThemedText>
              </View>
            </View>
          </Pressable>
        </MotiView>
      </ScrollView>
    </View>
  );
}
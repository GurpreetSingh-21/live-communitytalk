import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
  FadeInUp,
  withSequence,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/src/context/AuthContext";
import { Colors, Fonts } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Feature = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  desc: string;
  span?: number;
};

const FEATURES: Feature[] = [
  {
    id: "1",
    icon: "shield-check",
    title: "100% Verified.",
    desc: "Exclusively .edu verified. Real students only.",
    span: 1, // Full width in bento
  },
  {
    id: "2",
    icon: "heart-flash",
    title: "Crush.",
    desc: "That cute person from the library.",
    span: 0.5,
  },
  {
    id: "3",
    icon: "account-group",
    title: "Crew.",
    desc: "Clubs, Greek life & true vibes.",
    span: 0.5,
  },
  {
    id: "4",
    icon: "flash",
    title: "Never Miss Out.",
    desc: "Parties, mixers, and exclusive campus events. Know what's happening before everyone else does.",
    span: 1,
  },
];

// --- ULTRA PREMIUM FAINT GRID BACKGROUND ---
const GridBackground = ({ isDark }: { isDark: boolean }) => {
  const lineColor = isDark ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.022)";
  const horizontalLines = Array.from({ length: 40 });
  const verticalLines = Array.from({ length: 15 });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { flexDirection: "column", justifyContent: "space-between" }]}>
        {horizontalLines.map((_, i) => (
          <View key={`h-${i}`} style={{ height: 1, backgroundColor: lineColor, width: "100%" }} />
        ))}
      </View>
      <View style={[StyleSheet.absoluteFillObject, { flexDirection: "row", justifyContent: "space-between" }]}>
        {verticalLines.map((_, i) => (
          <View key={`v-${i}`} style={{ width: 1, backgroundColor: lineColor, height: "100%" }} />
        ))}
      </View>
      <LinearGradient
        colors={[
          isDark ? "#0A0A0A" : "#FFFFFF",
          "transparent",
          "transparent",
          isDark ? "#0A0A0A" : "#FFFFFF",
        ]}
        locations={[0, 0.1, 0.9, 1]}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
};

// --- INFINITE MARQUEE ---
const MarqueeText = ({ text, isDark, primaryColor }: { text: string; isDark: boolean; primaryColor: string }) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-SCREEN_WIDTH * 2, {
        duration: 12000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const repeatedText = Array(15).fill(text).join("  ◈  ");

  return (
    <View
      style={{
        overflow: "hidden",
        paddingVertical: 18,
        backgroundColor: isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)",
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
        marginVertical: 40,
      }}
    >
      <Animated.View style={[{ flexDirection: "row", width: SCREEN_WIDTH * 4 }, animatedStyle]}>
        <Text
          style={{
            fontSize: 13,
            fontFamily: Fonts.mono,
            color: primaryColor,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.8,
          }}
        >
          {repeatedText}
        </Text>
      </Animated.View>
    </View>
  );
};

// --- METRIC CARD ---
const MetricCard = ({ isDark, colors, title, subtitle, index }: any) => {
  return (
    <Animated.View
      entering={FadeInUp.delay(600 + index * 100).springify().damping(18)}
      style={{
        flex: 1,
        backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
        alignItems: "flex-start",
        justifyContent: "space-between",
        minHeight: 140,
      }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: `${colors.primary}15`,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20
      }}>
        <Text style={{ color: colors.primary, fontFamily: Fonts.bold, fontSize: 16 }}>✦</Text>
      </View>
      <View>
        <Text style={{ fontSize: 28, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -1, lineHeight: 34 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, fontFamily: Fonts.regular, color: colors.textMuted, marginTop: 4 }}>
          {subtitle}
        </Text>
      </View>
    </Animated.View>
  );
};

export default function Landing() {
  const scheme = useColorScheme() ?? "light";
  const isDark = scheme === "dark";
  const colors = Colors[scheme];
  const auth = React.useContext(AuthContext);
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    if (auth?.isAuthed) router.replace("/(tabs)");
  }, [auth?.isAuthed]);

  useFocusEffect(
    React.useCallback(() => {
      if (auth?.isAuthed) router.replace("/(tabs)");
    }, [auth?.isAuthed]) // Added missing dependency bracket element
  );

  const bgColor = isDark ? "#0A0A0A" : "#FFFFFF";

  const heroStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [-50, 400], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(scrollY.value, [-100, 400], [0, 150], Extrapolation.CLAMP) },
        { scale: interpolate(scrollY.value, [-100, 400], [1, 0.95], Extrapolation.CLAMP) },
      ],
    };
  });

  const introBlur = useSharedValue(100);
  useEffect(() => {
    introBlur.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.exp) });
  }, []);

  const blurStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(introBlur.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    };
  });

  const pulseScale = useSharedValue(1);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Render Features as beautifully spaced BENTO items
  const renderFeatures = () => {
    const rows = [];
    let currentSpan = 0;
    let currentRow: Feature[] = [];

    FEATURES.forEach((feature) => {
      if (currentSpan + (feature.span || 1) > 1) {
        rows.push(currentRow);
        currentRow = [feature];
        currentSpan = feature.span || 1;
      } else {
        currentRow.push(feature);
        currentSpan += feature.span || 1;
      }
    });
    if (currentRow.length > 0) rows.push(currentRow);

    return rows.map((row, rowIndex) => (
      <View key={`row-${rowIndex}`} style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
        {row.map((feat, colIndex) => (
          <Animated.View
            key={feat.id}
            entering={FadeInUp.delay(300 + (rowIndex * 150) + (colIndex * 100)).springify().damping(18)}
            style={{
              flex: feat.span === 1 ? 1 : 0.5,
              backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              padding: 28,
              borderRadius: 32, // Smooth organic premium shape
            }}
          >
            <View style={{
              width: 50, height: 50,
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF",
              alignItems: "center", justifyContent: "center",
              borderRadius: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.05,
              shadowRadius: 8,
            }}>
              <MaterialCommunityIcons name={feat.icon} size={24} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 22, fontFamily: Fonts.bold, letterSpacing: -0.5, color: colors.text, marginBottom: 8, lineHeight: 28 }}>
              {feat.title}
            </Text>
            <Text style={{ fontSize: 15, fontFamily: Fonts.regular, color: colors.textMuted, lineHeight: 24 }}>
              {feat.desc}
            </Text>
          </Animated.View>
        ))}
      </View>
    ));
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      <GridBackground isDark={isDark} />

      {/* HEADER NAVBAR */}
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          zIndex: 100,
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
          paddingBottom: 16,
          backgroundColor: isDark ? "rgba(10,10,10,0.5)" : "rgba(255,255,255,0.5)",
        }}
      >
        <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
        <Animated.View entering={FadeInDown.duration(1000).springify().damping(20)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image 
              source={require("@/assets/images/icon.png")} 
              style={{ width: 26, height: 26, borderRadius: 6 }} 
              resizeMode="contain"
            />
            <Text style={{ fontSize: 24, fontFamily: Fonts.bold, letterSpacing: -1, color: colors.text }}>
              Campustry.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/modal")}
            style={({ pressed }) => ({
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 100, // Pill capsule
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: colors.text, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Log in
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140, paddingTop: insets.top + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* PARALLAX HERO GREETING */}
        <Animated.View style={[{ paddingHorizontal: 24, marginTop: 40, marginBottom: 80 }, heroStyle]}>
          <Animated.View entering={FadeInUp.delay(200).springify().damping(18)}>
            {/* Minimalist Top Tag */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 32 }}>
              <View style={{ height: 1, width: 48, backgroundColor: colors.textMuted, opacity: 0.5 }} />
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, textTransform: "uppercase", color: colors.textMuted, letterSpacing: 3, opacity: 0.8 }}>
                The College Network
              </Text>
            </View>

            {/* Typography Fixed with Regular Native Text */}
            <Text
              style={{
                fontSize: 72,
                fontFamily: Fonts.bold,
                color: colors.text,
                lineHeight: Platform.OS === 'ios' ? 76 : 82, // Extremely generous line height to prevent clipping
                letterSpacing: -3.5,
                marginBottom: 32,
              }}
            >
              Your campus.{"\n"}
              <Text style={{ color: colors.primary }}>Reimagined.</Text>
            </Text>
            
            <Text
              style={{
                fontSize: 18,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                lineHeight: 30, // Relaxed line height
                letterSpacing: -0.3,
                maxWidth: "92%",
              }}
            >
              Stop lurking on five different platforms. Experience the ultimate social hub explicitly designed for verified students.
            </Text>
          </Animated.View>
        </Animated.View>

        {/* METRICS STACK */}
        <View style={{ paddingHorizontal: 24, marginBottom: 40 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <MetricCard isDark={isDark} colors={colors} index={0} title="100%" subtitle=".edu Verified" />
            <MetricCard isDark={isDark} colors={colors} index={1} title="24/7" subtitle="Campus Pulse" />
            <MetricCard isDark={isDark} colors={colors} index={2} title="1K+" subtitle="Live Users" />
          </View>
        </View>

        <MarqueeText text="The Exclusive Network" isDark={isDark} primaryColor={colors.text} />

        {/* STRUCTURAL ARCHITECTURE / BENTO FEATURES */}
        <View style={{ paddingHorizontal: 24, marginTop: 40, marginBottom: 60 }}>
          <Animated.View entering={FadeInUp.delay(300)}>
            {/* Fixed Overlapping Line Height */}
            <Text style={{ 
              fontSize: 48, 
              fontFamily: Fonts.bold, 
              letterSpacing: -2.5, 
              color: colors.text, 
              lineHeight: 56, // Fixed vertical spacing 
              marginBottom: 16 
            }}>
              Everything you need.
            </Text>
            <Text style={{ 
              fontSize: 18, 
              fontFamily: Fonts.regular, 
              color: colors.textMuted, 
              marginBottom: 48, 
              letterSpacing: -0.2,
              lineHeight: 28 
            }}>
              Built with precision. Designed without compromise.
            </Text>
          </Animated.View>

          <View>
            {renderFeatures()}
          </View>
        </View>

        {/* CALL TO ACTION */}
        <View style={{ paddingHorizontal: 24, marginTop: 60, alignItems: "center" }}>
          <Text style={{ fontSize: 36, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -1.5, textAlign: "center", marginBottom: 40, lineHeight: 44 }}>
            Ready to plug in?
          </Text>

          {/* Majestic Animated Capsule Button */}
          <Animated.View style={pulseStyle}>
            <Pressable
              onPress={() => router.push("/register")}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.95 : 1 }],
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.4,
                shadowRadius: 32,
                elevation: 12,
              })}
            >
              <LinearGradient
                colors={[colors.primary, isDark ? "#14532D" : "#15803D"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 22,
                  paddingHorizontal: 48,
                  borderRadius: 100, // True capsule
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              >
                <Text style={{ fontSize: 16, fontFamily: Fonts.bold, color: "#fff", letterSpacing: 1.5, textTransform: "uppercase" }}>
                  Aura Verified Connect
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Text style={{ fontSize: 13, fontFamily: Fonts.mono, color: colors.textMuted, marginTop: 32, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7 }}>
            Strictly .edu Encrypted
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Initial Entry Abstract Blur */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, blurStyle]}>
        <BlurView intensity={100} style={StyleSheet.absoluteFillObject} tint={isDark ? "dark" : "light"} />
      </Animated.View>
    </View>
  );
}
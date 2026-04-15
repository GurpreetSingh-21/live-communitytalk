import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation } from "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_STEPS = [
  {
    icon: "shield-check",
    title: "100% Student Verified",
    desc: "Strictly for active college students. No bots, no outsiders. Just your peers.",
  },
  {
    icon: "account-group",
    title: "Build Your Crew",
    desc: "Find clubs, roommates, and exclusive study groups on your exact campus.",
  },
  {
    icon: "flash",
    title: "Never Miss Out",
    desc: "Know exactly where the parties and exclusive campus events are happening.",
  },
];

const ScreenSlide = ({ item, index, scrollX, isDark }: any) => {
  const colors = Colors[isDark ? "dark" : "light"];

  const rStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], Extrapolation.CLAMP) }
      ]
    };
  });

  return (
    <Animated.View style={[{ width: SCREEN_WIDTH, justifyContent: "center", alignItems: "center", padding: 40 }, rStyle]}>
      <View style={{
        width: 120, height: 120,
        backgroundColor: colors.primary + "15",
        alignItems: "center", justifyContent: "center",
        borderRadius: 40,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: colors.primary + "30",
      }}>
        <MaterialCommunityIcons name={item.icon as any} size={60} color={colors.primary} />
      </View>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 32, color: colors.text, textAlign: "center", marginBottom: 16 }}>
        {item.title}
      </Text>
      <Text style={{ fontFamily: Fonts.regular, fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24 }}>
        {item.desc}
      </Text>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? "light";
  const isDark = scheme === "dark";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onMomentumEnd = (e: any) => {
    const ind = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(ind);
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem("hasViewedOnboarding", "true");
    router.replace("/(tabs)");
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * SCREEN_WIDTH, animated: true });
      setCurrentIndex(curr => curr + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#080808" : "#FFFFFF" }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      {/* Skip Button */}
      <View style={{ position: "absolute", top: insets.top + 20, right: 24, zIndex: 10 }}>
        <Pressable onPress={handleComplete}>
          <Text style={{ fontFamily: Fonts.bold, color: colors.textMuted, fontSize: 16 }}>Skip</Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        onScroll={scrollHandler}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        bounces={false}
      >
        {ONBOARDING_STEPS.map((item, index) => (
          <ScreenSlide key={index} item={item} index={index} scrollX={scrollX} isDark={isDark} />
        ))}
      </Animated.ScrollView>

      {/* Pagination & Next Button */}
      <View style={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 40, alignItems: "center" }}>
        
        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 40 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                height: 8,
                width: currentIndex === i ? 24 : 8,
                borderRadius: 4,
                backgroundColor: currentIndex === i ? colors.primary : colors.textMuted,
                opacity: currentIndex === i ? 1 : 0.3,
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={{
            backgroundColor: colors.primary,
            width: "100%",
            paddingVertical: 20,
            borderRadius: 100,
            alignItems: "center"
          }}
        >
          <Text style={{ color: "#fff", fontFamily: Fonts.bold, fontSize: 16 }}>
            {currentIndex === ONBOARDING_STEPS.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>

      </View>
    </View>
  );
}

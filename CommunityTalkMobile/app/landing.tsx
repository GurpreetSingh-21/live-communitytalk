import React, { useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from 'moti';

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
  size: 'small' | 'medium' | 'large';
  offset: 'left' | 'center' | 'right';
};

// Modern floating icon component with glassmorphism
const FloatingIcon: React.FC<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  index: number;
  colors: any;
}> = ({ icon, index, colors }) => (
  <MotiView
    from={{ scale: 0, opacity: 0, rotate: '-180deg' }}
    animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
    transition={{
      delay: 600 + index * 100,
      type: 'spring',
      damping: 15,
      stiffness: 100
    }}
  >
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
    </View>
  </MotiView>
);

// Creative feature card with varied sizes
const CreativeFeatureCard: React.FC<{
  item: Feature;
  index: number;
  isDark: boolean;
  colors: any;
}> = ({ item, index, isDark, colors }) => {
  const cardWidth = item.size === 'large' ? '95%' : item.size === 'medium' ? '85%' : '75%';
  const alignSelf = item.offset === 'left' ? 'flex-start' : item.offset === 'right' ? 'flex-end' : 'center';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 30, scale: 0.95 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{
        delay: 700 + index * 120,
        type: 'spring',
        damping: 16
      }}
      style={{
        width: cardWidth,
        alignSelf,
        marginVertical: 8,
      }}
    >
      <Pressable
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.98 : 1 }, { translateY: pressed ? 2 : 0 }],
        })}
      >
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
            borderRadius: 24,
            padding: item.size === 'small' ? 20 : 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: `${colors.primary}20`,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
              }}
            >
              <MaterialCommunityIcons name={item.icon} size={24} color={colors.primary} />
            </View>

            <ThemedText
              style={{
                flex: 1,
                fontSize: item.size === 'large' ? 22 : 20,
                fontFamily: Fonts.bold,
                color: colors.text,
                letterSpacing: -0.8,
                lineHeight: 26,
              }}
            >
              {item.title}
            </ThemedText>
          </View>

          <ThemedText
            style={{
              fontSize: 15,
              fontFamily: Fonts.regular,
              color: colors.textMuted,
              lineHeight: 22,
              letterSpacing: -0.2,
            }}
          >
            {item.desc}
          </ThemedText>
        </View>
      </Pressable>
    </MotiView>
  );
};

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
      icon: "shield-check",
      title: "No Catfish, Promise",
      desc: "100% .edu verified. Real students only. No random creeps from the internet.",
      size: 'large',
      offset: 'left',
    },
    {
      id: '2',
      icon: "heart-flash",
      title: "Find Your Campus Crush",
      desc: "Swipe on someone from your 8am lecture. Or that cute person from the library.",
      size: 'medium',
      offset: 'right',
    },
    {
      id: '3',
      icon: "account-group",
      title: "Actually Make Friends",
      desc: "Join clubs, Greek life, study groups. Find your people. Build your crew.",
      size: 'large',
      offset: 'center',
    },
    {
      id: '4',
      icon: "message-flash",
      title: "Group Chats That Hit",
      desc: "Coordinate plans. Share memes. Find a study buddy at 2am. We got you.",
      size: 'small',
      offset: 'left',
    },
    {
      id: '5',
      icon: "calendar-star",
      title: "Never Miss the Function",
      desc: "Parties, mixers, campus events. Know what's happening before everyone else.",
      size: 'large',
      offset: 'right',
    },
  ];

  const bgColor = isDark ? '#0A0A0A' : '#FAFAFA';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION */}
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24 }}>

          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600 }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
              }} />
              <ThemedText style={{
                fontSize: 24,
                fontFamily: Fonts.bold,
                letterSpacing: -1,
                color: colors.text
              }}>
                Campustry.
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.push("/modal")}
              style={({ pressed }) => ({
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 100,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                transform: [{ scale: pressed ? 0.96 : 1 }]
              })}
            >
              <ThemedText style={{
                fontSize: 15,
                fontFamily: Fonts.bold,
                color: colors.text,
                letterSpacing: -0.3
              }}>
                Log in
              </ThemedText>
            </Pressable>
          </MotiView>

          {/* Hero Image with Glass Overlay */}
          <MotiView
            from={{ opacity: 0, scale: 0.92, translateY: 30 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 80,
              delay: 100
            }}
            style={{
              height: 400,
              backgroundColor: isDark ? '#111111' : '#F5F5F5',
              borderRadius: 32,
              marginBottom: 28,
              overflow: 'hidden',
              position: 'relative',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: isDark ? 0.5 : 0.12,
              shadowRadius: 32,
              elevation: 12,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Image
              source={require('../assets/images/hero_collage.png')}
              style={{
                width: '100%',
                height: '100%',
                resizeMode: 'cover',
              }}
            />

            {/* Gradient Overlay */}
            <LinearGradient
              colors={[
                'transparent',
                'rgba(0,0,0,0.2)',
                'rgba(0,0,0,0.7)',
                'rgba(0,0,0,0.95)'
              ]}
              locations={[0.3, 0.5, 0.75, 1]}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 280
              }}
            />

            {/* Text Overlay */}
            <View style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              right: 24
            }}>
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 400, type: 'spring', damping: 18 }}
              >
                <ThemedText style={{
                  fontSize: 48,
                  fontFamily: Fonts.bold,
                  color: '#fff',
                  lineHeight: 52,
                  letterSpacing: -1.8,
                  marginBottom: 12,
                  textShadowColor: 'rgba(0,0,0,0.6)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 8,
                }}>
                  Your Campus.{'\n'}Your People.
                </ThemedText>
                <ThemedText style={{
                  fontSize: 17,
                  fontFamily: Fonts.regular,
                  color: 'rgba(255,255,255,0.95)',
                  lineHeight: 24,
                  letterSpacing: -0.3,
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 6,
                }}>
                  Where campus chemistry happens ✨
                </ThemedText>
              </MotiView>
            </View>

            {/* Floating Stat Badge */}
            <MotiView
              from={{ opacity: 0, scale: 0.8, translateY: -20 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ delay: 600, type: 'spring', damping: 12 }}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
                <ThemedText style={{
                  fontSize: 13,
                  fontFamily: Fonts.bold,
                  color: isDark ? '#FAFAFA' : '#0A0A0A',
                  letterSpacing: -0.2,
                }}>
                  1K+ Online
                </ThemedText>
              </View>
            </MotiView>
          </MotiView>

          {/* Catchy Tagline */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 200, type: 'spring', damping: 18 }}
            style={{ marginBottom: 48 }}
          >
            <ThemedText style={{
              fontSize: 17,
              fontFamily: Fonts.regular,
              color: colors.textMuted,
              lineHeight: 26,
              textAlign: 'center',
              letterSpacing: -0.3,
              paddingHorizontal: 12,
            }}>
              Stop lurking on 5 different apps.{'\n'}
              <ThemedText style={{ fontFamily: Fonts.bold, color: colors.primary }}>
                Your whole campus life is right here.
              </ThemedText>
            </ThemedText>
          </MotiView>
        </View>

        {/* OUR STORY SECTION - BENTO GRID LAYOUT */}
        <View style={{ paddingHorizontal: 24, marginBottom: 64 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.96, translateY: 30 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ delay: 300, type: 'spring', damping: 18 }}
          >
            {/* BENTO GRID CONTAINER */}
            <View style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
              borderRadius: 32,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: isDark ? 0.4 : 0.08,
              shadowRadius: 24,
              elevation: 8,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              gap: 16,
            }}>
              {/* HEADER BADGE */}
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: `${colors.primary}18`,
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
              }}>
                <ThemedText style={{
                  fontSize: 11,
                  fontFamily: Fonts.bold,
                  color: colors.primary,
                  letterSpacing: 1.2,
                }}>
                  THE REAL STORY
                </ThemedText>
              </View>

              {/* BENTO GRID: MAIN CONTENT + STATS */}
              <View style={{ flexDirection: 'row', gap: 16, minHeight: 220 }}>
                {/* LEFT: MAIN CONTENT (2/3 width) */}
                <View style={{ flex: 2, justifyContent: 'space-between' }}>
                  <ThemedText style={{
                    fontSize: 28,
                    fontFamily: Fonts.bold,
                    color: colors.text,
                    letterSpacing: -1,
                    lineHeight: 34,
                    marginBottom: 12,
                  }}>
                    Built by students who were tired of the BS.
                  </ThemedText>

                  <ThemedText style={{
                    fontSize: 15,
                    fontFamily: Fonts.regular,
                    color: colors.textMuted,
                    lineHeight: 24,
                    letterSpacing: -0.2,
                  }}>
                    Three friends from Queens College.{'\n'}
                    Tired of juggling 5 apps for campus life.
                  </ThemedText>
                </View>

                {/* RIGHT: STAT CARDS (1/3 width, stacked) */}
                <View style={{ flex: 1, gap: 12 }}>
                  {/* STAT CARD 1 */}
                  <View style={{
                    backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.03)',
                    borderRadius: 20,
                    padding: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: `${colors.primary}25`,
                    flex: 1,
                  }}>
                    <MaterialCommunityIcons name="shield-check" size={28} color={colors.primary} />
                    <ThemedText style={{
                      fontSize: 13,
                      fontFamily: Fonts.bold,
                      color: colors.text,
                      marginTop: 8,
                      letterSpacing: -0.3,
                      textAlign: 'center',
                    }}>
                      .edu Only
                    </ThemedText>
                  </View>

                  {/* STAT CARD 2 */}
                  <View style={{
                    backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.08)',
                    borderRadius: 20,
                    padding: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: `${colors.primary}25`,
                    flex: 1,
                  }}>
                    <ThemedText style={{
                      fontSize: 24,
                      fontFamily: Fonts.bold,
                      color: colors.primary,
                      letterSpacing: -0.8,
                    }}>
                      1K+
                    </ThemedText>
                    <ThemedText style={{
                      fontSize: 12,
                      fontFamily: Fonts.regular,
                      color: colors.textMuted,
                      marginTop: 2,
                    }}>
                      Students
                    </ThemedText>
                  </View>
                </View>
              </View>

              {/* TAGLINE */}
              <ThemedText style={{
                fontSize: 15,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                lineHeight: 22,
                letterSpacing: -0.2,
              }}>
                So we built Campustry — the{' '}
                <ThemedText style={{ fontFamily: Fonts.bold, color: colors.primary }}>
                  chemistry
                </ThemedText>
                {' '}between{' '}
                <ThemedText style={{ fontFamily: Fonts.bold, color: colors.primary }}>
                  campus
                </ThemedText>
                {' '}and community.
              </ThemedText>

              {/* BOTTOM: ICON BADGES (Equal grid) */}
              <View style={{
                flexDirection: 'row',
                gap: 10,
                marginTop: 8,
              }}>
                <View style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  paddingVertical: 12,
                  borderRadius: 16,
                  gap: 6,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}>
                  <MaterialCommunityIcons name="lock" size={16} color={colors.textMuted} />
                  <ThemedText style={{
                    fontSize: 12,
                    fontFamily: Fonts.bold,
                    color: colors.textMuted,
                  }}>
                    Safe
                  </ThemedText>
                </View>

                <View style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  paddingVertical: 12,
                  borderRadius: 16,
                  gap: 6,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}>
                  <MaterialCommunityIcons name="account-group" size={16} color={colors.textMuted} />
                  <ThemedText style={{
                    fontSize: 12,
                    fontFamily: Fonts.bold,
                    color: colors.textMuted,
                  }}>
                    Real
                  </ThemedText>
                </View>

                <View style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  paddingVertical: 12,
                  borderRadius: 16,
                  gap: 6,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}>
                  <MaterialCommunityIcons name="school" size={16} color={colors.textMuted} />
                  <ThemedText style={{
                    fontSize: 12,
                    fontFamily: Fonts.bold,
                    color: colors.textMuted,
                  }}>
                    QC
                  </ThemedText>
                </View>
              </View>
            </View>
          </MotiView>
        </View>

        {/* FEATURES SECTION HEADER */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 450, type: 'spring', damping: 18 }}
          >
            <ThemedText style={{
              fontSize: 36,
              fontFamily: Fonts.bold,
              color: colors.text,
              marginBottom: 14,
              letterSpacing: -1.4,
              textAlign: 'center',
              lineHeight: 40,
            }}>
              Everything you need.{'\n'}
              <ThemedText style={{ color: colors.primary }}>Nothing you don't.</ThemedText>
            </ThemedText>
            <ThemedText style={{
              fontSize: 16,
              fontFamily: Fonts.regular,
              color: colors.textMuted,
              lineHeight: 24,
              textAlign: 'center',
              letterSpacing: -0.3,
              paddingHorizontal: 20,
            }}>
              The features that actually matter for campus life
            </ThemedText>
          </MotiView>
        </View>

        {/* CREATIVE ZIGZAG FEATURES with VARIED SIZES */}
        <View style={{ alignItems: 'center', marginBottom: 64, paddingHorizontal: 24 }}>
          {/* START DOT */}
          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 600, type: 'spring', damping: 12 }}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.primary,
              marginBottom: 16,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          />

          {/* FEATURE CARDS */}
          {FEATURES.map((item, index) => (
            <CreativeFeatureCard
              key={item.id}
              item={item}
              index={index}
              isDark={isDark}
              colors={colors}
            />
          ))}

          {/* END DOT */}
          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1300, type: 'spring', damping: 12 }}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.primary,
              marginTop: 16,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          />
        </View>

        {/* FINAL CTA with GRADIENT */}
        <View style={{ paddingHorizontal: 24 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.96, translateY: 25 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ delay: 1400, type: 'spring', damping: 18 }}
          >
            <LinearGradient
              colors={isDark
                ? ['rgba(34,197,94,0.08)', 'rgba(22,163,74,0.12)']
                : ['#FFFFFF', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 28,
                paddingVertical: 40,
                paddingHorizontal: 28,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 24,
                elevation: 6,
              }}
            >
              <ThemedText style={{
                fontSize: 32,
                fontFamily: Fonts.bold,
                color: colors.text,
                marginBottom: 16,
                letterSpacing: -1.2,
                textAlign: 'center',
                lineHeight: 38,
              }}>
                Stop missing out.
              </ThemedText>

              <ThemedText style={{
                fontSize: 16,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                marginBottom: 36,
                textAlign: 'center',
                lineHeight: 24,
                letterSpacing: -0.3,
                paddingHorizontal: 12,
              }}>
                Join 1000+ students who actually know{'\n'}what's happening on campus.
              </ThemedText>

              <Pressable
                onPress={() => router.push("/register")}
                style={({ pressed }) => ({
                  width: '100%',
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                })}
              >
                <LinearGradient
                  colors={[colors.primary, isDark ? '#15803d' : '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 18,
                    paddingHorizontal: 32,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    elevation: 8,
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <ThemedText style={{
                    fontSize: 17,
                    fontFamily: Fonts.bold,
                    color: '#fff',
                    letterSpacing: -0.3
                  }}>
                    Let's Go
                  </ThemedText>
                  <ThemedText style={{
                    fontSize: 17,
                    color: '#fff',
                  }}>
                    →
                  </ThemedText>
                </LinearGradient>
              </Pressable>

              <ThemedText style={{
                fontSize: 13,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                marginTop: 20,
                letterSpacing: -0.2,
              }}>
                Free. Always will be.
              </ThemedText>
            </LinearGradient>
          </MotiView>
        </View>

      </ScrollView>
    </View>
  );
}
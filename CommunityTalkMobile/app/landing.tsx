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

const NODE_SIZE = 64;
const VERTICAL_SPACING = 100;

type Feature = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  desc: string;
  gradientStart: string;
  gradientEnd: string;
};

const GlowingNode: React.FC<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  gradientStart: string;
  gradientEnd: string;
  index: number;
}> = ({ icon, gradientStart, gradientEnd, index }) => (
  <MotiView
    from={{ scale: 0, opacity: 0, rotate: '-180deg' }}
    animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
    transition={{ delay: 600 + index * 120, type: 'spring', damping: 14 }}
  >
    <View
      style={{
        width: NODE_SIZE + 24,
        height: NODE_SIZE + 24,
        borderRadius: (NODE_SIZE + 24) / 2,
        backgroundColor: gradientStart,
        opacity: 0.12,
        position: 'absolute',
        top: -12,
        left: -12,
      }}
    />
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
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.25)',
      }}
    >
      <MaterialCommunityIcons name={icon} size={30} color="#FFFFFF" />
    </LinearGradient>
  </MotiView>
);

const VerticalConnector: React.FC<{ isDark: boolean; index: number }> = ({ isDark, index }) => (
  <MotiView
    from={{ scaleY: 0 }}
    animate={{ scaleY: 1 }}
    transition={{ delay: 650 + index * 120, type: 'timing', duration: 400 }}
    style={{
      width: 3,
      height: VERTICAL_SPACING - NODE_SIZE - 8,
      alignSelf: 'center',
      marginVertical: 4,
      borderRadius: 2,
      transformOrigin: 'top',
      overflow: 'hidden',
    }}
  >
    <LinearGradient
      colors={isDark ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)'] : ['rgba(34,197,94,0.2)', 'rgba(34,197,94,0.08)']}
      style={{ flex: 1 }}
    />
  </MotiView>
);

const FeatureRow: React.FC<{
  item: Feature;
  index: number;
  isRight: boolean;
  isDark: boolean;
  colors: any;
}> = ({ item, index, isRight, isDark, colors }) => (
  <MotiView
    from={{ opacity: 0, translateX: isRight ? 50 : -50, translateY: 15 }}
    animate={{ opacity: 1, translateX: 0, translateY: 0 }}
    transition={{ delay: 620 + index * 120, type: 'spring', damping: 15 }}
    style={{
      flexDirection: isRight ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 18,
    }}
  >
    <GlowingNode
      icon={item.icon}
      gradientStart={item.gradientStart}
      gradientEnd={item.gradientEnd}
      index={index}
    />

    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        borderRadius: 24,
        paddingVertical: 22,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
        shadowColor: item.gradientStart,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.15 : 0.08,
        shadowRadius: 20,
        elevation: 5,
      }}
    >
      <ThemedText
        style={{
          fontSize: 20,
          fontFamily: Fonts.bold,
          color: colors.text,
          marginBottom: 8,
          textAlign: isRight ? 'right' : 'left',
          letterSpacing: -0.6,
        }}
      >
        {item.title}
      </ThemedText>
      <ThemedText
        style={{
          fontSize: 15,
          fontFamily: Fonts.regular,
          color: colors.textMuted,
          lineHeight: 22,
          textAlign: isRight ? 'right' : 'left',
          letterSpacing: -0.3,
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
      icon: "shield-check",
      title: "No Catfish, Promise",
      desc: "100% .edu verified. Real students only. No random creeps from the internet.",
      gradientStart: colors.primary,
      gradientEnd: "#15803d",
    },
    {
      id: '2',
      icon: "heart-flash",
      title: "Find Your Campus Crush",
      desc: "Swipe on someone from your 8am lecture. Or that cute person from the library.",
      gradientStart: "#F43F5E",
      gradientEnd: "#BE123C",
    },
    {
      id: '3',
      icon: "account-group",
      title: "Actually Make Friends",
      desc: "Join clubs, Greek life, study groups. Find your people. Build your crew.",
      gradientStart: "#8B5CF6",
      gradientEnd: "#6D28D9",
    },
    {
      id: '4',
      icon: "message-flash",
      title: "Group Chats That Hit",
      desc: "Coordinate plans. Share memes. Find a study buddy at 2am. We got you.",
      gradientStart: "#06B6D4",
      gradientEnd: "#0E7490",
    },
    {
      id: '5',
      icon: "calendar-star",
      title: "Never Miss the Function",
      desc: "Parties, mixers, campus events. Know what's happening before everyone else.",
      gradientStart: "#F59E0B",
      gradientEnd: "#D97706",
    },
  ];

  const bgColor = isDark ? '#000000' : '#FAFAFA';

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
              marginBottom: 36,
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
                fontSize: 22,
                fontFamily: Fonts.bold,
                letterSpacing: -0.8,
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
                transform: [{ scale: pressed ? 0.95 : 1 }]
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

          {/* Hero Image */}
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 30 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 80,
              delay: 100
            }}
            style={{
              height: 400,
              backgroundColor: isDark ? '#0F0F0F' : '#E8F5E9',
              borderRadius: 36,
              marginBottom: 32,
              overflow: 'hidden',
              position: 'relative',
              shadowColor: isDark ? '#000' : colors.primary,
              shadowOffset: { width: 0, height: 24 },
              shadowOpacity: isDark ? 0.5 : 0.18,
              shadowRadius: 48,
              elevation: 24,
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

            <LinearGradient
              colors={[
                'transparent',
                'rgba(0,0,0,0.3)',
                'rgba(0,0,0,0.75)',
                'rgba(0,0,0,0.95)'
              ]}
              locations={[0.3, 0.55, 0.8, 1]}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 260
              }}
            />

            <View style={{
              position: 'absolute',
              bottom: 24,
              left: 28,
              right: 28
            }}>
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 400, type: 'spring', damping: 18 }}
              >
                <ThemedText style={{
                  fontSize: 44,
                  fontFamily: Fonts.bold,
                  color: '#fff',
                  lineHeight: 48,
                  letterSpacing: -1.8,
                  marginBottom: 12,
                  textShadowColor: 'rgba(0,0,0,0.6)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 8,
                }}>
                  Your Campus.{'\n'}Your People.
                </ThemedText>
                <ThemedText style={{
                  fontSize: 16,
                  fontFamily: Fonts.regular,
                  color: 'rgba(255,255,255,0.95)',
                  lineHeight: 22,
                  letterSpacing: -0.3,
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 6,
                }}>
                  Where campus chemistry happens ✨
                </ThemedText>
              </MotiView>
            </View>
          </MotiView>

          {/* Catchy Tagline */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 200, type: 'spring', damping: 18 }}
            style={{ marginBottom: 40 }}
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

        {/* OUR STORY SECTION */}
        <View style={{ paddingHorizontal: 24, marginBottom: 64 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.94, translateY: 30 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ delay: 300, type: 'spring', damping: 18 }}
          >
            <View style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
              borderRadius: 32,
              padding: 32,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.1,
              shadowRadius: 32,
              elevation: 8,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }}>
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: `${colors.primary}15`,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 100,
                marginBottom: 24,
              }}>
                <ThemedText style={{
                  fontSize: 11,
                  fontFamily: Fonts.bold,
                  color: colors.primary,
                  letterSpacing: 1,
                }}>
                  THE REAL STORY
                </ThemedText>
              </View>

              <ThemedText style={{
                fontSize: 26,
                fontFamily: Fonts.bold,
                color: colors.text,
                marginBottom: 20,
                letterSpacing: -0.8,
                lineHeight: 32,
              }}>
                Built by students who were tired of the BS.
              </ThemedText>

              <ThemedText style={{
                fontSize: 16,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                lineHeight: 26,
                letterSpacing: -0.3,
                marginBottom: 18,
              }}>
                We're three friends from Queens College. We saw students juggling Tinder, Instagram DMs, GroupMe, and random Discord servers just to connect with their own campus.
              </ThemedText>

              <ThemedText style={{
                fontSize: 16,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                lineHeight: 26,
                letterSpacing: -0.3,
                marginBottom: 18,
              }}>
                That's honestly ridiculous. So we built Campustry — the <ThemedText style={{ fontFamily: Fonts.bold, color: colors.text }}>chemistry</ThemedText> between <ThemedText style={{ fontFamily: Fonts.bold, color: colors.text }}>campus</ThemedText> and community.
              </ThemedText>

              <ThemedText style={{
                fontSize: 16,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                lineHeight: 26,
                letterSpacing: -0.3,
                marginBottom: 32,
              }}>
                One app. Verified students. Real connections. No weird randoms. That's it.
              </ThemedText>

              <View style={{
                flexDirection: 'row',
                gap: 10,
                flexWrap: 'wrap',
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(34,197,94,0.08)',
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  borderRadius: 100,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.15)',
                }}>
                  <MaterialCommunityIcons name="shield-check" size={18} color={colors.primary} />
                  <ThemedText style={{
                    fontSize: 14,
                    fontFamily: Fonts.bold,
                    color: colors.text,
                    letterSpacing: -0.2,
                  }}>
                    .edu Only
                  </ThemedText>
                </View>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(34,197,94,0.08)',
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  borderRadius: 100,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.15)',
                }}>
                  <MaterialCommunityIcons name="account-group" size={18} color={colors.primary} />
                  <ThemedText style={{
                    fontSize: 14,
                    fontFamily: Fonts.bold,
                    color: colors.text,
                    letterSpacing: -0.2,
                  }}>
                    1K+ Students
                  </ThemedText>
                </View>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(34,197,94,0.08)',
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  borderRadius: 100,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.15)',
                }}>
                  <MaterialCommunityIcons name="school" size={18} color={colors.primary} />
                  <ThemedText style={{
                    fontSize: 14,
                    fontFamily: Fonts.bold,
                    color: colors.text,
                    letterSpacing: -0.2,
                  }}>
                    Queens College
                  </ThemedText>
                </View>
              </View>
            </View>
          </MotiView>
        </View>

        {/* FEATURES SECTION HEADER */}
        <View style={{ paddingHorizontal: 24, marginBottom: 48 }}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 450, type: 'spring', damping: 18 }}
          >
            <ThemedText style={{
              fontSize: 32,
              fontFamily: Fonts.bold,
              color: colors.text,
              marginBottom: 14,
              letterSpacing: -1.2,
              textAlign: 'center',
              lineHeight: 38,
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

        {/* ZIGZAG FEATURES JOURNEY */}
        <View style={{ alignItems: 'center', marginBottom: 64 }}>
          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 550, type: 'spring', damping: 12 }}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.primary,
              marginBottom: 8,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
            }}
          />

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

          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1250, type: 'spring', damping: 12 }}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.primary,
              marginTop: 8,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
            }}
          />
        </View>

        {/* FINAL CTA */}
        <View style={{ paddingHorizontal: 24 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.94, translateY: 25 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ delay: 1350, type: 'spring', damping: 18 }}
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
              borderRadius: 28,
              paddingVertical: 40,
              paddingHorizontal: 28,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.08,
              shadowRadius: 24,
              elevation: 6,
            }}
          >
            <ThemedText style={{
              fontSize: 28,
              fontFamily: Fonts.bold,
              color: colors.text,
              marginBottom: 16,
              letterSpacing: -1,
              textAlign: 'center',
              lineHeight: 34,
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
                colors={[colors.primary, '#15803d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 18,
                  paddingHorizontal: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <ThemedText style={{
                  fontSize: 16,
                  fontFamily: Fonts.bold,
                  color: '#fff',
                  letterSpacing: -0.2
                }}>
                  Let's Go
                </ThemedText>
                <ThemedText style={{
                  fontSize: 16,
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
          </MotiView>
        </View>

      </ScrollView>
    </View>
  );
}
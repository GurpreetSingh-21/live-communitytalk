// CommunityTalkMobile/app/profile/invite.tsx
import React, { useContext, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Share,
  Dimensions,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/src/context/AuthContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';

export default function InviteFriendsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const auth = useContext(AuthContext);
  const user = auth.user;

  const bg = colors.background;
  const cardBg = colors.surface;
  const border = colors.border;
  const textPrimary = colors.text;
  const textSecondary = colors.textMuted;
  const accent = colors.primary;

  // Animations
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }]
  }));

  // Data
  const username = useMemo(() => {
    const full = (user?.fullName || 'user').toLowerCase().replace(/\s+/g, '');
    return full || 'student';
  }, [user?.fullName]);

  const APP_LINK = `https://communitytalk.app/@${username}`;

  const inviteMessage = useMemo(
    () =>
      `Hey! I’m connected on CommunityTalk to our campus.\n\n` +
      `Sign up with my link and get 2 FREE dating swipes: ${APP_LINK}\n\n` +
      `See you there!`,
    [APP_LINK],
  );

  const handleShare = async () => {
    try {
      await Share.share({ message: inviteMessage });
    } catch (e) { }
  };

  const handleShareDMs = async () => {
    try {
      await Share.share({ message: inviteMessage + '\n\nDM me once you’re in!' });
    } catch (e) { }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0, paddingHorizontal: 24, paddingBottom: 16 }}>
        <View className="flex-row items-center justify-between py-2">
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              paddingVertical: 8, paddingHorizontal: 16, borderRadius: 100
            }}
          >
            <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={18} color={textPrimary} />
            {/* Replaced Fonts.medium with Fonts.sans (which is medium weight) */}
            <Text style={{ color: textPrimary, fontSize: 14, fontFamily: Fonts.sans }}>Back</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Reward Story Section - Spacious & Centered */}
        <View style={{ marginTop: 40, marginBottom: 60, alignItems: 'center' }}>

          {/* Animated Graphic */}
          <View style={{ height: 180, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            {/* Back Card (Friend's Reward) */}
            <Animated.View style={[
              {
                position: 'absolute',
                width: 100, height: 130,
                backgroundColor: isDark ? '#334155' : '#E2E8F0',
                borderRadius: 24,
                transform: [{ rotate: '-10deg' }, { translateX: -40 }],
                justifyContent: 'center', alignItems: 'center',
                borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'white',
              },
              animatedIconStyle
            ]}>
              <Text style={{ fontSize: 32 }}>✌️</Text>
              <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: textSecondary, marginTop: 8, letterSpacing: 1 }}>THEM</Text>
              <Text style={{ fontSize: 20, fontFamily: Fonts.bold, color: textPrimary }}>+2</Text>
            </Animated.View>

            {/* Front Card (User's Reward) */}
            <Animated.View style={[
              {
                width: 110, height: 140,
                backgroundColor: accent,
                borderRadius: 28,
                transform: [{ rotate: '8deg' }, { translateX: 30 }],
                justifyContent: 'center', alignItems: 'center',
                shadowColor: accent, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
                zIndex: 2
              },
              animatedIconStyle
            ]}>
              <Ionicons name="heart" size={42} color="white" />
              <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.9)', marginTop: 8, letterSpacing: 1 }}>YOU</Text>
              <Text style={{ fontSize: 22, fontFamily: Fonts.bold, color: 'white' }}>+1</Text>
            </Animated.View>
          </View>

          <Text style={{ fontSize: 36, fontFamily: Fonts.bold, color: textPrimary, textAlign: 'center', lineHeight: 44, marginBottom: 16 }}>
            Give Swipes,{'\n'}Get <Text style={{ color: accent }}>Swipes</Text>.
          </Text>

          <Text style={{ fontSize: 16, color: textSecondary, textAlign: 'center', lineHeight: 26, maxWidth: '85%' }}>
            Help bring your campus to CommunityTalk. Everyone wins when the network grows.
          </Text>
        </View>

        {/* Clean Link Container */}
        <View style={{ marginBottom: 40 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: cardBg,
            borderRadius: 28,
            padding: 10,
            borderWidth: 1, borderColor: border,
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }
          }}>
            <View style={{
              flex: 1,
              paddingHorizontal: 20,
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 10, color: textSecondary, fontFamily: Fonts.bold, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                Your Link
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: Fonts.bold, color: textPrimary }}>
                communitytalk.app/@{username}
              </Text>
            </View>

            <Pressable
              onPress={handleShare}
              style={({ pressed }) => ({
                backgroundColor: textPrimary,
                paddingVertical: 18,
                paddingHorizontal: 28,
                borderRadius: 22,
                transform: [{ scale: pressed ? 0.96 : 1 }],
                flexDirection: 'row', gap: 8, alignItems: 'center'
              })}
            >
              <Text style={{ color: bg, fontFamily: Fonts.bold, fontSize: 15 }}>Share</Text>
              <Ionicons name="arrow-forward" size={16} color={bg} />
            </Pressable>
          </View>
        </View>

        {/* Minimal Footer Actions - Spaced Out */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32 }}>
          <Pressable
            onPress={handleShareDMs}
            style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: isDark ? '#1e293b' : '#F1F5F9',
              alignItems: 'center', justifyContent: 'center', marginBottom: 10,
              borderWidth: 1, borderColor: border
            }}>
              <Ionicons name="chatbubbles" size={24} color={textPrimary} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: textSecondary }}>DM</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/communities')}
            style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: isDark ? '#1e293b' : '#F1F5F9',
              alignItems: 'center', justifyContent: 'center', marginBottom: 10,
              borderWidth: 1, borderColor: border
            }}>
              <Ionicons name="qr-code" size={24} color={textPrimary} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: textSecondary }}>Code</Text>
          </Pressable>

          <Pressable
            onPress={() => Share.share({ message: APP_LINK })}
            style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: isDark ? '#1e293b' : '#F1F5F9',
              alignItems: 'center', justifyContent: 'center', marginBottom: 10,
              borderWidth: 1, borderColor: border
            }}>
              <Ionicons name="logo-instagram" size={24} color={textPrimary} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: Fonts.bold, color: textSecondary }}>Story</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
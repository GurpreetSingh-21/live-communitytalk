// CommunityTalkMobile/app/profile/invite.tsx
import React, { useContext, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Share,
  useColorScheme as useDeviceColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/src/context/AuthContext';

const APP_LINK = 'https://communitytalk.app'; // 🔧 update to your real link later

export default function InviteFriendsScreen() {
  const insets = useSafeAreaInsets();
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === 'dark';

  const auth = useContext(AuthContext);
  const user = auth.user;

  const bg = isDark ? '#020617' : '#F1F5F9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const border = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(15,23,42,0.06)';
  const textPrimary = isDark ? '#F9FAFB' : '#020617';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const accent = '#6366F1';

  const firstName = useMemo(() => {
    const full = (user?.fullName || '').trim();
    if (!full) return 'your friends';
    return `${full.split(' ')[0]}'s friends`;
  }, [user?.fullName]);

  const inviteMessage = useMemo(
    () =>
      `Hey, I’m using CommunityTalk to connect with students and communities on campus.\n\n` +
      `Join me here: ${APP_LINK}\n\n` +
      `It’s for .edu email accounts only, so it stays college-focused.`,
    [],
  );

  const handleShare = async () => {
    try {
      await Share.share({
        message: inviteMessage,
      });
    } catch (e) {
      // Ignore cancel; nothing critical
    }
  };

  const handleShareDMs = async () => {
    // For now, just open the native share sheet with a slightly tweaked message
    try {
      await Share.share({
        message:
          inviteMessage +
          '\n\nIf you install it, DM me inside the app so we can test it together.',
      });
    } catch (e) {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <View className="flex-row items-center justify-between py-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            android_ripple={{ color: isDark ? '#1F2937' : '#E5E7EB', borderless: true }}
          >
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
              size={22}
              color={textPrimary}
            />
            <Text style={{ color: textPrimary, fontSize: 16 }}>Back</Text>
          </Pressable>

          <Text
            style={{
              color: textPrimary,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            Invite friends
          </Text>

          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32 + insets.bottom,
        }}
      >
        {/* Hero / intro card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 16,
            marginTop: 8,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View
              style={{
                height: 40,
                width: 40,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#0F172A' : '#EEF2FF',
                marginRight: 12,
              }}
            >
              <Ionicons name="sparkles-outline" size={22} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 18,
                  fontWeight: '700',
                }}
              >
                Bring {firstName} into the same app
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                Share a simple link so people you actually know can join your
                college communities, DMs, and groups.
              </Text>
            </View>
          </View>

          {/* Primary invite button */}
          <Pressable
            onPress={handleShare}
            style={{
              marginTop: 14,
              borderRadius: 999,
              backgroundColor: accent,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              Share invite link
            </Text>
          </Pressable>

          {/* Tiny helper text */}
          <Text
            style={{
              color: textSecondary,
              fontSize: 11,
              marginTop: 6,
            }}
          >
            This opens your phone’s share sheet, so you can send it over text,
            WhatsApp, Instagram, or wherever you talk to people.
          </Text>
        </View>

        {/* Section title */}
        <Text
          style={{
            marginTop: 24,
            marginBottom: 8,
            color: textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Share from inside CommunityTalk
        </Text>

        {/* Share via DMs / Communities */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: border,
            paddingVertical: 4,
          }}
        >
          {/* Share in DMs */}
          <Pressable
            onPress={handleShareDMs}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: border,
            }}
          >
            <View
              style={{
                height: 32,
                width: 32,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#020617' : '#E0F2FE',
                marginRight: 10,
              }}
            >
              <Ionicons name="paper-plane-outline" size={18} color={textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              >
                Share to close friends
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                Pick a small group of people you trust and send them your invite
                link first.
              </Text>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </Pressable>

          {/* Jump straight to Communities tab */}
          <Pressable
            onPress={() => router.push('/(tabs)/communities')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <View
              style={{
                height: 32,
                width: 32,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#020617' : '#ECFEFF',
                marginRight: 10,
              }}
            >
              <Ionicons name="people-outline" size={18} color={textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              >
                Show them your communities
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                Once they join, you can add them into the same groups so everything
                lives in one place.
              </Text>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </Pressable>
        </View>

        {/* Section: The link */}
        <Text
          style={{
            marginTop: 24,
            marginBottom: 8,
            color: textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Your invite link
        </Text>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <Text
            style={{
              color: textPrimary,
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 4,
            }}
          >
            Share this anywhere
          </Text>
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            Anyone with a .edu email can use this link to create an account and
            join communities. If you change schools, you can always make a new
            account with your new .edu later.
          </Text>

          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: isDark ? '#020617' : '#F9FAFB',
            }}
          >
            <Text
              selectable
              style={{
                color: textPrimary,
                fontSize: 13,
              }}
            >
              {APP_LINK}
            </Text>
          </View>

          <Text
            style={{
              color: textSecondary,
              fontSize: 11,
              marginTop: 6,
            }}
          >
            Tip: long-press the link above to copy it manually if you prefer.
          </Text>
        </View>

        {/* Coming soon / trust note */}
        <Text
          style={{
            marginTop: 24,
            marginBottom: 8,
            color: textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Later features
        </Text>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <Text
            style={{
              color: textPrimary,
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 4,
            }}
          >
            Invite stats coming soon
          </Text>
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
            }}
          >
            In a later update, you’ll be able to see how many people installed
            the app from your invite link and which communities are growing the
            fastest around you.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
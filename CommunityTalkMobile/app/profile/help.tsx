// CommunityTalkMobile/app/profile/help.tsx
import React, { useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Linking,
  useColorScheme as useDeviceColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/src/context/AuthContext';

const SUPPORT_EMAIL = 'support@communitytalk.app'; // 🔧 change if you have a real one

export default function HelpAndSupportScreen() {
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

  const firstName =
    (user?.fullName || '')
      .trim()
      .split(' ')
      .filter(Boolean)[0] || 'you';

  const openEmail = async (subject: string, body: string) => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        Alert.alert(
          'Email not available',
          `You can email us at:\n\n${SUPPORT_EMAIL}`,
          [{ text: 'OK', style: 'default' }],
        );
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      Alert.alert(
        'Email not available',
        `You can email us at:\n\n${SUPPORT_EMAIL}`,
        [{ text: 'OK', style: 'default' }],
      );
    }
  };

  const handleReportProblem = () => {
    const bodyLines = [
      `Hi CommunityTalk team,`,
      ``,
      `I’d like to report a problem I’m seeing in the app.`,
      ``,
      `Brief description:`,
      `- `,
      ``,
      `Steps to reproduce:`,
      `1) `,
      `2) `,
      `3) `,
      ``,
      `Device / OS:`,
      `- Platform: ${Platform.OS}`,
      ``,
      user?.email ? `Account email: ${user.email}` : '',
      ``,
      `Thanks!`,
    ].join('\n');
    openEmail('Issue report from CommunityTalk app', bodyLines);
  };

  const handleContactSupport = () => {
    const bodyLines = [
      `Hi CommunityTalk team,`,
      ``,
      `I need help with my account or something inside the app.`,
      ``,
      `What I need help with:`,
      `- `,
      ``,
      user?.email ? `Account email: ${user.email}` : '',
      ``,
      `Thanks!`,
    ].join('\n');
    openEmail('Help with CommunityTalk account', bodyLines);
  };

  const handleCodeHelp = () => {
    Alert.alert(
      'Not getting your 6-digit code?',
      [
        '• Make sure you typed your .edu email correctly.',
        '• Check spam / promotions / “other” folders.',
        '• Some schools delay or filter external emails — wait a minute and try again.',
        `• If it still doesn’t show up, use “Contact support” so we can check your email domain.`,
      ].join('\n'),
      [{ text: 'OK', style: 'default' }],
    );
  };

  const handleSafety = () => {
    Alert.alert(
      'Safety & urgent issues',
      [
        'CommunityTalk is not an emergency service.',
        '',
        'For anything that feels unsafe or urgent:',
        '• Contact campus security or local authorities first.',
        '• Then you can report the behavior or community to us so we can review it.',
      ].join('\n'),
      [{ text: 'OK', style: 'default' }],
    );
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
            Help &amp; Support
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
        {/* Intro card */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View
              style={{
                height: 32,
                width: 32,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#0F172A' : '#EEF2FF',
                marginRight: 10,
              }}
            >
              <Ionicons name="help-circle-outline" size={18} color={accent} />
            </View>
            <Text
              style={{
                color: textPrimary,
                fontSize: 16,
                fontWeight: '700',
              }}
            >
              Need help with CommunityTalk?
            </Text>
          </View>

          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            This space is for {firstName.toLowerCase() === 'you' ? 'you' : firstName}{' '}
            to get help with login, verification codes, communities, or anything
            else inside the app.
          </Text>
        </View>

        {/* Quick help section title */}
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
          Quick help
        </Text>

        {/* Report a problem */}
        <Pressable
          onPress={handleReportProblem}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#FEF2F2',
                }}
              >
                <Ionicons name="bug-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '80%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Report a problem
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Something broken, slow, or not loading correctly? Send us a quick
                  bug report.
                </Text>
              </View>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </View>
        </Pressable>

        {/* Contact support */}
        <Pressable
          onPress={handleContactSupport}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#EEF2FF',
                }}
              >
                <Ionicons name="mail-unread-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '80%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Contact support
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Have a question about your account, communities, or something else?
                  Email our support team.
                </Text>
              </View>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </View>
        </Pressable>

        {/* Verification code FAQ */}
        <Pressable
          onPress={handleCodeHelp}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#E0F2FE',
                }}
              >
                <Ionicons name="key-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '80%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  I’m not getting the 6-digit code
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Tips for fixing verification email issues with your .edu address.
                </Text>
              </View>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </View>
        </Pressable>

        {/* Safety & guidelines */}
        <Pressable
          onPress={handleSafety}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#ECFEFF',
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '80%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Safety & community guidelines
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Learn how we want people to use CommunityTalk and what to do if you
                  see something off.
                </Text>
              </View>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </View>
        </Pressable>

        {/* Campus / emergency note */}
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
          For urgent safety
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
            CommunityTalk is not 911
          </Text>
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
            }}
          >
            If you or someone around you is in danger, contact campus security or
            local emergency services first. You can always report behavior or
            communities in the app afterwards so we can review it.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
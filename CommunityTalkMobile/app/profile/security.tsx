// CommunityTalkMobile/app/profile/security.tsx
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '@/src/context/AuthContext';
import { api } from '@/src/api/api'; // backend API client

const PRIVACY_PREFS_KEY = 'ct_privacy_prefs_v1';
const SUPPORT_EMAIL = 'support@communitytalk.app'; // 🔧 change when you have a real one

type PrivacyPrefs = {
  showOnlineStatus: boolean;
  allowDMsFromSameCollege: boolean;
  allowDMsFromOthers: boolean;
  showMessagePreviews: boolean; // client-only
};

const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  showOnlineStatus: true,
  allowDMsFromSameCollege: true,
  allowDMsFromOthers: false,
  showMessagePreviews: true,
};

export default function SecurityAndPrivacyScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const auth = useContext(AuthContext);
  const user = auth.user;

  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PRIVACY_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  const bg = colors.background;
  const cardBg = colors.surface;
  const border = colors.border;
  const textPrimary = colors.text;
  const textSecondary = colors.textMuted;
  const accent = colors.primary;

  // ───────────────── Load cached prefs (local) ─────────────────
  useEffect(() => {
    const loadLocal = async () => {
      try {
        const stored = await AsyncStorage.getItem(PRIVACY_PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPrefs({ ...DEFAULT_PRIVACY_PREFS, ...parsed });
        } else {
          setPrefs(DEFAULT_PRIVACY_PREFS);
        }
      } catch {
        setPrefs(DEFAULT_PRIVACY_PREFS);
      } finally {
        setLoadingPrefs(false);
      }
    };
    loadLocal();
  }, []);

  // ───────────────── Sync from backend (/api/notification-prefs) ─────────────────
  useEffect(() => {
    let cancelled = false;

    const syncFromServer = async () => {
      // If not logged in, nothing to sync
      if (!user?._id) return;

      try {
        setLoadingPrefs(true);
        const res = await api.get('/api/notification-prefs');
        const serverPrefs =
          (res.data && (res.data.notificationPrefs || res.data)) || {};

        if (cancelled) return;

        setPrefs((current) => ({
          ...current,
          // Only override the server-backed fields
          showOnlineStatus:
            typeof serverPrefs.showOnlineStatus === 'boolean'
              ? serverPrefs.showOnlineStatus
              : current.showOnlineStatus,
          allowDMsFromSameCollege:
            typeof serverPrefs.allowDMsFromSameCollege === 'boolean'
              ? serverPrefs.allowDMsFromSameCollege
              : current.allowDMsFromSameCollege,
          allowDMsFromOthers:
            typeof serverPrefs.allowDMsFromOthers === 'boolean'
              ? serverPrefs.allowDMsFromOthers
              : current.allowDMsFromOthers,
        }));
      } catch (err) {
        console.warn('[privacy] Failed to load privacy prefs from server:', err);
        // keep local prefs; no hard error
      } finally {
        if (!cancelled) {
          setLoadingPrefs(false);
        }
      }
    };

    syncFromServer();

    return () => {
      cancelled = true;
    };
  }, [user?._id]);

  // Save (local only) – used for optimistic updates + offline cache
  const savePrefs = async (next: PrivacyPrefs) => {
    setPrefs(next);
    try {
      await AsyncStorage.setItem(PRIVACY_PREFS_KEY, JSON.stringify(next));
    } catch {
      // not fatal
    }
  };

  const handleToggle = async (key: keyof PrivacyPrefs, value: boolean) => {
    if (saving) return;

    const next: PrivacyPrefs = { ...prefs, [key]: value };

    setSaving(true);
    try {
      // Small guard: if user disables "allowDMsFromSameCollege" AND "allowDMsFromOthers"
      // they basically block new DMs. That's allowed, but we can warn once.
      if (key === 'allowDMsFromSameCollege' || key === 'allowDMsFromOthers') {
        const result = { ...next };
        if (!result.allowDMsFromSameCollege && !result.allowDMsFromOthers) {
          Alert.alert(
            'Message requests turned off',
            'New people won’t be able to start message requests with you until you turn one of these options back on.',
          );
        }
      }

      // 1) Optimistic local update
      await savePrefs(next);

      // 2) Push to backend (ONLY for fields the server knows about)
      const isServerBackedKey =
        key === 'showOnlineStatus' ||
        key === 'allowDMsFromSameCollege' ||
        key === 'allowDMsFromOthers';

      if (isServerBackedKey && user?._id) {
        const payload: Record<string, boolean> = {};

        // Always send a full snapshot of server-backed fields so the backend
        // has a consistent picture (avoids partial merge bugs).
        payload.showOnlineStatus = next.showOnlineStatus;
        payload.allowDMsFromSameCollege = next.allowDMsFromSameCollege;
        payload.allowDMsFromOthers = next.allowDMsFromOthers;

        try {
          const res = await api.put('/api/notification-prefs', payload);
          const serverPrefs =
            (res.data && (res.data.notificationPrefs || res.data)) || {};

          // Merge back any canonical values from the server
          setPrefs((current) => ({
            ...current,
            showOnlineStatus:
              typeof serverPrefs.showOnlineStatus === 'boolean'
                ? serverPrefs.showOnlineStatus
                : current.showOnlineStatus,
            allowDMsFromSameCollege:
              typeof serverPrefs.allowDMsFromSameCollege === 'boolean'
                ? serverPrefs.allowDMsFromSameCollege
                : current.allowDMsFromSameCollege,
            allowDMsFromOthers:
              typeof serverPrefs.allowDMsFromOthers === 'boolean'
                ? serverPrefs.allowDMsFromOthers
                : current.allowDMsFromOthers,
          }));
        } catch (err) {
          console.error('[privacy] update failed:', err);
          Alert.alert(
            'Could not update',
            'We could not save these privacy settings to the server. Your local settings will still apply on this device.',
          );
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out from CommunityTalk on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await auth.signOut();
          } catch { }
          router.replace('/landing');
        },
      },
    ]);
  };

  const openEmail = async (subject: string, body: string) => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    try {
      const can = await Linking.canOpenURL(mailto);
      if (!can) {
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

  const handleDeleteAccount = () => {
    const email = user?.email || 'your .edu email';
    Alert.alert(
      'Delete account',
      [
        'This will remove your CommunityTalk account and associated data from our systems.',
        '',
        'We currently handle deletion requests manually to keep things safe and prevent abuse.',
        '',
        `Do you want to email support from ${email} to request deletion?`,
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support',
          style: 'destructive',
          onPress: () => {
            const bodyLines = [
              'Hi CommunityTalk team,',
              '',
              'I want to permanently delete my CommunityTalk account.',
              '',
              `Account email: ${user?.email || '<add your .edu email here>'}`,
              user?._id ? `Account ID: ${user._id}` : '',
              '',
              'If possible, please confirm once this has been completed.',
              '',
              'Thanks.',
            ].join('\n');
            openEmail('Request to delete CommunityTalk account', bodyLines);
          },
        },
      ],
    );
  };

  const maskedEmail = (() => {
    const email = user?.email || '';
    if (!email.includes('@')) return email || 'Not set';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `**@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  })();

  // extra right padding so iOS switches sit fully inside the card
  const rowWithSwitchStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingRight: Platform.OS === 'ios' ? 6 : 0,
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
              fontFamily: Fonts.bold,
            }}
          >
            Privacy &amp; Security
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
        {/* Login & sessions card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 18,
            marginTop: 8,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 14 }}>
            <View
              style={{
                height: 40,
                width: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#0F172A' : '#EFF6FF',
                marginTop: 2
              }}
            >
              <Ionicons name="lock-closed" size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 4 }}>
                Login & sessions
              </Text>
              <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                View the basics of your account and sign out safely on this device.
              </Text>
            </View>
          </View>

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: border,
              padding: 16,
              backgroundColor: isDark ? '#020617' : '#F8FAFC',
              marginBottom: 16
            }}
          >
            <Text
              style={{
                color: textSecondary,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 6,
                fontFamily: Fonts.bold,
              }}
            >
              Signed in as
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
              <Text style={{ color: textPrimary, fontSize: 15, fontFamily: Fonts.bold }}>
                {maskedEmail}
              </Text>
            </View>
            <Text style={{ color: textSecondary, fontSize: 12, marginTop: 4 }}>
              Device: {Platform.OS === 'ios' ? 'iOS' : 'Android'} app
            </Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={{
              alignSelf: 'flex-start',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.8)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 14, fontFamily: Fonts.bold }}>
              Sign out on this device
            </Text>
          </Pressable>
        </View>

        {/* Privacy controls */}
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
          Privacy controls
        </Text>

        {/* Show online status */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#ECFEFF',
                }}
              >
                <Ionicons name="ellipse" size={18} color={textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Show online status
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Let people see when you’re active or recently online.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.showOnlineStatus}
              onValueChange={(v) => handleToggle('showOnlineStatus', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* DMs from same college */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#E0F2FE',
                }}
              >
                <Ionicons name="school" size={20} color={textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Message requests from your college
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Allow new message requests from people who share your verified college community.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.allowDMsFromSameCollege}
              onValueChange={(v) => handleToggle('allowDMsFromSameCollege', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* DMs from others */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#FEF2F2',
                }}
              >
                <Ionicons name="people" size={20} color={textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Message requests from other communities
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Let people from other approved communities send you message requests.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.allowDMsFromOthers}
              onValueChange={(v) => handleToggle('allowDMsFromOthers', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* Notification previews (local-only) */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 18,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            shadowColor: '#000',
            shadowOpacity: 0.02,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#EEF2FF',
                }}
              >
                <Ionicons
                  name="notifications-circle"
                  size={22}
                  color={textPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Show message previews
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  When this is on, new message notifications can show a preview of the content.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.showMessagePreviews}
              onValueChange={(v) => handleToggle('showMessagePreviews', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* Danger zone */}
        <Text
          style={{
            marginTop: 32,
            marginBottom: 12,
            color: textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            paddingHorizontal: 4
          }}
        >
          Danger zone
        </Text>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: colors.danger + '40',
            shadowColor: colors.danger,
            shadowOpacity: 0.05,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 }
          }}
        >
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <Ionicons name="warning-outline" size={24} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 16,
                  fontFamily: Fonts.bold,
                  marginBottom: 6,
                }}
              >
                Delete my account
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  lineHeight: 20
                }}
              >
                This is permanent. Your communities, messages, and connections will be removed.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleDeleteAccount}
            style={{
              width: '100%',
              borderRadius: 14,
              paddingVertical: 12,
              backgroundColor: colors.danger + '15',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.danger + '30'
            }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text
              style={{
                color: colors.danger,
                fontSize: 14,
                fontFamily: Fonts.bold,
              }}
            >
              Request account deletion
            </Text>
          </Pressable>
        </View>

        {/* Footer note */}
        <Text
          style={{
            marginTop: 24,
            color: textSecondary,
            fontSize: 11,
          }}
        >
          These settings control how your presence, message requests, and account
          safety work inside CommunityTalk. Your device&apos;s system settings and
          your campus policies still apply on top of this.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
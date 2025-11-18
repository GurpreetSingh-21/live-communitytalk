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
  useColorScheme as useDeviceColorScheme,
} from 'react-native';
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
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === 'dark';

  const auth = useContext(AuthContext);
  const user = auth.user;

  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PRIVACY_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  const bg = isDark ? '#020617' : '#F1F5F9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const border = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(15,23,42,0.06)';
  const textPrimary = isDark ? '#F9FAFB' : '#020617';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const accent = '#6366F1';

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

  // ───────────────── Sync from backend (/privacy-prefs) ─────────────────
  useEffect(() => {
    let cancelled = false;

    const syncFromServer = async () => {
      // If not logged in, nothing to sync
      if (!user?._id) return;

      try {
        setLoadingPrefs(true);
        const res = await api.get('/privacy-prefs');
        const serverPrefs =
          (res.data && (res.data.privacyPrefs || res.data)) || {};

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
          const res = await api.put('/privacy-prefs', payload);
          const serverPrefs =
            (res.data && (res.data.privacyPrefs || res.data)) || {};

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
          } catch {}
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
              fontWeight: '700',
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
              <Ionicons name="lock-closed-outline" size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 16,
                  fontWeight: '700',
                }}
              >
                Login & sessions
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                View the basics of your account and sign out safely on this device.
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 10,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: isDark ? '#020617' : '#F9FAFB',
            }}
          >
            <Text
              style={{
                color: textSecondary,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 4,
                fontWeight: '600',
              }}
            >
              Signed in as
            </Text>
            <Text
              style={{
                color: textPrimary,
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {maskedEmail}
            </Text>
            <Text
              style={{
                color: textSecondary,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              Device: {Platform.OS === 'ios' ? 'iOS' : 'Android'} app
            </Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={{
              marginTop: 12,
              alignSelf: 'flex-start',
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 14,
              backgroundColor: isDark ? '#111827' : '#0F172A',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="log-out-outline" size={16} color="#F9FAFB" />
            <Text
              style={{
                color: '#F9FAFB',
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              Sign out on this device
            </Text>
          </Pressable>

          <Text
            style={{
              color: textSecondary,
              fontSize: 11,
              marginTop: 6,
            }}
          >
            If you think someone else has access to your account, sign out here and
            then contact support from your .edu email so we can review it.
          </Text>
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
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between" style={rowWithSwitchStyle}>
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
                <Ionicons name="ellipse-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Show online status
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Let people see when you’re active or recently online. Turning this
                  off will hide your green dot / “last seen”.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.showOnlineStatus}
              onValueChange={(v) => handleToggle('showOnlineStatus', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* DMs from same college */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between" style={rowWithSwitchStyle}>
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
                <Ionicons name="school-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Message requests from your college
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={3}>
                  Allow new message requests from people who share your verified
                  college community.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.allowDMsFromSameCollege}
              onValueChange={(v) => handleToggle('allowDMsFromSameCollege', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* DMs from others */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between" style={rowWithSwitchStyle}>
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
                <Ionicons name="people-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Message requests from other communities
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={3}>
                  Let people from other approved communities send you message
                  requests. You can always ignore or decline requests you don’t want.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.allowDMsFromOthers}
              onValueChange={(v) => handleToggle('allowDMsFromOthers', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* Notification previews */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View className="flex-row items-center justify-between" style={rowWithSwitchStyle}>
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
                <Ionicons
                  name="notifications-circle-outline"
                  size={18}
                  color={textPrimary}
                />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Show message previews
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={3}>
                  When this is on, new message notifications can show a preview of the
                  content on your lock screen. Turning it off will keep content more
                  private.
                </Text>
              </View>
            </View>
            <Switch
              disabled={loadingPrefs}
              value={prefs.showMessagePreviews}
              onValueChange={(v) => handleToggle('showMessagePreviews', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* Danger zone */}
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
          Danger zone
        </Text>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.4)',
          }}
        >
          <Text
            style={{
              color: textPrimary,
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 6,
            }}
          >
            Delete my account
          </Text>
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            This is permanent. Your communities, messages, and connections will be
            removed according to our data retention policy.
          </Text>

          <Pressable
            onPress={handleDeleteAccount}
            style={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 14,
              backgroundColor: '#991B1B',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#FEE2E2" />
            <Text
              style={{
                color: '#FEE2E2',
                fontSize: 13,
                fontWeight: '600',
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
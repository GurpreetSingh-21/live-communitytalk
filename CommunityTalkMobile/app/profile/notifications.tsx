// CommunityTalkMobile/app/profile/notifications.tsx
import React, { useEffect, useState } from 'react';
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
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '@/src/utils/notifications';
import { api } from '@/src/api/api';

const PREFS_KEY = 'ct_notification_prefs_v1';

type NotificationPrefs = {
  pushEnabled: boolean;
  dms: boolean;
  communities: boolean;
  mentions: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  dms: true,
  communities: true,
  mentions: true,
};

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === 'dark';

  const bg = isDark ? '#020617' : '#F1F5F9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const border = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(15,23,42,0.06)';
  const textPrimary = isDark ? '#F9FAFB' : '#020617';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const accent = '#6366F1';

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permStatus, setPermStatus] = useState<PermissionStatus>('undetermined');
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load prefs (local + server) + permission status on mount
  useEffect(() => {
    const load = async () => {
      // 1) Local cache first
      try {
        const stored = await AsyncStorage.getItem(PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPrefs({ ...DEFAULT_PREFS, ...parsed });
        } else {
          setPrefs(DEFAULT_PREFS);
        }
      } catch {
        setPrefs(DEFAULT_PREFS);
      }

      // 2) Server-side prefs (source of truth)
      try {
        const res = await api.get<{ notificationPrefs?: Partial<NotificationPrefs> }>(
          '/api/notification-prefs'
        );
        const serverPrefs = res.data?.notificationPrefs;
        if (serverPrefs) {
          const merged: NotificationPrefs = {
            ...DEFAULT_PREFS,
            ...serverPrefs,
          };
          setPrefs(merged);
          await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(merged));
        }
      } catch (e: any) {
        console.warn(
          'Failed to load notification preferences from server',
          e?.response?.status,
          e?.message
        );
      }

      // 3) OS permission status
      try {
        const perm = await Notifications.getPermissionsAsync();
        const status = (perm.status ?? 'undetermined') as PermissionStatus;
        setPermStatus(status);
      } catch {
        setPermStatus('undetermined');
      } finally {
        setLoadingPerms(false);
      }
    };

    load();
  }, []);

  // Save to local cache + backend
  const savePrefs = async (next: NotificationPrefs) => {
    setPrefs(next);

    // Local
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // not fatal
    }

    // Server (Discord-style real prefs)
    try {
      await api.put('/api/notification-prefs', next);
    } catch (e: any) {
      console.warn(
        'Failed to sync notification preferences to server',
        e?.response?.status,
        e?.message
      );
    }
  };

  const humanStatus = (() => {
    if (loadingPerms) return 'Checking…';
    switch (permStatus) {
      case 'granted':
        return 'Allowed';
      case 'denied':
        return 'Blocked in system settings';
      default:
        return 'Not decided yet';
    }
  })();

  const openSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Open settings',
        Platform.OS === 'android'
          ? 'Please open your system settings and find Notification settings for this app.'
          : 'Please open your system settings and adjust notification settings for this app.'
      );
    }
  };

  const handleTogglePush = async (value: boolean) => {
    if (saving) return;
    setSaving(true);

    try {
      if (value) {
        // Turning ON push
        if (permStatus === 'granted') {
          await registerForPushNotificationsAsync();
          await savePrefs({ ...prefs, pushEnabled: true });
        } else if (permStatus === 'denied') {
          Alert.alert(
            'Notifications blocked',
            [
              'Notifications are currently blocked in your system settings.',
              '',
              'To turn them back on:',
              '1) Open system settings',
              '2) Find CommunityTalk',
              '3) Enable notifications for this app',
            ].join('\n'),
            [{ text: 'Open settings', onPress: openSystemSettings }, { text: 'OK' }]
          );
          await savePrefs({ ...prefs, pushEnabled: false });
        } else {
          // undetermined → request permission
          const req = await Notifications.requestPermissionsAsync();
          const newStatus = (req.status ?? 'undetermined') as PermissionStatus;
          setPermStatus(newStatus);

          if (newStatus === 'granted') {
            await registerForPushNotificationsAsync();
            await savePrefs({ ...prefs, pushEnabled: true });
          } else {
            Alert.alert(
              'Notifications not enabled',
              'We could not get permission for notifications. You can try again, or change this later in system settings.'
            );
            await savePrefs({ ...prefs, pushEnabled: false });
          }
        }
      } else {
        // Turning OFF push (app-level)
        await savePrefs({ ...prefs, pushEnabled: false });
        Alert.alert(
          'Push notifications',
          'We will use this setting to mute new notifications from CommunityTalk. You can also fully disable them from your system settings.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (key === 'pushEnabled') {
      await handleTogglePush(value);
      return;
    }
    const next = { ...prefs, [key]: value };
    await savePrefs(next);
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
            Notifications
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
        {/* System status card */}
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
              <Ionicons name="notifications-outline" size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 16,
                  fontWeight: '700',
                }}
              >
                System notification status
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                This is controlled by your device’s settings. The app preferences
                below sit on top of this.
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: textSecondary,
                fontSize: 13,
              }}
            >
              Status
            </Text>
            <Text
              style={{
                color:
                  permStatus === 'granted'
                    ? isDark
                      ? '#BBF7D0'
                      : '#15803D'
                    : permStatus === 'denied'
                    ? '#EF4444'
                    : textSecondary,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {humanStatus}
            </Text>
          </View>

          <Pressable
            onPress={openSystemSettings}
            style={{
              marginTop: 12,
              alignSelf: 'flex-start',
              borderRadius: 999,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.7)',
              paddingHorizontal: 12,
              paddingVertical: 7,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="settings-outline" size={16} color={textPrimary} />
            <Text
              style={{
                color: textPrimary,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              Open system settings
            </Text>
          </Pressable>
        </View>

        {/* App-level preferences */}
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
          App preferences
        </Text>

        {/* Master switch */}
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
                <Ionicons name="notifications-circle-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Push notifications
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Turn all CommunityTalk notifications on or off from the app side.
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.pushEnabled}
              onValueChange={(v) => handleToggle('pushEnabled', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* DMs */}
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
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  DMs & private messages
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Alerts when someone sends you a direct message or opens a new DM thread.
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.dms}
              onValueChange={(v) => handleToggle('dms', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* Communities */}
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
                <Ionicons name="people-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Community updates
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  New posts in communities you’ve joined, or announcements from mods/admins.
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.communities}
              onValueChange={(v) => handleToggle('communities', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* Mentions */}
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
                <Ionicons name="at-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '75%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Mentions & replies
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  When someone replies to your post or tags you directly.
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.mentions}
              onValueChange={(v) => handleToggle('mentions', v)}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              trackColor={{ false: '#6B7280', true: accent }}
            />
          </View>
        </View>

        {/* Footer note */}
        <Text
          style={{
            marginTop: 24,
            color: textSecondary,
            fontSize: 11,
          }}
        >
          These settings control how CommunityTalk uses notifications for your
          account. Your device’s system settings can still override everything
          here.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
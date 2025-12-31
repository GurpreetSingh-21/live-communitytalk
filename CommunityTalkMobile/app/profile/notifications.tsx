// CommunityTalkMobile/app/profile/notifications.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { registerForPushNotificationsAsync } from "@/src/utils/notifications";
import { api } from "@/src/api/api";
import { getAccessToken } from "@/src/utils/storage";

const PREFS_KEY = "ct_notification_prefs_v1";

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

type PermissionStatus = "granted" | "denied" | "undetermined";

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  // UI Colors
  const bg = colors.background;
  const cardBg = colors.surface;
  const border = colors.border;
  const textPrimary = colors.text;
  const textSecondary = colors.textMuted;
  const accent = colors.primary;

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permStatus, setPermStatus] = useState<PermissionStatus>("undetermined");
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ────────────────────────────────────────────────
     LOAD PREFS + SERVER SYNC + PERMISSIONS
     ──────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        // Local first
        const stored = await AsyncStorage.getItem(PREFS_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        } else {
          setPrefs(DEFAULT_PREFS);
        }
      } catch {
        setPrefs(DEFAULT_PREFS);
      }

      // Server sync only if authenticated
      try {
        const token = await getAccessToken();
        if (token) {
          const res = await api.get<{ notificationPrefs?: Partial<NotificationPrefs> }>(
            "/api/notification-prefs"
          );
          const serverPrefs = res.data?.notificationPrefs;
          if (serverPrefs) {
            const merged = { ...DEFAULT_PREFS, ...serverPrefs };
            setPrefs(merged);
            await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(merged));
          }
        }
      } catch (e: any) {
        console.log(
          "[notify] Failed to load notification prefs from server →",
          e?.response?.status
        );
      }

      // Permission status
      try {
        const perm = await Notifications.getPermissionsAsync();
        setPermStatus((perm.status ?? "undetermined") as PermissionStatus);
      } catch {
        setPermStatus("undetermined");
      } finally {
        setLoadingPerms(false);
      }
    };

    load();
  }, []);

  /* ────────────────────────────────────────────────
     SAVE PREFS (local + server)
     ──────────────────────────────────────────────── */
  const savePrefs = async (next: NotificationPrefs) => {
    setPrefs(next);

    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch { }

    try {
      const token = await getAccessToken();
      if (token) {
        await api.put("/api/notification-prefs", next);
      }
    } catch (e: any) {
      console.warn(
        "[notify] Failed to sync preferences",
        e?.response?.status,
        e?.message
      );
    }
  };

  /* ────────────────────────────────────────────────
     HUMANIZED STATUS
     ──────────────────────────────────────────────── */
  const humanStatus = loadingPerms
    ? "Checking…"
    : permStatus === "granted"
      ? "Allowed"
      : permStatus === "denied"
        ? "Blocked in system settings"
        : "Not decided yet";

  const openSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Open settings",
        Platform.OS === "android"
          ? "Open your system settings → Notifications → CommunityTalk"
          : "Open Settings → Notifications → CommunityTalk"
      );
    }
  };

  /* ────────────────────────────────────────────────
     MASTER PUSH TOGGLE
     ──────────────────────────────────────────────── */
  const handleTogglePush = async (value: boolean) => {
    if (saving) return;
    setSaving(true);

    try {
      const token = await getAccessToken();

      if (value) {
        // TURN ON
        if (!token) {
          // Prevent 401 spam — user not logged in
          Alert.alert(
            "Login required",
            "You must be logged in to enable push notifications for CommunityTalk."
          );
          await savePrefs({ ...prefs, pushEnabled: false });
          return;
        }

        if (permStatus === "granted") {
          await registerForPushNotificationsAsync();
          await savePrefs({ ...prefs, pushEnabled: true });
        } else if (permStatus === "denied") {
          Alert.alert(
            "Notifications blocked",
            "Notifications are blocked in system settings. Enable them to continue.",
            [{ text: "Open settings", onPress: openSystemSettings }, { text: "Cancel" }]
          );
          await savePrefs({ ...prefs, pushEnabled: false });
        } else {
          const req = await Notifications.requestPermissionsAsync();
          const newStatus = (req.status ?? "undetermined") as PermissionStatus;
          setPermStatus(newStatus);

          if (newStatus === "granted") {
            await registerForPushNotificationsAsync();
            await savePrefs({ ...prefs, pushEnabled: true });
          } else {
            Alert.alert(
              "Permission not granted",
              "Notifications were not enabled. You can try again later."
            );
            await savePrefs({ ...prefs, pushEnabled: false });
          }
        }
      } else {
        // TURN OFF
        await savePrefs({ ...prefs, pushEnabled: false });
      }
    } finally {
      setSaving(false);
    }
  };

  /* ────────────────────────────────────────────────
     GENERIC TOGGLE HELPERS
     ──────────────────────────────────────────────── */
  const handleToggle = async (
    key: keyof NotificationPrefs,
    value: boolean
  ) => {
    if (key === "pushEnabled") return handleTogglePush(value);
    await savePrefs({ ...prefs, [key]: value });
  };

  /* ────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────── */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* HEADER */}
      <View
        style={{
          paddingTop: Platform.OS === "android" ? insets.top : 0,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <View className="flex-row items-center justify-between py-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
          >
            <Ionicons
              name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
              size={22}
              color={textPrimary}
            />
            <Text style={{ color: textPrimary, fontSize: 16 }}>Back</Text>
          </Pressable>

          <Text style={{ color: textPrimary, fontSize: 18, fontFamily: Fonts.bold }}>
            Notifications
          </Text>

          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* BODY */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32 + insets.bottom,
        }}
      >
        {/* SYSTEM STATUS CARD */}
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
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <View
              style={{
                height: 32,
                width: 32,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "#0F172A" : "#EEF2FF",
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
                  fontFamily: Fonts.bold,
                }}
              >
                System notification status
              </Text>

              <Text style={{ color: textSecondary, fontSize: 13, marginTop: 2 }}>
                Controlled by device settings. App preferences sit on top.
              </Text>
            </View>
          </View>

          {/* STATUS ROW */}
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: textSecondary, fontSize: 13 }}>Status</Text>

            <Text
              style={{
                color:
                  permStatus === "granted"
                    ? isDark
                      ? "#BBF7D0"
                      : "#15803D"
                    : permStatus === "denied"
                      ? "#EF4444"
                      : textSecondary,
                fontSize: 13,
                fontFamily: Fonts.bold,
              }}
            >
              {humanStatus}
            </Text>
          </View>

          {/* OPEN SETTINGS */}
          <Pressable
            onPress={openSystemSettings}
            style={{
              marginTop: 16,
              alignSelf: "flex-start",
              borderRadius: 14,
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="settings-outline" size={16} color={textPrimary} />
            <Text style={{ color: textPrimary, fontSize: 14, fontFamily: Fonts.bold }}>
              Open system settings
            </Text>
          </Pressable>
        </View>

        {/* ───────────────────────────────────────────── */}
        {/* APP-LEVEL PREFS */}
        {/* ───────────────────────────────────────────── */}
        <Text
          style={{
            marginTop: 24,
            marginBottom: 8,
            color: textSecondary,
            fontSize: 13,
            fontFamily: Fonts.bold,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          App preferences
        </Text>

        {/* MASTER PUSH SWITCH */}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#E0F2FE",
                }}
              >
                <Ionicons
                  name="notifications-circle-outline"
                  size={22}
                  color={textPrimary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Push notifications
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Turn all CommunityTalk notifications on/off from the app.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.pushEnabled}
              onValueChange={(v) => handleToggle("pushEnabled", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* DMs */}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#ECFEFF",
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={textPrimary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  DMs & private messages
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Alerts for direct messages.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.dms}
              onValueChange={(v) => handleToggle("dms", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* Communities */}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#FEF2F2",
                }}
              >
                <Ionicons name="people-outline" size={22} color={textPrimary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Community updates
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Notifications from communities you’ve joined.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.communities}
              onValueChange={(v) => handleToggle("communities", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        {/* Mentions */}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#EEF2FF",
                }}
              >
                <Ionicons name="at-outline" size={22} color={textPrimary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
                  Mentions & replies
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18 }}>
                  Alerts when someone tags you.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.mentions}
              onValueChange={(v) => handleToggle("mentions", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: isDark ? '#334155' : '#E2E8F0', true: accent }}
              style={{ transform: [{ scale: Platform.OS === 'ios' ? 0.8 : 1 }] }}
            />
          </View>
        </View>

        <Text
          style={{
            marginTop: 24,
            color: textSecondary,
            fontSize: 11,
          }}
        >
          These settings control how CommunityTalk uses notifications. Your system
          settings may still override them.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
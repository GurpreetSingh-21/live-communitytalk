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
  useColorScheme as useDeviceColorScheme,
} from "react-native";
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
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === "dark";

  // UI Colors
  const bg = isDark ? "#020617" : "#F1F5F9";
  const cardBg = isDark ? "#020617" : "#FFFFFF";
  const border = isDark ? "rgba(148,163,184,0.4)" : "rgba(15,23,42,0.06)";
  const textPrimary = isDark ? "#F9FAFB" : "#020617";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const accent = "#6366F1";

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
    } catch {}

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

          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: "700" }}>
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
                  fontWeight: "700",
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
                fontWeight: "600",
              }}
            >
              {humanStatus}
            </Text>
          </View>

          {/* OPEN SETTINGS */}
          <Pressable
            onPress={openSystemSettings}
            style={{
              marginTop: 12,
              alignSelf: "flex-start",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: isDark ? "rgba(148,163,184,0.6)" : "rgba(148,163,184,0.7)",
              paddingHorizontal: 12,
              paddingVertical: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="settings-outline" size={16} color={textPrimary} />
            <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600" }}>
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
            fontWeight: "600",
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#E0F2FE",
                }}
              >
                <Ionicons
                  name="notifications-circle-outline"
                  size={18}
                  color={textPrimary}
                />
              </View>

              <View style={{ maxWidth: "75%" }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: "600" }}>
                  Push notifications
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Turn all CommunityTalk notifications on/off from the app.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.pushEnabled}
              onValueChange={(v) => handleToggle("pushEnabled", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: "#6B7280", true: accent }}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#ECFEFF",
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={textPrimary} />
              </View>

              <View style={{ maxWidth: "75%" }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: "600" }}>
                  DMs & private messages
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Alerts for direct messages.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.dms}
              onValueChange={(v) => handleToggle("dms", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: "#6B7280", true: accent }}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#FEF2F2",
                }}
              >
                <Ionicons name="people-outline" size={18} color={textPrimary} />
              </View>

              <View style={{ maxWidth: "75%" }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: "600" }}>
                  Community updates
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Notifications from communities you’ve joined.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.communities}
              onValueChange={(v) => handleToggle("communities", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: "#6B7280", true: accent }}
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#020617" : "#EEF2FF",
                }}
              >
                <Ionicons name="at-outline" size={18} color={textPrimary} />
              </View>

              <View style={{ maxWidth: "75%" }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: "600" }}>
                  Mentions & replies
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={2}>
                  Alerts when someone tags you.
                </Text>
              </View>
            </View>

            <Switch
              value={prefs.mentions}
              onValueChange={(v) => handleToggle("mentions", v)}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              trackColor={{ false: "#6B7280", true: accent }}
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
// src/utils/notifications.ts
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "@/src/api/api";
import { getAccessToken } from "./storage";
import { notifyLogger as logger } from "./logger";

/* ───────────────────────────────────────────
   Foreground Notification Handler
   ─────────────────────────────────────────── */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,   // iOS banner
      shouldShowAlert: true,    // Android popup
      shouldShowList: true,     // Notification center
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  logger.debug("Foreground notification handler attached.");
} catch (err) {
  logger.error("Failed to attach notification handler:", err);
}

/* ───────────────────────────────────────────
   Main Function — Register for Push + Sync
   Called ONLY after login by AuthContext
   ─────────────────────────────────────────── */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // -----------------------------------------------------
  // 1. Skip entirely if user is not logged in
  // -----------------------------------------------------
  const jwt = await getAccessToken();
  if (!jwt) {
    logger.debug("Skipping push registration → user not logged in");
    return null;
  }

  let token: string | null = null;

  /* -----------------------------------------------------
     2. Android Notification Channel
     ----------------------------------------------------- */
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    } catch (err) {
      logger.error("Failed to set Android channel:", err);
    }
  }

  /* -----------------------------------------------------
     3. Ask Permissions
     ----------------------------------------------------- */
  logger.debug("Requesting permissions…");

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    finalStatus = req.status;
  }

  if (finalStatus !== "granted") {
    logger.warn("Permissions denied.");
    return null;
  }

  logger.debug("Permissions granted.");

  /* -----------------------------------------------------
     4. Generate Expo Push Token
     ----------------------------------------------------- */
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      logger.error("Missing expo.extra.eas.projectId");
      return null;
    }

    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    token = t.data;
    logger.debug("Expo push token:", token);
  } catch (err) {
    logger.error("Failed to get Expo push token:", err);
    return null;
  }

  /* -----------------------------------------------------
     5. Sync token with backend
     ----------------------------------------------------- */
  if (token) {
    const jwt2 = await getAccessToken(); // re-validate auth
    if (!jwt2) {
      logger.warn("Token generated but user not logged in → skipping backend sync.");
      return token;
    }

    try {
      await api.post("/api/notifications/register", { token });
      logger.info("Push token registered with backend ✔");
    } catch (err: any) {
      logger.error("Backend registration failed:");
      logger.error(" • Status:", err?.response?.status);
      logger.error(" • Data:", err?.response?.data);
      logger.error(" • Message:", err?.message);
      // Do NOT throw — notifications should never break app flow
    }
  }

  return token;
}
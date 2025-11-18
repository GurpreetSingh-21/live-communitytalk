// src/utils/notifications.ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '@/src/api/api';
import { getAccessToken } from '../utils/storage'; // ✅ NEW: check auth before hitting backend

// ✅ Configure notification handler (FIXED - removed shouldShowAlert)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,  // Show the notification banner at top (iOS)
      shouldShowList: true,    // Include in notification center/list
      shouldPlaySound: true,   // Play notification sound
      shouldSetBadge: false,   // Update app icon badge (iOS only)
    }),
  });
  console.log("Foreground notification handler set.");
} catch (e) {
  console.error("Failed to set notification handler:", e);
}

// Function to register for push notifications and send the token to the backend
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // --- 1. Set up Android Channel (required) ---
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (e) {
      console.error("Failed to set notification channel:", e);
    }
  }

  // --- 2. Request Permissions ---
  console.log('Requesting notification permissions...');
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('Permission not granted, asking user...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied by user.');
    return null;
  }
  console.log('Notification permissions granted.');

  // --- 3. Get the Expo Push Token ---
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.error('ERROR: Project ID not found in app.json');
      console.error('Add projectId under `expo.extra.eas.projectId` in app.json');
      alert('Error: Push notification setup is incomplete. Missing Project ID.');
      return null;
    }

    console.log(`Getting Expo push token using Project ID: ${projectId}`);
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token received:', token);
  } catch (error) {
    console.error('Error getting Expo Push Token:', error);
    alert('Failed to get push token. Please try restarting the app.');
    return null;
  }

  // --- 4. Send the token to your backend (ONLY if logged in) ---
  if (token) {
    try {
      // ✅ NEW: make sure we actually have a JWT before hitting /api/notifications/register
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.warn(
          "[push] Skipping backend registration: no access token in storage yet (user not logged in?)."
        );
        return token;
      }

      console.log(`Registering token with backend: ${token.substring(0, 20)}...`);
      await api.post('/api/notifications/register', { token });
      console.log('✅ Push token successfully registered with the backend.');
    } catch (error: any) {
      console.error('Failed to register push token with backend:');
      console.error('Status:', error?.response?.status);
      console.error('Data:', error?.response?.data);
      console.error('Message:', error?.message);
    }
  }

  return token;
}
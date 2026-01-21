// CommunityTalkMobile/app/_layout.tsx
import React, { useEffect, useContext } from "react";
import { Platform, LogBox } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "../global.css";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";
import { SocketProvider } from "../src/context/SocketContext";
import { registerForPushNotificationsAsync } from "@/src/utils/notifications";
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect as useReactEffect } from 'react';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs(["[Reanimated]", "SafeAreaView"]);

export const unstable_settings = {
  initialRouteName: "(tabs)",
};


function AppLayout() {
  const { isAuthed, isLoading } = useContext(AuthContext);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Define routes that are accessible without being logged in
    const publicRoutes = ["landing", "register", "verify-email"];

    // Routes that should be accessible to both auth states (don't redirect)
    const neutralRoutes = ["modal"];

    const currentRoute = segments[0] as string;
    const isPublicRoute = publicRoutes.includes(currentRoute);
    const isNeutralRoute = neutralRoutes.includes(currentRoute);

    // Don't redirect if it's a neutral route (modal can be used by both)
    if (isNeutralRoute) return;

    if (!isAuthed && !isPublicRoute) {
      // 🔒 Not logged in + trying to access protected route -> Redirect to Landing
      router.replace("/landing");
    } else if (isAuthed && isPublicRoute) {
      // 🔓 Logged in + trying to access public route -> Redirect to App
      router.replace("/(tabs)");
    }
  }, [isAuthed, segments, isLoading]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="landing" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-email" />

      <Stack.Screen
        name="modal"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen name="community/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="thread/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="dm/[id]" options={{ presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useReactEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        console.log("Registered push token:", token);
      } catch (e) {
        console.warn("Push registration failed:", e);
      }
    })();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <AuthProvider>
            <SocketProvider>
              {/* ✅ Render the AppLayout inside the providers */}
              <AppLayout />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
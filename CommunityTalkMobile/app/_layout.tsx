// app/_layout.tsx
import React, { useEffect } from "react";
import { Platform, LogBox } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "../global.css";
import { AuthProvider } from "../src/context/AuthContext";
import { SocketProvider } from "../src/context/SocketContext";
import { registerForPushNotificationsAsync } from "@/src/utils/notifications"; // ✅ your existing function

LogBox.ignoreLogs(["[Reanimated]", "SafeAreaView"]);

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const scheme = useColorScheme();
  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;

  // ✅ Register push notifications once on mount
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <AuthProvider>
            <SocketProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="landing" />
                <Stack.Screen name="register" />
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: Platform.OS === "ios" ? "formSheet" : "modal",
                    animation: "slide_from_bottom",
                  }}
                />
                <Stack.Screen name="community/[id]" options={{ presentation: "card" }} />
                <Stack.Screen name="thread/[id]" options={{ presentation: "card" }} />
              </Stack>
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
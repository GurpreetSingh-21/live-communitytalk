import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LogBox,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { MotiView } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { AuthContext } from "@/src/context/AuthContext";
import { api } from "@/src/api/api";
import { setAccessToken } from "@/src/utils/storage";

LogBox.ignoreLogs(["[Reanimated]"]);

type ModalContext = "communities" | "default";

/* ───────────────────────── Navigation helpers ───────────────────────── */
export const safeClose = () => {
  console.log("🔵 safeClose called");
  
  try {
    // Try to dismiss modal first
    if (typeof router.canDismiss === "function") {
      const canDismiss = router.canDismiss();
      console.log("🔵 canDismiss:", canDismiss);
      
      if (canDismiss && typeof router.dismiss === "function") {
        console.log("🔵 Dismissing modal");
        router.dismiss();
        return;
      }
    }
  } catch (err) {
    console.log("🔵 Dismiss failed:", err);
  }

  try {
    // Try to go back
    if (typeof router.canGoBack === "function") {
      const canGoBack = router.canGoBack();
      console.log("🔵 canGoBack:", canGoBack);
      
      if (canGoBack) {
        console.log("🔵 Going back");
        router.back();
        return;
      }
    }
  } catch (err) {
    console.log("🔵 Back failed:", err);
  }

  // Last resort: navigate to tabs
  console.log("🔵 Fallback: replacing to /(tabs)");
  try {
    router.replace("/(tabs)");
  } catch (err) {
    console.log("🔵 Replace failed:", err);
    // Absolute last resort
    router.push("/(tabs)");
  }
};

/** Leave the modal and navigate somewhere without breaking the back stack */
const navigateFromModal = (to: "/global/communities" | "/(tabs)/explore") => {
  console.log("🟢 navigateFromModal called with:", to);
  
  // Close the modal first, then navigate
  try {
    if (typeof router.canDismiss === "function" && router.canDismiss()) {
      console.log("🟢 Dismissing modal before navigation");
      if (typeof router.dismiss === "function") {
        router.dismiss();
      }
      // Use setTimeout to ensure modal is dismissed before navigating
      setTimeout(() => {
        console.log("🟢 Navigating to:", to);
        router.push(to);
      }, 150);
    } else {
      // If not in a modal, just navigate normally
      console.log("🟢 Direct navigation to:", to);
      router.push(to);
    }
  } catch (err) {
    console.log("🟢 Navigation error:", err);
    // Fallback: just try to navigate
    router.push(to);
  }
};

/* ────────────────────────── UI Bits ────────────────────────── */
const FloatingHeaderIllustration = ({ icon }: { icon: string }) => {
  const isDark = useColorScheme() === "dark";
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(10, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const shadowColor = isDark ? "rgba(25, 18, 18, 0.5)" : "rgba(156, 136, 255, 0.4)";

  return (
    <Animated.View style={[{ alignItems: "center" }, animatedStyle]}>
      <View
        style={{
          height: 96,
          width: 96,
          borderRadius: 24,
          backgroundColor: "#A78BFA",
          alignItems: "center",
          justifyContent: "center",
          shadowColor,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.8,
          shadowRadius: 20,
        }}
      >
        <Text style={{ fontSize: 50 }}>{icon}</Text>
      </View>
    </Animated.View>
  );
};

const ActionCard = ({
  icon,
  title,
  description,
  onPress,
  gradient,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  gradient: readonly [string, string, ...string[]];
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => (scale.value = withTiming(0.96, { duration: 100 }));
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
    onPress();
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          animatedStyle,
          {
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
            shadowColor: gradient[0],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          },
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20, flexDirection: "row", alignItems: "center" }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
            }}
          >
            <Text style={{ fontSize: 28 }}>{icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
              {title}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

/* ───────────────────── Auth: Login Gateway ───────────────────── */
function LoginGateway({ onDone }: { onDone: () => void }) {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const auth = React.useContext(AuthContext) as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() && password.trim().length >= 1;

  const doLogin = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      // We now call the 'signIn' function from AuthContext
      await auth.signIn(email, password);
      // onDone() will be called, which closes the modal
      onDone();

    } catch (e: any) {
      // --- START OF FIX ---
      
      // Check for the specific "EMAIL_NOT_VERIFIED" code from the backend
      const errorCode = e?.response?.data?.code;
      const errorMessage = e?.response?.data?.error || (typeof e?.message === "string" ? e.message : "Login failed");

      if (errorCode === "EMAIL_NOT_VERIFIED") {
        // This is the user we need to verify
        const userEmail = email.trim().toLowerCase();
        
        // Navigate to the verify screen, passing the email and message
        router.replace({
          pathname: "/verify-email",
          params: { email: userEmail, message: errorMessage }
        });
      } else {
        // It's a different error (like "Invalid password"), so just show it
        setError(String(errorMessage));
      }
      // --- END OF FIX ---
    } finally {
      setBusy(false);
    }
  };
  const handleClose = () => {
    console.log("🔴 LoginGateway close button pressed");
    safeClose();
  };

  const pageBg = isDark ? "#0B0B0F" : "#F9FAFB";

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: pageBg }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={handleClose}
          className="h-10 w-10 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          activeOpacity={0.6}
        >
          <Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          paddingTop: 40,
          flexGrow: 1,
        }}
      >
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", delay: 100 }}
          className="items-center mb-8"
        >
          <FloatingHeaderIllustration icon="✨" />
        </MotiView>

        <Text className="text-3xl font-bold mb-2 text-black dark:text-white text-center">
          Welcome
        </Text>
        <Text className="text-base mb-10 text-black/60 dark:text-white/60 text-center">
          Log in to continue.
        </Text>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-sm font-semibold mb-2 text-black dark:text-white">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
            className="bg-slate-200 dark:bg-zinc-800 rounded-xl px-4 py-3 text-black dark:text-white"
          />
        </View>

        {/* Password */}
        <View className="mb-2">
          <Text className="text-sm font-semibold mb-2 text-black dark:text-white">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}
            className="bg-slate-200 dark:bg-zinc-800 rounded-xl px-4 py-3 text-black dark:text-white"
          />
        </View>

        {!!error && (
          <View className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <Text className="text-red-600 text-sm">{error}</Text>
          </View>
        )}

        {/* Log in */}
        <TouchableOpacity
          onPress={doLogin}
          disabled={!canSubmit || busy}
          style={{ borderRadius: 12, overflow: "hidden", opacity: !canSubmit || busy ? 0.7 : 1 }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#6D5AE6", "#8B5CF6"] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 16, alignItems: "center" }}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Log in</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View className="items-center my-6">
          <Text className="text-black/50 dark:text-white/50">Don't have an account?</Text>
        </View>

        {/* Sign up → navigate to register */}
        <TouchableOpacity
          onPress={() => {
            console.log("🟡 Sign up button pressed");
            // Close modal first, then navigate to register
            safeClose();
            setTimeout(() => {
              console.log("🟡 Navigating to /register");
              router.push("/register");
            }, 150);
          }}
          style={{ borderRadius: 12, overflow: "hidden" }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#14B8A6", "#06B6D4"] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 16, alignItems: "center" }}
          >
            <Text className="text-white font-bold text-base">Sign up</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ───────────────────── Main Modal (Signed-in) ───────────────────── */
export default function ModalScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ context?: string }>();
  const context = (params?.context || "default") as ModalContext;

  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.isAuthed;

  // not signed in → show login
  if (!isAuthed) {
    return (
      <LoginGateway
        onDone={() => {
          console.log("🟣 Login completed, refreshing bootstrap");
          Promise.resolve(auth?.refreshBootstrap?.() || auth?.bootstrap?.()).finally(() => {
            safeClose();
          });
        }}
      />
    );
  }

  const pageBg = isDark ? "#0B0B0F" : "#F9FAFB";

  const handleClose = () => {
    console.log("🔴 Quick Actions close button pressed");
    safeClose();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: pageBg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <TouchableOpacity
          onPress={handleClose}
          className="h-10 w-10 items-center justify-center"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          activeOpacity={0.6}
        >
          <Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          paddingTop: 40,
        }}
      >
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", delay: 100 }}
          className="items-center mb-8"
        >
          <FloatingHeaderIllustration icon="✨" />
        </MotiView>

        <Text className="text-3xl font-bold mb-2 text-black dark:text-white text-center">
          Quick Actions
        </Text>
        <Text className="text-base mb-12 text-black/60 dark:text-white/60 text-center">
          What would you like to do?
        </Text>

        <ActionCard
          icon="🌍"
          title="Global Communities"
          description="Join public groups you're not in yet"
          onPress={() => navigateFromModal("/global/communities")}
          gradient={["#4F46E5", "#8B5CF6"] as const}
        />

        <ActionCard
          icon="🔍"
          title="Explore"
          description="Discover communities and connect"
          onPress={() => navigateFromModal("/(tabs)/explore")}
          gradient={["#14B8A6", "#06B6D4"] as const}
        />
      </ScrollView>
    </View>
  );
}


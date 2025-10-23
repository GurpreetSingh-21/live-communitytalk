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
  Alert,
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

type ModalContext = "communities" | "dms" | "default";

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
  }, []);

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
      const { data } = await api.post("/api/login", { email, password });
      if (!data?.token) throw new Error("Missing token in response");
      await setAccessToken(data.token);
      // In case your AuthProvider exposes a rebootstrap/refresh
      // we try to call it (optionally) and then close the modal.
      // The profile tab should reflect the signed-in state afterwards.
      onDone();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        (typeof e?.message === "string" ? e.message : "Login failed");
      setError(String(msg));
    } finally {
      setBusy(false);
    }
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
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          <Text className="text-black/50 dark:text-white/50">Don’t have an account?</Text>
        </View>

        {/* Sign up → push to register screen */}
        <TouchableOpacity
          onPress={() => {
            router.back();
            router.push("/register");
          }}
          style={{ borderRadius: 12, overflow: "hidden" }}
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

  // If NOT signed in → show the login gateway
  if (!isAuthed) {
    return (
      <LoginGateway
        onDone={() => {
          // Try to refresh/boot, then close the modal
          Promise.resolve(auth?.refresh?.() || auth?.bootstrap?.()).finally(() => {
            router.back();
          });
        }}
      />
    );
  }

  // Signed-in action sheet (no "New Community")
  const pageBg = isDark ? "#0B0B0F" : "#F9FAFB";

  return (
    <View className="flex-1" style={{ backgroundColor: pageBg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
        </TouchableOpacity>
      </View>

      <ScrollView
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

        {/* Context-specific options, WITHOUT “New Community” */}
        {context === "dms" ? (
          <>
            <ActionCard
              icon="💬"
              title="New Message"
              description="Start a direct conversation"
              onPress={() => {
                Alert.alert("Coming Soon", "Direct messages are coming soon!");
              }}
              gradient={["#8B5CF6", "#D946EF"] as const}
            />
            <ActionCard
              icon="👥"
              title="New Group"
              description="Create a group conversation"
              onPress={() => {
                Alert.alert("Coming Soon", "Group chats are coming soon!");
              }}
              gradient={["#F59E0B", "#EF4444"] as const}
            />
          </>
        ) : (
          <>
            <ActionCard
              icon="🔍"
              title="Explore"
              description="Discover communities and connect"
              onPress={() => {
                router.back();
                router.push("/(tabs)/explore");
              }}
              gradient={["#14B8A6", "#06B6D4"] as const}
            />
            <ActionCard
              icon="💬"
              title="New Message"
              description="Start a direct conversation"
              onPress={() => {
                Alert.alert("Coming Soon", "Direct messages are coming soon!");
              }}
              gradient={["#8B5CF6", "#D946EF"] as const}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
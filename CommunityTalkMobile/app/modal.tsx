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
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
const FloatingHeaderIllustration = ({ iconName }: { iconName: keyof typeof Ionicons.glyphMap }) => {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ alignItems: "center" }, animatedStyle]}>
      <View
        style={{
          height: 72,
          width: 72,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        }}
      >
        <Ionicons name={iconName} size={32} color="#fff" />
      </View>
    </Animated.View>
  );
};

/* ──────────── Premium Action Card (Minimalist) ──────────── */
const ActionCard = ({
  iconName,
  title,
  description,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) => {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => (scale.value = withTiming(0.98, { duration: 100 }));
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
            backgroundColor: colors.surface,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: scheme === 'dark' ? 0.3 : 0.06,
            shadowRadius: 8,
          },
        ]}
      >
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: colors.primary + '15',
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name={iconName} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 }}>
              {title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: Fonts.regular }}>{description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
      </Animated.View>
    </Pressable>
  );
};


/* ───────────────────── Auth: Login Gateway ───────────────────── */
/* ────────────────────────── Components ────────────────────────── */
const PremiumInput = ({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric";
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [isFocused, setIsFocused] = useState(false);

  return (
    <MotiView
      animate={{
        borderColor: isFocused ? colors.primary : "transparent",
        backgroundColor: isFocused ? (scheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#fff') : (scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#F2F2F2'),
      }}
      transition={{ type: "timing", duration: 200 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 16,
        height: 60,
        marginBottom: 16,
      }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={isFocused ? colors.primary : colors.textMuted}
        style={{ marginRight: 12 }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={{
          flex: 1,
          fontSize: 16,
          fontFamily: Fonts.sans,
          color: colors.text,
          height: "100%",
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </MotiView>
  );
};

/* ───────────────────── Auth: Login Gateway ───────────────────── */
function LoginGateway({ onDone }: { onDone: () => void }) {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const auth = React.useContext(AuthContext) as any;
  const colors = Colors[scheme];

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
      await auth.signIn(email, password);
      onDone();
    } catch (e: any) {
      const errorCode = e?.response?.data?.code;
      const errorMessage = e?.response?.data?.error || (typeof e?.message === "string" ? e.message : "Login failed");

      if (errorCode === "EMAIL_NOT_VERIFIED") {
        const userEmail = email.trim().toLowerCase();
        router.replace({
          pathname: "/verify-email",
          params: { email: userEmail, message: errorMessage }
        });
      } else {
        setError(String(errorMessage));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    safeClose();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Close Button */}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 24, zIndex: 10 }}>
        <TouchableOpacity
          onPress={handleClose}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            alignItems: 'center', justifyContent: 'center'
          }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            style={{ alignItems: 'center', marginBottom: 40 }}
          >
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: colors.primary,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
            }}>
              <Text style={{ fontSize: 40 }}>✨</Text>
            </View>
            <Text style={{ fontSize: 32, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8 }}>
              Welcome back
            </Text>
            <Text style={{ fontSize: 16, color: colors.textMuted }}>
              Please enter your details to sign in.
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 100, damping: 20 }}
          >
            <PremiumInput
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <PremiumInput
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoCapitalize="none"
            />

            {!!error && (
              <MotiView
                from={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{
                  marginBottom: 16,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  padding: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={{ color: colors.danger, fontFamily: Fonts.sans, flex: 1 }}>{error}</Text>
              </MotiView>
            )}

            <TouchableOpacity
              onPress={doLogin}
              disabled={!canSubmit || busy}
              style={{ marginTop: 8 }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, '#15803d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  opacity: !canSubmit || busy ? 0.7 : 1
                }}
              >
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontFamily: Fonts.bold }}>Sign in</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => {
              safeClose();
              setTimeout(() => router.push("/register"), 150);
            }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontFamily: Fonts.bold }}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ───────────────────── Main Modal (Signed-in) ───────────────────── */
export default function ModalScreen() {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ context?: string }>();
  const context = (params?.context || "default") as ModalContext;

  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.isAuthed;
  const isLoading = auth?.isLoading ?? true;
  const colors = Colors[scheme];

  console.log("📱 [Modal] Rendering - isAuthed:", isAuthed, "isLoading:", isLoading);

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  // not signed in → show login
  if (!isAuthed) {
    console.log("📱 [Modal] Showing LoginGateway");
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

  console.log("📱 [Modal] Showing Quick Actions");

  const handleClose = () => {
    console.log("🔴 Quick Actions close button pressed");
    safeClose();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          zIndex: 9999,
        }}
        collapsable={false}
      >
        <View style={{ width: 44, height: 44 }} pointerEvents="box-only">
          <TouchableOpacity
            onPress={handleClose}
            style={{
              height: 44,
              width: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderRadius: 22,
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            activeOpacity={0.6}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
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
          style={{ alignItems: 'center', marginBottom: 24 }}
        >
          <FloatingHeaderIllustration iconName="sparkles" />
        </MotiView>

        <Text style={{ fontSize: 28, fontFamily: Fonts.bold, marginBottom: 6, color: colors.text, textAlign: "center" }}>
          Quick Actions
        </Text>
        <Text style={{ fontSize: 15, marginBottom: 32, color: colors.textMuted, textAlign: "center" }}>
          What would you like to do?
        </Text>

        <ActionCard
          iconName="globe-outline"
          title="Global Communities"
          description="Join public groups you're not in yet"
          onPress={() => navigateFromModal("/global/communities")}
        />

        <ActionCard
          iconName="compass-outline"
          title="Explore"
          description="Discover communities and connect"
          onPress={() => navigateFromModal("/(tabs)/explore")}
        />
      </ScrollView>
    </View>
  );
}
// CommunityTalkMobile/app/modal.tsx
import React, { useState, useEffect, type ReactNode } from "react";
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
import type { ComponentProps } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { MotiView } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "@/src/context/AuthContext";

LogBox.ignoreLogs(["[Reanimated]"]);

const FloatingHeaderIllustration = () => {
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
          height: 96, // a touch smaller so it doesn't dominate
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
        <Ionicons name="lock-closed-outline" size={50} color="white" />
      </View>
    </Animated.View>
  );
};

type ClayInputProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  isPassword?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

const ClayInput = ({
  icon,
  placeholder,
  value,
  onChangeText,
  isPassword = false,
  keyboardType = "default",
  autoCapitalize = "none",
}: ClayInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const isDark = useColorScheme() === "dark";
  const bgColor = isDark ? "#1F2937" : "#F3F4F6";
  const textColor = isDark ? "#FFF" : "#111827";
  const placeholderColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";

  return (
    <View
      style={{
        height: 55,
        borderRadius: 16,
        marginBottom: 16,
        padding: 2,
        overflow: "hidden",
        backgroundColor: isDark ? "#4B5563" : "#D1D5DB",
        shadowColor: "#000",
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: "100%",
          width: "100%",
          borderRadius: 14,
          paddingHorizontal: 16,
          backgroundColor: bgColor,
        }}
      >
        <Ionicons name={icon} size={20} color={placeholderColor} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          secureTextEntry={isPassword && !showPassword}
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 16,
            color: textColor,
          }}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={isPassword ? "done" : "next"}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
            <Ionicons
              name={showPassword ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={placeholderColor}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

type ClayButtonProps = {
  children: ReactNode;
  isLoading: boolean;
  onPress: () => void;
  disabled?: boolean;
};

const ClayButton = ({ children, isLoading, onPress, disabled }: ClayButtonProps) => {
  const isDark = useColorScheme() === "dark";
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const buttonBgA = "#6D5AE6";
  const buttonBgB = "#8B5CF6";
  const bottomShadowColor = isDark ? "#4C1D95" : "#7C3AED";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const onPressIn = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(0.98);
    translateY.value = withSpring(3);
  };
  const onPressOut = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(1);
    translateY.value = withSpring(0);
    onPress();
  };

  return (
    <View style={{ height: 56, borderRadius: 12, backgroundColor: bottomShadowColor }}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled || isLoading}>
        <Animated.View
          style={[
            {
              height: 52,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: buttonBgB,
              opacity: disabled ? 0.7 : 1,
            },
            animatedStyle,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Log In Securely</Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
};

export default function ModalScreen() {
  const { signIn } = (React.useContext(AuthContext) as any) ?? {};

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [errPw, setErrPw] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();

  const validate = () => {
    let ok = true;
    setErrEmail(null);
    setErrPw(null);
    setServerError(null);

    const em = email.trim().toLowerCase();
    if (!em) {
      setErrEmail("Email is required");
      ok = false;
    } else if (!/^\S+@\S+\.\S+$/.test(em)) {
      setErrEmail("Email is invalid");
      ok = false;
    }
    if (!password) {
      setErrPw("Password is required");
      ok = false;
    }
    return ok;
  };

  const handleLogin = async () => {
    if (isLoading) return;
    if (!validate()) return;

    try {
      setIsLoading(true);
      await signIn?.(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      const e = err?.response?.data?.error ?? err?.response?.data ?? err?.message;
      if (typeof e === "string") {
        setServerError(e);
      } else if (e && typeof e === "object") {
        if (e.email) setErrEmail(String(e.email));
        if (e.password) setErrPw(String(e.password));
        if (e.message) setServerError(String(e.message));
      } else {
        setServerError("Invalid email or password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const pageBg = isDark ? "#0B0B0F" : "#F9FAFB";

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: pageBg }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      {/* Top bar */}
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: "center" }}>
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", delay: 100 }}
            className="items-center mb-12"
          >
            <FloatingHeaderIllustration />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 24 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "spring", delay: 250 }}
          >
            <Text className="text-3xl font-bold mb-2 text-black dark:text-white">
              Welcome Back! 👋
            </Text>
            <Text className="text-base mb-12 text-black/60 dark:text-white/60">
              Enter your credentials to continue
            </Text>

            <ClayInput
              placeholder="Email Address"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {!!errEmail && <Text className="text-xs text-red-500 -mt-3 mb-3">{errEmail}</Text>}

            <ClayInput
              placeholder="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              isPassword
            />
            {!!errPw && <Text className="text-xs text-red-500 -mt-3 mb-3">{errPw}</Text>}

            <TouchableOpacity
              className="mb-6 self-end"
              onPress={() => Alert.alert("Coming soon", "Password reset")}
            >
              <Text className="text-indigo-500 text-sm font-semibold">Forgot password?</Text>
            </TouchableOpacity>

            {!!serverError && (
              <View className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                <Text className="text-red-600 text-sm">{serverError}</Text>
              </View>
            )}

            <ClayButton isLoading={isLoading} onPress={handleLogin} disabled={isLoading}>
              <Text className="text-white font-semibold text-base">Log In Securely</Text>
            </ClayButton>

            <View className="flex-row items-center justify-center gap-1 mt-8">
              <Text className="text-black/60 dark:text-white/60">Don't have an account?</Text>
              {/* IMPORTANT: replace so Register is not hidden behind modal */}
              <TouchableOpacity onPress={() => router.replace("/register")}>
                <Text className="text-indigo-500 font-bold">Sign up</Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
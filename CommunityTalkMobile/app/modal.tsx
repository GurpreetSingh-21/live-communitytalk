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
import { AuthContext } from "@/src/context/AuthContext";

LogBox.ignoreLogs(['[Reanimated]']);

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
          height: 112,
          width: 112,
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
        <Ionicons name="lock-closed-outline" size={60} color="white" />
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
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isDark = useColorScheme() === "dark";
  const bgColor = isDark ? "#1F2937" : "#F3F4F6";
  const textColor = isDark ? "#FFF" : "#111827";
  const placeholderColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

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
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 16,
            color: textColor,
          }}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
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

  const buttonBgColor = isDark ? "#8B5CF6" : "#A78BFA";
  const bottomShadowColor = isDark ? "#5B21B6" : "#7C3AED";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const onPressIn = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(0.98);
    translateY.value = withSpring(4);
  };
  const onPressOut = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(1);
    translateY.value = withSpring(0);
    onPress();
  };

  return (
    <View style={{ height: 60, borderRadius: 16, backgroundColor: bottomShadowColor }}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled || isLoading}>
        <Animated.View
          style={[
            {
              height: 55,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: buttonBgColor,
              opacity: disabled ? 0.6 : 1,
            },
            animatedStyle,
          ]}
        >
          {isLoading ? <ActivityIndicator color="white" /> : children}
        </Animated.View>
      </Pressable>
    </View>
  );
};

export default function ModalScreen() {
  const auth = React.useContext(AuthContext) as any;
  const signIn = auth?.signIn as ((email: string, password: string) => Promise<void>) | undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [errPw, setErrPw] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isDark = useColorScheme() === "dark";

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

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: isDark ? "#111827" : "#F9FAFB" }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View className="px-5 pt-14 pb-6">
        <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
          <Ionicons name="close" size={28} color={isDark ? "white" : "black"} />
        </TouchableOpacity>
      </View>

      <View className="flex-1 justify-center px-6 -mt-10">
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", delay: 100 }}
          className="items-center mb-12"
        >
          <FloatingHeaderIllustration />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "spring", delay: 300 }}
        >
          <Text className="text-3xl font-bold mb-2 text-black dark:text-white">Welcome Back! 👋</Text>
          <Text className="text-base mb-8 text-black/60 dark:text-white/60">
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
            <Text className="text-white font-bold text-base">Log In Securely</Text>
          </ClayButton>

          <View className="flex-row items-center justify-center gap-1 mt-8">
            <Text className="text-black/60 dark:text-white/60">Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text className="text-indigo-500 font-bold">Sign up</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </KeyboardAvoidingView>
  );
}
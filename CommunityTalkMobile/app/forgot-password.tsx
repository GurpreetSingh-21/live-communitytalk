// CommunityTalkMobile/app/forgot-password.tsx
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";

import { api } from "@/src/api/api";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/* ─────────────────── Types ─────────────────── */
type Step = "email" | "code" | "newPassword";

/* ─────────────────── Reusable Premium Input ─────────────────── */
const PremiumInput = ({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = "none",
  keyboardType = "default",
  editable = true,
  autoFocus = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "number-pad";
  editable?: boolean;
  autoFocus?: boolean;
}) => {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <MotiView
      animate={{
        borderColor: focused ? colors.primary : "transparent",
        backgroundColor: focused
          ? scheme === "dark"
            ? "rgba(255,255,255,0.08)"
            : "#fff"
          : scheme === "dark"
          ? "rgba(255,255,255,0.05)"
          : "#F2F2F2",
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
        opacity: editable ? 1 : 0.5,
      }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={focused ? colors.primary : colors.textMuted}
        style={{ marginRight: 12 }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry && !visible}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        editable={editable}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          fontSize: 16,
          fontFamily: Fonts.sans,
          color: colors.text,
          height: "100%",
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setVisible(!visible)} style={{ padding: 4 }}>
          <Ionicons
            name={visible ? "eye-outline" : "eye-off-outline"}
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </MotiView>
  );
};

/* ─────────────────── OTP Code Input ─────────────────── */
const OTPInput = ({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: typeof Colors.light;
}) => {
  const inputRef = useRef<TextInput>(null);
  const digits = value.split("").slice(0, 6);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      style={{ marginBottom: 24 }}
    >
      {/* Hidden real input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
        autoFocus
      />

      {/* Visual boxes */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < digits.length;
          const active = i === digits.length;
          return (
            <View
              key={i}
              style={{
                width: 48,
                height: 58,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: active
                  ? colors.primary
                  : filled
                  ? colors.primary + "60"
                  : colors.border,
                backgroundColor: filled ? colors.primary + "10" : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: Fonts.bold,
                  color: colors.text,
                  letterSpacing: 0,
                }}
              >
                {digits[i] || ""}
              </Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
};

/* ─────────────────── Primary Button ─────────────────── */
const PrimaryButton = ({
  onPress,
  label,
  busy,
  disabled,
  colors,
}: {
  onPress: () => void;
  label: string;
  busy: boolean;
  disabled: boolean;
  colors: typeof Colors.light;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || busy}
    activeOpacity={0.85}
  >
    <LinearGradient
      colors={[colors.primary, "#15803d"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: 56,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        opacity: disabled || busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontSize: 16, fontFamily: Fonts.bold }}>
          {label}
        </Text>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

/* ─────────────────── Error Banner ─────────────────── */
const ErrorBanner = ({ msg, colors }: { msg: string; colors: typeof Colors.light }) => (
  <MotiView
    from={{ opacity: 0, translateY: -8 }}
    animate={{ opacity: 1, translateY: 0 }}
    style={{
      marginBottom: 16,
      backgroundColor: colors.danger + "18",
      padding: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    }}
  >
    <Ionicons name="alert-circle" size={18} color={colors.danger} />
    <Text style={{ color: colors.danger, fontFamily: Fonts.sans, flex: 1, fontSize: 14 }}>
      {msg}
    </Text>
  </MotiView>
);

/* ─────────────────── Main Screen ─────────────────── */
export default function ForgotPasswordScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  /* ── Step 1: Send reset email ── */
  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/forgot-password", { email: trimmed });
      setStep("code");
      startResendCooldown();
    } catch (e: any) {
      // Always show generic message to avoid email enumeration
      setStep("code");
      startResendCooldown();
    } finally {
      setBusy(false);
    }
  };

  /* ── Step 2: Verify OTP ── */
  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/verify-reset-code", {
        email: email.trim().toLowerCase(),
        code,
      });
      setStep("newPassword");
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Invalid or expired code. Try again.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  /* ── Step 3: Set new password ── */
  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/reset-password", {
        email: email.trim().toLowerCase(),
        code,
        newPassword,
      });
      Alert.alert(
        "Password Reset! 🎉",
        "Your password has been updated successfully. Please sign in with your new password.",
        [
          {
            text: "Sign In",
            onPress: () => router.replace("/modal"),
          },
        ]
      );
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Reset failed. Please start over.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  /* ── Resend with cooldown ── */
  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/forgot-password", { email: email.trim().toLowerCase() });
      setCode("");
      startResendCooldown();
    } catch {
      // Silent fail for security
      startResendCooldown();
    } finally {
      setBusy(false);
    }
  };

  /* ── Step metadata ── */
  const stepMeta = {
    email: {
      icon: "lock-open-outline" as const,
      title: "Forgot Password?",
      subtitle: "Enter your .edu email and we'll send you a reset code.",
    },
    code: {
      icon: "shield-checkmark-outline" as const,
      title: "Check Your Email",
      subtitle: `We sent a 6-digit code to ${email || "your email"}. It expires in 15 minutes.`,
    },
    newPassword: {
      icon: "key-outline" as const,
      title: "New Password",
      subtitle: "Choose a strong password you haven't used before.",
    },
  };

  const meta = stepMeta[step];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      {/* Back button */}
      <View style={{ position: "absolute", top: insets.top + 10, left: 20, zIndex: 10 }}>
        <TouchableOpacity
          onPress={() => {
            if (step === "email") {
              router.canGoBack() ? router.back() : router.replace("/modal");
            } else if (step === "code") {
              setStep("email");
              setCode("");
              setError(null);
            } else {
              setStep("code");
              setError(null);
            }
          }}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor:
              scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Step progress pills */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 18,
          right: 24,
          flexDirection: "row",
          gap: 6,
          zIndex: 10,
        }}
      >
        {(["email", "code", "newPassword"] as Step[]).map((s, i) => (
          <View
            key={s}
            style={{
              width: step === s ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                step === s
                  ? colors.primary
                  : i < ["email", "code", "newPassword"].indexOf(step)
                  ? colors.primary + "50"
                  : colors.border,
            }}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + 40,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <MotiView
            key={step + "-icon"}
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 18 }}
            style={{ alignItems: "center", marginBottom: 32 }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                backgroundColor: colors.primary + "15",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: colors.primary + "30",
              }}
            >
              <Ionicons name={meta.icon} size={38} color={colors.primary} />
            </View>
          </MotiView>

          {/* Title + Subtitle */}
          <MotiView
            key={step + "-title"}
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "spring", damping: 20, delay: 60 }}
            style={{ marginBottom: 32 }}
          >
            <Text
              style={{
                fontSize: 30,
                fontFamily: Fonts.bold,
                color: colors.text,
                marginBottom: 8,
                textAlign: "center",
                letterSpacing: -0.5,
              }}
            >
              {meta.title}
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: Fonts.regular,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 22,
                paddingHorizontal: 8,
              }}
            >
              {meta.subtitle}
            </Text>
          </MotiView>

          {/* Error */}
          {!!error && <ErrorBanner msg={error} colors={colors} />}

          {/* ── Step: Email ── */}
          {step === "email" && (
            <MotiView
              from={{ opacity: 0, translateX: 30 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: -30 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <PremiumInput
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="Your .edu email"
                keyboardType="email-address"
                autoFocus
              />
              <PrimaryButton
                onPress={handleSendCode}
                label="Send Reset Code"
                busy={busy}
                disabled={!email.trim()}
                colors={colors}
              />
            </MotiView>
          )}

          {/* ── Step: Code ── */}
          {step === "code" && (
            <MotiView
              from={{ opacity: 0, translateX: 30 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: -30 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <OTPInput value={code} onChange={setCode} colors={colors} />

              <PrimaryButton
                onPress={handleVerifyCode}
                label="Verify Code"
                busy={busy}
                disabled={code.length < 6}
                colors={colors}
              />

              {/* Resend */}
              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
                <Text style={{ color: colors.textMuted, fontSize: 14, fontFamily: Fonts.regular }}>
                  Didn't receive it?{" "}
                </Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resendCooldown > 0 || busy}
                >
                  <Text
                    style={{
                      color: resendCooldown > 0 ? colors.textMuted : colors.primary,
                      fontSize: 14,
                      fontFamily: Fonts.bold,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          )}

          {/* ── Step: New Password ── */}
          {step === "newPassword" && (
            <MotiView
              from={{ opacity: 0, translateX: 30 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: -30 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <PremiumInput
                icon="lock-closed-outline"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min. 8 characters)"
                secureTextEntry
                autoFocus
              />
              <PremiumInput
                icon="lock-closed-outline"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry
              />

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <View style={{ marginBottom: 16, gap: 6 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[1, 2, 3, 4].map((level) => {
                      const strength =
                        newPassword.length >= 12 &&
                        /[A-Z]/.test(newPassword) &&
                        /[0-9]/.test(newPassword) &&
                        /[^A-Za-z0-9]/.test(newPassword)
                          ? 4
                          : newPassword.length >= 10 && /[A-Z]/.test(newPassword)
                          ? 3
                          : newPassword.length >= 8
                          ? 2
                          : 1;
                      return (
                        <View
                          key={level}
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor:
                              level <= strength
                                ? strength === 4
                                  ? "#10B981"
                                  : strength === 3
                                  ? "#F59E0B"
                                  : strength === 2
                                  ? "#F97316"
                                  : "#EF4444"
                                : colors.border,
                          }}
                        />
                      );
                    })}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: Fonts.regular }}>
                    {newPassword.length < 8
                      ? "Too short"
                      : newPassword.length >= 12 &&
                        /[A-Z]/.test(newPassword) &&
                        /[0-9]/.test(newPassword)
                      ? "Strong password ✓"
                      : "Add uppercase & numbers for a stronger password"}
                  </Text>
                </View>
              )}

              <PrimaryButton
                onPress={handleResetPassword}
                label="Reset Password"
                busy={busy}
                disabled={newPassword.length < 8 || confirmPassword.length < 1}
                colors={colors}
              />
            </MotiView>
          )}

          {/* Back to login */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 32 }}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              Remember your password?{" "}
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/modal")
              }
            >
              <Text style={{ color: colors.primary, fontSize: 14, fontFamily: Fonts.bold }}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

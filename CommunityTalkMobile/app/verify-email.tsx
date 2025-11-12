import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  useColorScheme
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "@/src/context/AuthContext";
import { api } from "@/src/api/api";

// This is the new verification screen
export default function VerifyEmailScreen() {
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const { setToken, bootstrap } = (useContext(AuthContext) as any) ?? {};
  
  // Get the email from the route params (passed from register or login)
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = code.trim().length === 6 && !busy;

  const handleVerify = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // POST to the new backend route
      const { data } = await api.post("/api/verify-email", { 
        email: email, 
        code: code 
      });
      
      if (!data?.token) {
        throw new Error("Verification successful, but no token was received.");
      }

      // SUCCESS! We finally have the token.
      await setToken(data.token);
      await bootstrap(); // Load user data
      
      // Send user into the app
      router.replace("/(tabs)");

    } catch (e: any) {
      const msg = e?.response?.data?.error || "Invalid code. Please try again.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };
  
  // (Optional) Add a resend code function
  const handleResend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Calling /register again triggers the resend logic on the backend
      // We pass a 'resend' flag to avoid triggering all register logic
      await api.post("/api/register", { email: email, resend: true });
      Alert.alert("Code Sent", "A new verification code has been sent to your email.");
    } catch (e: any) {
       setError(e?.response?.data?.error || "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  const pageBg = isDark ? "#0B0B0F" : "#F9FAFB";
  const textColor = isDark ? "#F3F4F6" : "#111827";
  const placeholder = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
  const inputBg = isDark ? "#1F2937" : "#F3F4F6";

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
          <Ionicons name="chevron-back" size={28} color={textColor} />
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
        <View className="items-center mb-8">
          <View
            style={{
              height: 96,
              width: 96,
              borderRadius: 24,
              backgroundColor: "#10B981",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={50} color="white" />
          </View>
        </View>

        <Text className="text-3xl font-bold mb-2 text-black dark:text-white text-center">
          Check your email
        </Text>
        <Text className="text-base mb-10 text-black/60 dark:text-white/60 text-center">
          We sent a 6-digit verification code to
          <Text className="font-bold"> {email}</Text>
        </Text>

        {/* Code Input */}
        <View className="mb-4">
          <Text className="text-sm font-semibold mb-2 text-black dark:text-white">
            Verification Code
          </Text>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="123456"
            maxLength={6}
            placeholderTextColor={placeholder}
            style={{
              backgroundColor: inputBg,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              color: textColor,
              fontSize: 18,
              textAlign: "center",
              letterSpacing: 8,
              fontWeight: "bold",
            }}
          />
        </View>

        {!!error && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEE2E2",
              padding: 14,
              borderRadius: 12,
              marginVertical: 12,
              borderWidth: 1,
              borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FECACA",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Ionicons name="alert-circle" size={18} color={isDark ? "#F87171" : "#DC2626"} style={{ marginTop: 1 }} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: isDark ? "#FCA5A5" : "#DC2626",
                  marginLeft: 8,
                  fontWeight: "500",
                  lineHeight: 18,
                }}
              >
                {error}
              </Text>
            </View>
          </View>
        )}

        {/* Verify Button */}
        <TouchableOpacity
          onPress={handleVerify}
          disabled={!canSubmit}
          style={{ borderRadius: 12, overflow: "hidden", opacity: !canSubmit ? 0.7 : 1, marginTop: 10 }}
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
              <Text className="text-white font-bold text-base">Verify Account</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend Code */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={busy}
          style={{ marginTop: 24 }}
        >
          <Text style={{color: placeholder, textAlign: 'center', fontWeight: '500'}}>
            Didn't get a code? Resend
          </Text>
        </TouchableOpacity>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
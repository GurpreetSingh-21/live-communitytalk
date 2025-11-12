// CommunityTalkMobile/app/register.tsx
import { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api/api";
import React from "react";
import { AuthContext } from "@/src/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type CommunityLite = {
  _id: string;
  name: string;
  type: "college" | "religion" | "custom";
  key?: string;
  tags?: string[];
};

export default function RegisterScreen() {
  const { setToken, bootstrap, register } = (React.useContext(AuthContext) as any) ?? {};
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  // selections
  const [colleges, setColleges] = useState<CommunityLite[]>([]);
  const [religions, setReligions] = useState<CommunityLite[]>([]);
  const [collegeId, setCollegeId] = useState<string>("");
  const [religionId, setReligionId] = useState<string>("");

  // UI state
  const [loadingLists, setLoadingLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // field errors
  const [errName, setErrName] = useState<string | null>(null);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [errPw, setErrPw] = useState<string | null>(null);
  const [errCollege, setErrCollege] = useState<string | null>(null);
  const [errReligion, setErrReligion] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const pwStrength =
    pw.length === 0 ? null : pw.length < 6 ? "weak" : pw.length < 10 ? "medium" : "strong";
  const strengthColors = { weak: "#EF4444", medium: "#F59E0B", strong: "#10B981" } as const;

  /* ---------------- Fetch lists (unchanged logic) ---------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingLists(true);
        const [colRes, relRes] = await Promise.all([
          api.get(`/api/public/communities?type=college&paginated=false`),
          api.get(`/api/public/communities?type=religion&paginated=false`),
        ]);

        const colItems: CommunityLite[] = Array.isArray(colRes.data)
          ? colRes.data
          : Array.isArray(colRes.data?.items)
          ? colRes.data.items
          : [];
        const relItems: CommunityLite[] = Array.isArray(relRes.data)
          ? relRes.data
          : Array.isArray(relRes.data?.items)
          ? relRes.data.items
          : [];

        if (!mounted) return;
        setColleges(colItems);
        setReligions(relItems);
      } catch {
        // silent
      } finally {
        if (mounted) setLoadingLists(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- Validation (unchanged logic) ---------------- */
  const validate = () => {
    let ok = true;
    setErrName(null);
    setErrEmail(null);
    setErrPw(null);
    setErrCollege(null);
    setErrReligion(null);
    setServerError(null);

    const n = name.trim();
    if (!n) {
      setErrName("Full name is required");
      ok = false;
    }
    const em = email.trim().toLowerCase();
    if (!em) {
      setErrEmail("Email is required");
      ok = false;
    } else if (!/^\S+@\S+\.\S+$/.test(em)) {
      setErrEmail("Email is invalid");
      ok = false;
    }
    if (!pw) {
      setErrPw("Password is required");
      ok = false;
    } else if (pw.length < 8) {
      setErrPw("Password must be at least 8 characters");
      ok = false;
    }
    if (!collegeId) {
      setErrCollege("Select your college");
      ok = false;
    }
    if (!religionId) {
      setErrReligion("Select your religion community");
      ok = false;
    }
    return ok;
  };

  /* ---------------- Submit (unchanged logic) ---------------- */
  const handleRegister = async () => {
    if (submitting) return;
    if (!validate()) return;

    try {
      setSubmitting(true);
      const body = {
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        password: pw,
        collegeId,
        religionId,
      };
      
      // Use the 'register' function from AuthContext
      // It no longer throws an error, it returns a message
      const data = await register(body);

      // --- START FIX ---
      // Do NOT log the user in.
      // Send them to the new code verification screen.
      router.replace({
        pathname: "/verify-email",
        // Pass the email and the server message to the next screen
        params: { email: body.email, message: data.message }
      });
      // --- END FIX ---

    } catch (err: any) {
      // (This catch block will now catch errors like "User already exists")
      const e = err?.response?.data?.error ?? err?.response?.data ?? err?.message;
      if (typeof e === "string") {
        setServerError(e);
      } else if (e && typeof e === "object") {
        if (e.fullName) setErrName(String(e.fullName));
        if (e.email) setErrEmail(String(e.email));
        if (e.password) setErrPw(String(e.password));
        if (e.collegeId) setErrCollege(String(e.collegeId));
        if (e.religionId) setErrReligion(String(e.religionId));
        if (e.message) setServerError(String(e.message));
      } else {
        setServerError("Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };
  /* ---------------- Modern UI Components ---------------- */
  const Pill = ({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
          onPress();
        }}
        style={{ marginRight: 8, marginBottom: 10 }}
      >
        <Animated.View
          style={[
            animStyle,
            {
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: active
                ? isDark
                  ? "#6366F1"
                  : "#6366F1"
                : isDark
                ? "#1F2937"
                : "#F3F4F6",
              borderWidth: active ? 0 : 1,
              borderColor: isDark ? "#374151" : "#E5E7EB",
              flexDirection: "row",
              alignItems: "center",
              shadowColor: active ? "#6366F1" : "#000",
              shadowOpacity: active ? 0.3 : 0.05,
              shadowRadius: active ? 8 : 2,
              shadowOffset: { width: 0, height: 2 },
              elevation: active ? 4 : 1,
            },
          ]}
        >
          {active && (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            style={{
              fontSize: 13,
              fontWeight: active ? "600" : "500",
              color: active ? "#FFFFFF" : isDark ? "#D1D5DB" : "#374151",
            }}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  const eduDetected = useMemo(() => email.toLowerCase().includes(".edu"), [email]);

  // Design tokens
  const bgColor = isDark ? "#0B0F19" : "#F8FAFC";
  const cardBg = isDark ? "#111827" : "#FFFFFF";
  const labelColor = isDark ? "#D1D5DB" : "#374155";
  const inputBg = isDark ? "#1F2937" : "#F9FAFB";
  const inputBorder = isDark ? "#374151" : "#E5E7EB";
  const inputFocusBorder = isDark ? "#6366F1" : "#6366F1";
  const placeholder = isDark ? "#6B7280" : "#9CA3AF";
  const textColor = isDark ? "#F3F4F6" : "#111827";

  /* ---------------- Premium Submit Button ---------------- */
  const SubmitButton = ({
    onPress,
    loading,
    disabled,
  }: {
    onPress: () => void;
    loading: boolean;
    disabled: boolean;
  }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    return (
      <Pressable
        onPressIn={() => {
          if (!disabled) {
            scale.value = withSpring(0.97);
            opacity.value = withTiming(0.9);
          }
        }}
        onPressOut={() => {
          if (!disabled) {
            scale.value = withSpring(1);
            opacity.value = withTiming(1);
            onPress();
          }
        }}
        disabled={disabled}
      >
        <Animated.View style={animStyle}>
          <LinearGradient
            colors={disabled ? ["#9CA3AF", "#6B7280"] : ["#6366F1", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
              shadowColor: "#6366F1",
              shadowOpacity: disabled ? 0 : 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: disabled ? 0 : 8,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                  Create Account
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1, backgroundColor: bgColor }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
            paddingVertical: 8,
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={textColor} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: textColor, marginLeft: 4 }}>
            Back
          </Text>
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 20,
              shadowColor: "#6366F1",
              shadowOpacity: 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            <LinearGradient
              colors={["#6366F1", "#8B5CF6", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
            >
              <Ionicons name="people" size={44} color="white" />
            </LinearGradient>
          </View>

          <Text
            style={{
              fontSize: 32,
              fontWeight: "800",
              color: textColor,
              marginBottom: 8,
              letterSpacing: -0.5,
            }}
          >
            Join CommunityTalk
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: isDark ? "#9CA3AF" : "#6B7280",
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Connect with campus & faith communities{"\n"}across NYC 🚀
          </Text>
        </View>

        {/* Form Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 24,
            shadowColor: isDark ? "#000" : "#64748B",
            shadowOpacity: isDark ? 0.4 : 0.08,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          {/* Full Name */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor, marginBottom: 8 }}>
              Full Name
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: inputBorder,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Ionicons name="person-outline" size={20} color={placeholder} />
              <TextInput
                placeholder="Your full name"
                value={name}
                onChangeText={setName}
                placeholderTextColor={placeholder}
                autoCapitalize="words"
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 15,
                  color: textColor,
                  fontWeight: "500",
                }}
              />
            </View>
            {!!errName && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={{ fontSize: 12, color: "#EF4444", marginLeft: 4, fontWeight: "500" }}>
                  {errName}
                </Text>
              </View>
            )}
          </View>

          {/* Email */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor, marginBottom: 8 }}>
              Email Address
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: inputBorder,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Ionicons name="mail-outline" size={20} color={placeholder} />
              <TextInput
                placeholder="you@college.edu"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={placeholder}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 15,
                  color: textColor,
                  fontWeight: "500",
                }}
              />
            </View>
            {eduDetected && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                  backgroundColor: isDark ? "#064E3B" : "#D1FAE5",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={{ fontSize: 12, color: "#10B981", marginLeft: 6, fontWeight: "600" }}>
                  .edu email verified ✓
                </Text>
              </View>
            )}
            {!!errEmail && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={{ fontSize: 12, color: "#EF4444", marginLeft: 4, fontWeight: "500" }}>
                  {errEmail}
                </Text>
              </View>
            )}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor, marginBottom: 8 }}>
              Password
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: inputBorder,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Ionicons name="lock-closed-outline" size={20} color={placeholder} />
              <TextInput
                placeholder="Create a strong password"
                secureTextEntry={!showPw}
                value={pw}
                onChangeText={setPw}
                placeholderTextColor={placeholder}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 15,
                  color: textColor,
                  fontWeight: "500",
                }}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} activeOpacity={0.7}>
                <Ionicons
                  name={showPw ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={placeholder}
                />
              </TouchableOpacity>
            </View>

            {pwStrength && (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor:
                        pwStrength === "weak"
                          ? "#EF4444"
                          : isDark
                          ? "#374151"
                          : "#E5E7EB",
                    }}
                  />
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor:
                        pwStrength === "medium" || pwStrength === "strong"
                          ? "#F59E0B"
                          : isDark
                          ? "#374151"
                          : "#E5E7EB",
                    }}
                  />
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor:
                        pwStrength === "strong"
                          ? "#10B981"
                          : isDark
                          ? "#374151"
                          : "#E5E7EB",
                    }}
                  />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: strengthColors[pwStrength] }}>
                  Password strength: {pwStrength}
                </Text>
              </View>
            )}
            {!!errPw && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={{ fontSize: 12, color: "#EF4444", marginLeft: 4, fontWeight: "500" }}>
                  {errPw}
                </Text>
              </View>
            )}
          </View>

          {/* College Selection */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor, marginBottom: 12 }}>
              Select College
            </Text>
            {loadingLists ? (
              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={{ marginLeft: 10, color: placeholder, fontSize: 14 }}>
                  Loading colleges...
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {colleges.map((c) => (
                  <Pill
                    key={c._id}
                    label={c.name}
                    active={collegeId === c._id}
                    onPress={() => setCollegeId(c._id)}
                  />
                ))}
              </View>
            )}
            {!!errCollege && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={{ fontSize: 12, color: "#EF4444", marginLeft: 4, fontWeight: "500" }}>
                  {errCollege}
                </Text>
              </View>
            )}
          </View>

          {/* Religion Selection */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor, marginBottom: 12 }}>
              Select Your Community
            </Text>
            {loadingLists ? (
              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={{ marginLeft: 10, color: placeholder, fontSize: 14 }}>
                  Loading communities...
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {religions.map((r) => (
                  <Pill
                    key={r._id}
                    label={r.name}
                    active={religionId === r._id}
                    onPress={() => setReligionId(r._id)}
                  />
                ))}
              </View>
            )}
            {!!errReligion && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={{ fontSize: 12, color: "#EF4444", marginLeft: 4, fontWeight: "500" }}>
                  {errReligion}
                </Text>
              </View>
            )}
          </View>

          {/* Server Error */}
          {!!serverError && (
            <View
              style={{
                backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2",
                padding: 14,
                borderRadius: 12,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: isDark ? "#991B1B" : "#FECACA",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginTop: 1 }} />
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
                  {serverError}
                </Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <SubmitButton onPress={handleRegister} loading={submitting} disabled={submitting} />

          {/* Terms */}
          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              color: isDark ? "#6B7280" : "#9CA3AF",
              marginTop: 16,
              lineHeight: 16,
            }}
          >
            By creating an account, you agree to our{" "}
            <Text style={{ color: "#6366F1", fontWeight: "600" }}>Terms of Service</Text> and{" "}
            <Text style={{ color: "#6366F1", fontWeight: "600" }}>Privacy Policy</Text>
          </Text>
        </View>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 28,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: isDark ? "#374151" : "#E5E7EB",
            }}
          />
          <Text
            style={{
              marginHorizontal: 16,
              fontSize: 13,
              color: isDark ? "#6B7280" : "#9CA3AF",
              fontWeight: "500",
            }}
          >
            or
          </Text>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: isDark ? "#374151" : "#E5E7EB",
            }}
          />
        </View>

        {/* Login Link */}
        <TouchableOpacity
          onPress={() => router.push("/modal")}
          activeOpacity={0.8}
          style={{
            backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: isDark ? "#374151" : "#E5E7EB",
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="log-in-outline" size={20} color={textColor} />
          <Text
            style={{
              marginLeft: 8,
              fontSize: 15,
              fontWeight: "600",
              color: textColor,
            }}
          >
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
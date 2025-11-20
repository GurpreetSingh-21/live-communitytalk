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

// Types
type CollegeType = {
  _id: string;
  name: string;
  key: string;
  emailDomains: string[];
};

type CommunityLite = {
  _id: string;
  name: string;
  type: "college" | "religion" | "custom";
  key?: string;
  tags?: string[];
};

export default function RegisterScreen() {
  const { register } = (React.useContext(AuthContext) as any) ?? {};
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  // form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  // lists
  const [colleges, setColleges] = useState<CollegeType[]>([]);
  const [religions, setReligions] = useState<CommunityLite[]>([]);
  const [collegeId, setCollegeId] = useState("");
  const [religionId, setReligionId] = useState("");

  const [loadingLists, setLoadingLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // errors
  const [errName, setErrName] = useState<string | null>(null);
  const [errEmail, setErrEmail] = useState<string | null>(null);
  const [errPw, setErrPw] = useState<string | null>(null);
  const [errCollege, setErrCollege] = useState<string | null>(null);
  const [errReligion, setErrReligion] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const pwStrength =
    pw.length === 0 ? null : pw.length < 6 ? "weak" : pw.length < 10 ? "medium" : "strong";
  const strengthColors = { weak: "#EF4444", medium: "#F59E0B", strong: "#10B981" } as const;

  /* ---------------- Fetch lists ---------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingLists(true);

        const [colRes, relRes] = await Promise.all([
          api.get(`/api/public/colleges`),
          api.get(`/api/public/communities?type=religion&paginated=false`),
        ]);

        const colItems = Array.isArray(colRes.data) ? colRes.data : [];
        const relItems = Array.isArray(relRes.data)
          ? relRes.data
          : Array.isArray(relRes.data?.items)
          ? relRes.data.items
          : [];

        if (!mounted) return;

        setColleges(colItems);
        setReligions(relItems);
      } catch (e) {
        console.log("Failed to load lists", e);
      } finally {
        if (mounted) setLoadingLists(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- Auto-detect college ---------------- */
  useEffect(() => {
    const lower = email.trim().toLowerCase();
    const domain = lower.split("@")[1];

    if (domain && colleges.length > 0) {
      const match = colleges.find(
        (c) => Array.isArray(c.emailDomains) && c.emailDomains.includes(domain)
      );

      if (match) {
        setCollegeId(match._id);
        setErrCollege(null);
      }
    }
  }, [email, colleges]);

  const autoDetectedCollege = useMemo(() => {
    if (!collegeId) return null;
    const c = colleges.find((x) => x._id === collegeId);
    const domain = email.split("@")[1]?.toLowerCase();
    if (c && domain && c.emailDomains?.includes(domain)) return c;
    return null;
  }, [collegeId, colleges, email]);

  /* ---------------- STRICT Filtered Communities (Option A) ---------------- */
  const filteredCommunities = useMemo(() => {
    if (!collegeId) return [];

    const col = colleges.find((c) => c._id === collegeId);
    if (!col) return [];

    const collegeKey = col.key.toLowerCase();
    const collegeName = col.name.toLowerCase();

    return religions.filter((r) => {
      const tags = (r.tags || []).map((t) => t.toLowerCase());
      if (tags.includes(collegeKey)) return true;
      if (r.name.toLowerCase().includes(collegeName)) return true;
      return false;
    });
  }, [collegeId, colleges, religions]);

  /* ---------------- Validation ---------------- */
  const validate = () => {
    let ok = true;
    setErrName(null);
    setErrEmail(null);
    setErrPw(null);
    setErrCollege(null);
    setErrReligion(null);
    setServerError(null);

    if (!name.trim()) {
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
      setErrReligion("Select your community");
      ok = false;
    }
    return ok;
  };

  /* ---------------- Submit ---------------- */
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

      const data = await register(body);

      router.replace({
        pathname: "/verify-email",
        params: { email: body.email, message: data.message },
      });
    } catch (err: any) {
      const e = err?.response?.data?.error ?? err?.response?.data ?? err?.message;
      if (typeof e === "string") setServerError(e);
      else if (e && typeof e === "object") {
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

  /* ---------------- Components ---------------- */
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
    const anim = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.95))}
        onPressOut={() => {
          scale.value = withSpring(1);
          onPress();
        }}
        style={{ marginRight: 8, marginBottom: 10 }}
      >
        <Animated.View
          style={[
            anim,
            {
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: active
                ? "#6366F1"
                : isDark
                ? "#1F2937"
                : "#F3F4F6",
              borderWidth: active ? 0 : 1,
              borderColor: isDark ? "#374151" : "#E5E7EB",
              flexDirection: "row",
              alignItems: "center",
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
              color: active ? "#fff" : isDark ? "#D1D5DB" : "#374151",
            }}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  const SubmitButton = ({
    loading,
    disabled,
    onPress,
  }: {
    loading: boolean;
    disabled: boolean;
    onPress: () => void;
  }) => {
    const scale = useSharedValue(1);
    const op = useSharedValue(1);

    const anim = useAnimatedStyle(() => ({
      opacity: op.value,
      transform: [{ scale: scale.value }],
    }));

    return (
      <Pressable
        disabled={disabled}
        onPressIn={() => {
          if (!disabled) {
            scale.value = withSpring(0.97);
            op.value = withTiming(0.9);
          }
        }}
        onPressOut={() => {
          if (!disabled) {
            scale.value = withSpring(1);
            op.value = withTiming(1);
            onPress();
          }
        }}
      >
        <Animated.View style={anim}>
          <LinearGradient
            colors={disabled ? ["#9CA3AF", "#6B7280"] : ["#6366F1", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
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

  // theme
  const bgColor = isDark ? "#0B0F19" : "#F8FAFC";
  const cardBg = isDark ? "#111827" : "#FFFFFF";
  const labelColor = isDark ? "#D1D5DB" : "#374155";
  const inputBg = isDark ? "#1F2937" : "#F9FAFB";
  const inputBorder = isDark ? "#374151" : "#E5E7EB";
  const placeholder = isDark ? "#6B7280" : "#9CA3AF";
  const textColor = isDark ? "#F3F4F6" : "#111827";
  const eduDetected = useMemo(() => email.toLowerCase().includes(".edu"), [email]);

  /* ---------------- UI ---------------- */
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
        {/* Back */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}
        >
          <Ionicons name="chevron-back" size={24} color={textColor} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: textColor, marginLeft: 4 }}>
            Back
          </Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <LinearGradient
              colors={["#6366F1", "#8B5CF6", "#EC4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
            >
              <Ionicons name="people" size={44} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={{ fontSize: 32, fontWeight: "800", color: textColor }}>
            Join CommunityTalk
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 15,
              color: isDark ? "#9CA3AF" : "#6B7280",
              textAlign: "center",
            }}
          >
            Connect with campus & faith communities{"\n"}across NYC 🚀
          </Text>
        </View>

        {/* Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 24,
          }}
        >
          {/* Name */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor }}>
              Full Name
            </Text>
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderColor: inputBorder,
                borderWidth: 1.5,
                borderRadius: 14,
                height: 52,
                paddingHorizontal: 16,
              }}
            >
              <Ionicons name="person-outline" size={20} color={placeholder} />
              <TextInput
                placeholder="Your full name"
                placeholderTextColor={placeholder}
                value={name}
                onChangeText={setName}
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
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errName}</Text>
            )}
          </View>

          {/* Email */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor }}>
              Email Address
            </Text>
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderColor: inputBorder,
                borderWidth: 1.5,
                borderRadius: 14,
                height: 52,
                paddingHorizontal: 16,
              }}
            >
              <Ionicons name="mail-outline" size={20} color={placeholder} />
              <TextInput
                placeholder="you@college.edu"
                placeholderTextColor={placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
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
                  marginTop: 8,
                  backgroundColor: isDark ? "#064E3B" : "#D1FAE5",
                  padding: 8,
                  borderRadius: 8,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={{ marginLeft: 6, color: "#10B981", fontWeight: "600", fontSize: 12 }}>
                  .edu email verified ✓
                </Text>
              </View>
            )}

            {!!errEmail && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errEmail}</Text>
            )}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor }}>
              Password
            </Text>
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderColor: inputBorder,
                borderWidth: 1.5,
                borderRadius: 14,
                height: 52,
                paddingHorizontal: 16,
              }}
            >
              <Ionicons name="lock-closed-outline" size={20} color={placeholder} />
              <TextInput
                placeholder="Create a strong password"
                placeholderTextColor={placeholder}
                value={pw}
                onChangeText={setPw}
                secureTextEntry={!showPw}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 15,
                  color: textColor,
                  fontWeight: "500",
                }}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
                <Ionicons
                  name={showPw ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={placeholder}
                />
              </TouchableOpacity>
            </View>

            {pwStrength && (
              <Text
                style={{
                  color: strengthColors[pwStrength],
                  marginTop: 8,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                Password strength: {pwStrength}
              </Text>
            )}

            {!!errPw && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errPw}</Text>
            )}
          </View>

          {/* College */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor }}>
              Select College
            </Text>

            {autoDetectedCollege ? (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#ECFDF5",
                  borderColor: isDark ? "rgba(16,185,129,0.2)" : "#D1FAE5",
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: isDark ? "rgba(16,185,129,0.2)" : "#D1FAE5",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="school" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: isDark ? "#fff" : "#065F46" }}>
                    {autoDetectedCollege.name}
                  </Text>
                  <Text style={{ color: "#10B981", fontWeight: "600", fontSize: 13 }}>
                    Auto-detected via email
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
            ) : loadingLists ? (
              <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 12 }} />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
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

            {!!errCollege && !autoDetectedCollege && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errCollege}</Text>
            )}
          </View>

          {/* STRICT FILTER Community */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: labelColor }}>
              Select Your Community
            </Text>

            {loadingLists ? (
              <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 12 }} />
            ) : filteredCommunities.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
                {filteredCommunities.map((r) => (
                  <Pill
                    key={r._id}
                    label={r.name}
                    active={religionId === r._id}
                    onPress={() => setReligionId(r._id)}
                  />
                ))}
              </View>
            ) : (
              <View
                style={{
                  marginTop: 12,
                  padding: 16,
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    color: isDark ? "#9CA3AF" : "#6B7280",
                    fontStyle: "italic",
                  }}
                >
                  {collegeId
                    ? "No communities found for this college yet. More are coming soon."
                    : "Select a college above to see available communities."}
                </Text>
              </View>
            )}

            {!!errReligion && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errReligion}</Text>
            )}
          </View>

          {/* Server Error */}
          {!!serverError && (
            <View
              style={{
                backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2",
                borderColor: isDark ? "#991B1B" : "#FECACA",
                borderWidth: 1,
                padding: 12,
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: "#EF4444", fontSize: 13 }}>{serverError}</Text>
            </View>
          )}

          {/* Submit */}
          <SubmitButton onPress={handleRegister} loading={submitting} disabled={submitting} />

          {/* Terms */}
          <Text
            style={{
              marginTop: 16,
              textAlign: "center",
              color: isDark ? "#6B7280" : "#9CA3AF",
              fontSize: 11,
            }}
          >
            By creating an account, you agree to our{" "}
            <Text style={{ color: "#6366F1", fontWeight: "600" }}>Terms of Service</Text> and{" "}
            <Text style={{ color: "#6366F1", fontWeight: "600" }}>Privacy Policy</Text>.
          </Text>
        </View>

        {/* Divider */}
        <View style={{ marginVertical: 28, flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#374151" : "#E5E7EB" }} />
          <Text style={{ marginHorizontal: 16, color: isDark ? "#6B7280" : "#9CA3AF" }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#374151" : "#E5E7EB" }} />
        </View>

        {/* Login */}
        <TouchableOpacity
          onPress={() => router.push("/modal")}
          style={{
            backgroundColor: isDark ? "#1F2937" : "#F9FAFB",
            borderColor: isDark ? "#374151" : "#E5E7EB",
            borderWidth: 1.5,
            paddingVertical: 16,
            borderRadius: 16,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="log-in-outline" size={20} color={textColor} />
          <Text style={{ marginLeft: 8, color: textColor, fontWeight: "600" }}>
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
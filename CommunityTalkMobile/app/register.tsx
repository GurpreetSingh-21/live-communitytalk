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

/* ---------------- Components ---------------- */
const InputField = ({
  label,
  placeholder: placeholderText,
  value,
  onChangeText,
  icon,
  error,
  rightIcon,
  onRightIconPress,
  inputRef,
  labelColor,
  inputBg,
  inputBorder,
  placeholderColor,
  textColor,
  ...props
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: string;
  error?: string | null;
  rightIcon?: string;
  onRightIconPress?: () => void;
  inputRef?: any;
  labelColor: string;
  inputBg: string;
  inputBorder: string;
  placeholderColor: string;
  textColor: string;
  [key: string]: any;
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: labelColor, marginBottom: 8 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: inputBg,
          borderRadius: 12,
          height: 50,
          paddingHorizontal: 14,
          borderWidth: focused && !error ? 2 : 1,
          borderColor: error ? "#EF4444" : focused ? "#6366F1" : inputBorder,
        }}
      >
        <Ionicons name={icon as any} size={20} color={focused ? "#6366F1" : placeholderColor} />
        <TextInput
          ref={inputRef}
          placeholder={placeholderText}
          placeholderTextColor={placeholderColor}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            marginLeft: 10,
            fontSize: 15,
            color: textColor,
            fontWeight: "500",
          }}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon as any} size={20} color={placeholderColor} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && (
        <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6, marginLeft: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
};

const Pill = ({
  active,
  label,
  onPress,
  isDark,
  textColor,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  isDark: boolean;
  textColor: string;
}) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.96))}
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
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 12,
            backgroundColor: active ? "#6366F1" : isDark ? "#18181B" : "#F5F5F5",
            borderWidth: 1,
            borderColor: active ? "#6366F1" : isDark ? "#27272A" : "#E5E7EB",
            flexDirection: "row",
            alignItems: "center",
          },
        ]}
      >
        {active && (
          <Ionicons
            name="checkmark-circle"
            size={14}
            color="#fff"
            style={{ marginRight: 5 }}
          />
        )}
        <Text
          style={{
            fontSize: 14,
            fontWeight: active ? "600" : "500",
            color: active ? "#fff" : textColor,
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

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(0.96);
      }}
      onPressOut={() => {
        if (!disabled) {
          scale.value = withSpring(1);
          onPress();
        }
      }}
    >
      <Animated.View style={anim}>
        <View
          style={{
            height: 52,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: disabled ? "#9CA3AF" : "#6366F1",
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                Create Account
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
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
          api.get(`/api/public/communities?type=religion&type=custom&paginated=false`),
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

  // Modern theme
  const bgColor = isDark ? "#000000" : "#FFFFFF";
  const cardBg = isDark ? "#0F0F0F" : "#FAFBFC";
  const labelColor = isDark ? "#A1A1AA" : "#71717A";
  const inputBg = isDark ? "#18181B" : "#FFFFFF";
  const inputBorder = isDark ? "#27272A" : "#F4F4F5";
  const inputBorderFocus = isDark ? "#6366F1" : "#6366F1";
  const placeholder = isDark ? "#71717A" : "#A1A1AA";
  const textColor = isDark ? "#FFFFFF" : "#111827";
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
          paddingTop: insets.top + 8,
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
            marginBottom: 24,
            alignSelf: "flex-start",
          }}
        >
          <Ionicons name="chevron-back" size={22} color={textColor} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: textColor, marginLeft: 2 }}>
            Back
          </Text>
        </TouchableOpacity>

        {/* Modern Hero */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              overflow: "hidden",
              marginBottom: 18,
              backgroundColor: "#6366F1",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="people" size={36} color="#fff" />
          </View>

          <Text style={{ fontSize: 28, fontWeight: "700", color: textColor, letterSpacing: -0.6 }}>
            Join CommunityTalk
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 14,
              color: labelColor,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Connect with campus & faith communities{"\n"}across NYC 🚀
          </Text>
        </View>

        {/* Modern Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? "#27272A" : "#F4F4F5",
          }}
        >
          {/* Name Input */}
          <InputField
            label="Full Name"
            placeholder="Your full name"
            value={name}
            onChangeText={setName}
            icon="person-outline"
            error={errName}
            autoCapitalize="words"
            labelColor={labelColor}
            inputBg={inputBg}
            inputBorder={inputBorder}
            placeholderColor={placeholder}
            textColor={textColor}
          />

          {/* Email Input */}
          <View>
            <InputField
              label="Email Address"
              placeholder="you@college.edu"
              value={email}
              onChangeText={setEmail}
              icon="mail-outline"
              error={errEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              labelColor={labelColor}
              inputBg={inputBg}
              inputBorder={inputBorder}
              placeholderColor={placeholder}
              textColor={textColor}
            />

            {eduDetected && (
              <View
                style={{
                  marginTop: -12,
                  marginBottom: 20,
                  backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                  padding: 10,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={{ marginLeft: 6, color: "#10B981", fontWeight: "600", fontSize: 13 }}>
                  .edu email verified ✓
                </Text>
              </View>
            )}
          </View>

          {/* Password Input */}
          <View>
            <InputField
              label="Password"
              placeholder="Create a strong password"
              value={pw}
              onChangeText={setPw}
              icon="lock-closed-outline"
              error={errPw}
              secureTextEntry={!showPw}
              rightIcon={showPw ? "eye-outline" : "eye-off-outline"}
              onRightIconPress={() => setShowPw((v) => !v)}
              labelColor={labelColor}
              inputBg={inputBg}
              inputBorder={inputBorder}
              placeholderColor={placeholder}
              textColor={textColor}
            />

            {pwStrength && (
              <View style={{ marginTop: -12, marginBottom: 20 }}>
                <View style={{ flexDirection: "row", gap: 4, marginBottom: 6 }}>
                  {["weak", "medium", "strong"].map((level, i) => (
                    <View
                      key={level}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor:
                          pwStrength === "weak" && i === 0
                            ? "#EF4444"
                            : pwStrength === "medium" && i <= 1
                              ? "#F59E0B"
                              : pwStrength === "strong"
                                ? "#10B981"
                                : isDark
                                  ? "#27272A"
                                  : "#E5E7EB",
                      }}
                    />
                  ))}
                </View>
                <Text
                  style={{
                    color: strengthColors[pwStrength],
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {pwStrength.charAt(0).toUpperCase() + pwStrength.slice(1)} password
                </Text>
              </View>
            )}
          </View>

          {/* College Selection */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: labelColor, marginBottom: 12 }}>
              Select College
            </Text>

            {autoDetectedCollege ? (
              <View
                style={{
                  backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                  borderColor: isDark ? "#059669" : "#10B981",
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDark ? "#059669" : "#D1FAE5",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="school" size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", color: textColor, fontSize: 15 }}>
                    {autoDetectedCollege.name}
                  </Text>
                  <Text style={{ color: "#10B981", fontWeight: "500", fontSize: 12, marginTop: 2 }}>
                    Auto-detected via email
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              </View>
            ) : loadingLists ? (
              <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 12 }} />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {colleges.map((c) => (
                  <Pill
                    key={c._id}
                    label={c.name}
                    active={collegeId === c._id}
                    onPress={() => setCollegeId(c._id)}
                    isDark={isDark}
                    textColor={textColor}
                  />
                ))}
              </View>
            )}

            {!!errCollege && !autoDetectedCollege && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6, marginLeft: 4 }}>
                {errCollege}
              </Text>
            )}
          </View>

          {/* Community Selection */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: labelColor, marginBottom: 12 }}>
              Select Your Community
            </Text>

            {loadingLists ? (
              <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 12 }} />
            ) : filteredCommunities.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {filteredCommunities.map((r) => (
                  <Pill
                    key={r._id}
                    label={r.name}
                    active={religionId === r._id}
                    onPress={() => setReligionId(r._id)}
                    isDark={isDark}
                    textColor={textColor}
                  />
                ))}
              </View>
            ) : (
              <View
                style={{
                  padding: 14,
                  backgroundColor: isDark ? "#18181B" : "#F9FAFB",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDark ? "#27272A" : "#F4F4F5",
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    color: labelColor,
                    fontSize: 13,
                  }}
                >
                  {collegeId
                    ? "No communities found for this college yet. More coming soon!"
                    : "Select a college above to see available communities."}
                </Text>
              </View>
            )}

            {!!errReligion && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6, marginLeft: 4 }}>
                {errReligion}
              </Text>
            )}
          </View>

          {/* Server Error */}
          {!!serverError && (
            <View
              style={{
                backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2",
                borderColor: "#EF4444",
                borderWidth: 1,
                padding: 12,
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "500" }}>
                {serverError}
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <SubmitButton onPress={handleRegister} loading={submitting} disabled={submitting} />

          {/* Terms */}
          <Text
            style={{
              marginTop: 14,
              textAlign: "center",
              color: labelColor,
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            By creating an account, you agree to our{" "}
            <Text style={{ color: "#6366F1", fontWeight: "600" }}>Terms of Service</Text> and{" "}
            <Text style={{ color: "#6366F1", fontWeight: "600" }}>Privacy Policy</Text>.
          </Text>
        </View>

        {/* Divider */}
        <View style={{ marginVertical: 24, flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: isDark ? "#27272A" : "#F4F4F5",
            }}
          />
          <Text style={{ marginHorizontal: 16, color: labelColor, fontSize: 13 }}>or</Text>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: isDark ? "#27272A" : "#F4F4F5",
            }}
          />
        </View>

        {/* Login Link */}
        <TouchableOpacity
          onPress={() => router.push("/modal")}
          style={{
            backgroundColor: isDark ? "#18181B" : "#F9FAFB",
            borderColor: isDark ? "#27272A" : "#E5E7EB",
            borderWidth: 1,
            paddingVertical: 14,
            borderRadius: 12,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="log-in-outline" size={18} color={textColor} />
          <Text style={{ marginLeft: 8, color: textColor, fontWeight: "600", fontSize: 15 }}>
            Already have an account? Log in
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
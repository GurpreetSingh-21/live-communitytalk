//CommunityTalkMobile/app/register.tsx
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api/api";
import React from "react";
import { AuthContext } from "@/src/context/AuthContext";

type CommunityLite = {
  _id: string;
  name: string;
  type: "college" | "religion" | "custom";
  key?: string;
  tags?: string[];
};

export default function RegisterScreen() {
  const { setToken, bootstrap } = (React.useContext(AuthContext) as any) ?? {};
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

  // Load public communities for college + religion
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingLists(true);
        const [colRes, relRes] = await Promise.all([
          api.get(`/api/public/communities?type=college&paginated=false`),
          api.get(`/api/public/communities?type=religion&paginated=false`),
        ]);

        // backend /api/public/communities returns either {items:[]} or [] depending on paginated flag
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
      } catch (e) {
        // keep silent; UI will still let user retry submit to see errors
      } finally {
        if (mounted) setLoadingLists(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // simple client validation
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

      const { data } = await api.post("/register", body);
      // success payload (from backend):
      // { message, token, user: {...}, communities: [...] }
      if (!data?.token) {
        setServerError("Unexpected response from server.");
        return;
      }

      // store token if your AuthContext exposes a setter
      if (typeof setToken === "function") {
        setToken(data.token);
      }
      if (typeof bootstrap === "function") {
        await bootstrap();
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      // backend may return {error: {email: "...", collegeId: "...", religionId: "..."}}
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

  // small helper to render a pill for selection
  const Pill = ({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-2 rounded-full border ${active ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"}`}
      style={{ marginRight: 8, marginBottom: 8 }}
    >
      <Text className={`text-xs font-semibold ${active ? "text-white" : "text-slate-700"}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // filter suggestions (very light)
  const eduDetected = useMemo(() => email.toLowerCase().includes(".edu"), [email]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      className="flex-1 bg-slate-50"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Back Button */}
        <View className="px-5 pt-14 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2">
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
            <Text className="text-slate-700 font-semibold text-base">Back</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-1 justify-center px-5">
          {/* Hero Section */}
          <View className="items-center mb-8">
            <View className="mb-4 overflow-hidden rounded-3xl shadow-2xl">
              <LinearGradient
                colors={["#6366F1", "#8B5CF6", "#EC4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="h-20 w-20 items-center justify-center"
              >
                <Ionicons name="person-add" size={40} color="white" />
              </LinearGradient>
            </View>

            <Text className="text-3xl font-extrabold text-slate-900 mb-2">
              Join CommunityTalk
            </Text>
            <Text className="text-slate-600 text-center text-base">
              Connect with campus & faith communities across NYC 🚀
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-3xl p-6 shadow-xl">
            {/* Name Input */}
            <View className="mb-3">
              <Text className="font-semibold text-slate-700 mb-2 text-sm">Full Name</Text>
              <View className="flex-row items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3">
                <Ionicons name="person-outline" size={20} color="#64748B" />
                <TextInput
                  placeholder="Your full name"
                  value={name}
                  onChangeText={setName}
                  className="flex-1 ml-3 text-slate-900 text-base"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>
              {!!errName && <Text className="text-xs text-red-500 mt-1">{errName}</Text>}
            </View>

            {/* Email Input */}
            <View className="mb-3">
              <Text className="font-semibold text-slate-700 mb-2 text-sm">Email Address</Text>
              <View className="flex-row items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3">
                <Ionicons name="mail-outline" size={20} color="#64748B" />
                <TextInput
                  placeholder="you@college.edu"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  className="flex-1 ml-3 text-slate-900 text-base"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {eduDetected && (
                <View className="flex-row items-center gap-2 mt-2">
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text className="text-emerald-600 text-xs font-medium">.edu email detected ✓</Text>
                </View>
              )}
              {!!errEmail && <Text className="text-xs text-red-500 mt-1">{errEmail}</Text>}
            </View>

            {/* Password Input */}
            <View className="mb-2">
              <Text className="font-semibold text-slate-700 mb-2 text-sm">Password</Text>
              <View className="flex-row items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3">
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
                <TextInput
                  placeholder="Create a strong password"
                  secureTextEntry={!showPw}
                  value={pw}
                  onChangeText={setPw}
                  className="flex-1 ml-3 text-slate-900 text-base"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
                  <Ionicons
                    name={showPw ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {pwStrength && (
                <View className="mt-3">
                  <View className="flex-row gap-1.5 mb-2">
                    <View
                      className={`flex-1 h-1.5 rounded-full ${
                        pwStrength === "weak" ? "bg-red-500" : "bg-slate-200"
                      }`}
                    />
                    <View
                      className={`flex-1 h-1.5 rounded-full ${
                        pwStrength === "medium" || pwStrength === "strong"
                          ? "bg-yellow-500"
                          : "bg-slate-200"
                      }`}
                    />
                    <View
                      className={`flex-1 h-1.5 rounded-full ${
                        pwStrength === "strong" ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  </View>
                  <Text className="text-xs font-medium" style={{ color: strengthColors[pwStrength] }}>
                    Password strength: {pwStrength}
                  </Text>
                </View>
              )}
              {!!errPw && <Text className="text-xs text-red-500 mt-1">{errPw}</Text>}
            </View>

            {/* College Select */}
            <View className="mt-4">
              <Text className="font-semibold text-slate-700 mb-2 text-sm">Select College</Text>
              {loadingLists ? (
                <View className="py-3 flex-row items-center gap-2">
                  <ActivityIndicator />
                  <Text className="text-slate-500">Loading colleges…</Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap">
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
              {!!errCollege && <Text className="text-xs text-red-500 mt-1">{errCollege}</Text>}
            </View>

            {/* Religion Select */}
            <View className="mt-4">
              <Text className="font-semibold text-slate-700 mb-2 text-sm">Select Your Community</Text>
              {loadingLists ? (
                <View className="py-3 flex-row items-center gap-2">
                  <ActivityIndicator />
                  <Text className="text-slate-500">Loading communities…</Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap">
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
              {!!errReligion && <Text className="text-xs text-red-500 mt-1">{errReligion}</Text>}
            </View>

            {/* Server error (top-level) */}
            {!!serverError && (
              <View className="mt-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                <Text className="text-red-600 text-sm">{serverError}</Text>
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={submitting}
              className={`mt-6 rounded-2xl overflow-hidden shadow-xl ${
                submitting ? "opacity-70" : ""
              }`}
            >
              <LinearGradient
                colors={["#6366F1", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="py-4 items-center"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Create Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Terms */}
            <Text className="text-center text-xs text-slate-500 mt-4 leading-5">
              By creating an account, you agree to our{" "}
              <Text className="text-indigo-600 font-semibold">Terms of Service</Text> and{" "}
              <Text className="text-indigo-600 font-semibold">Privacy Policy</Text>
            </Text>

            {/* Divider */}
            <View className="flex-row items-center justify-center my-6">
              <View className="flex-1 h-px bg-slate-200" />
              <Text className="mx-4 text-slate-500 text-sm">or</Text>
              <View className="flex-1 h-px bg-slate-200" />
            </View>

            {/* Back to Login */}
            <TouchableOpacity
              onPress={() => router.replace("/")}
              className="flex-row gap-2 items-center justify-center py-4 border-2 border-slate-300 rounded-2xl"
            >
              <Ionicons name="log-in-outline" size={20} color="#64748B" />
              <Text className="font-semibold text-slate-700">
                Already have an account? Log in
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-6 items-center">
            <View className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg">
              <Text className="text-2xl">✨</Text>
              <Text className="text-slate-600 font-medium">Your communities await</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
import React, { useEffect, useMemo, useState, useRef } from "react";
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
  Dimensions,
  Image,
  StyleSheet,
} from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "@/src/api/api";
import { AuthContext } from "@/src/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInRight,
  FadeOutLeft,
  SlideInRight,
  SlideOutLeft,
  Easing,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

/* ---------------- Types ---------------- */
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

/* ─────────────── Step Dots ─────────────── */
const StepDots = ({ currentStep, totalSteps, color }: { currentStep: number; totalSteps: number; color: string }) => (
  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
    {Array.from({ length: totalSteps }).map((_, i) => {
      const isActive = i + 1 === currentStep;
      const isCompleted = i + 1 < currentStep;
      return (
        <MotiView
          key={i}
          animate={{
            width: isActive ? 24 : 8,
            backgroundColor: isActive || isCompleted ? color : "rgba(255,255,255,0.4)",
          }}
          transition={{ type: "spring", damping: 14 }}
          style={{ height: 8, borderRadius: 4 }}
        />
      );
    })}
  </View>
);

/* ─────────────── Floating BG Shapes ─────────────── */
const FloatingShape = ({
  size,
  top,
  left,
  right,
  bottom,
  icon,
  opacity = 0.12,
  delay = 0,
}: any) => (
  <MotiView
    from={{ translateY: 0 }}
    animate={{ translateY: -14 }}
    transition={{ loop: true, type: "timing", duration: 3500 + delay, easing: Easing.inOut(Easing.ease) }}
    style={{
      position: "absolute",
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
      borderRadius: 20,
      backgroundColor: `rgba(255,255,255,${opacity})`,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Ionicons name={icon} size={size * 0.45} color={`rgba(255,255,255,0.5)`} />
  </MotiView>
);

/* ─────────────── Mascot Animation ─────────────── */
const StepMascot = ({ step, size = 160 }: { step: number; size?: number }) => {
  const getSource = () => {
    switch (step) {
      case 1: return require("../assets/images/mascot_cat_transparent.png");
      case 2: return require("../assets/images/mascot_cat_typing_transparent.png");
      case 3: default: return require("../assets/images/mascot_cat_celebrating_transparent.png");
    }
  };

  const getAnimation = () => {
    switch (step) {
      case 1: return { rotateZ: "-5deg" };
      case 2: return { translateY: -6 };
      case 3: default: return { scale: 1.05 };
    }
  };

  const getLoopBack = () => {
    switch (step) {
      case 1: return { rotateZ: "5deg" };
      case 2: return { translateY: 6 };
      case 3: default: return { scale: 1 };
    }
  };

  return (
    <MotiView
      key={`mascot-${step}`}
      from={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 14 }}
    >
      <MotiView
        animate={getAnimation()}
        transition={{ loop: true, type: "timing", duration: 2500, easing: Easing.inOut(Easing.ease) }}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 15 },
          shadowOpacity: 0.12,
          shadowRadius: 25,
        }}
      >
        <Image
          source={getSource()}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </MotiView>
    </MotiView>
  );
};

/* ─────────────── Glassy Input ─────────────── */
const GlassInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  error,
  secureTextEntry,
  rightIcon,
  onRightIconPress,
  keyboardType,
  autoCapitalize,
  isDark,
  delay = 0,
}: any) => {
  const [focused, setFocused] = useState(false);

  return (
    <MotiView 
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "spring", damping: 16, delay }}
      style={{ marginBottom: 16 }}
    >
      {label && (
        <Text style={{
          fontFamily: Fonts!.bold,
          fontSize: 11,
          letterSpacing: 1.2,
          color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
          marginBottom: 8,
          textTransform: "uppercase",
        }}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputContainer,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
          borderColor: focused
            ? (isDark ? "rgba(34,197,94,0.5)" : "rgba(22,163,74,0.4)")
            : (isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.8)"),
        },
        error ? { borderColor: "rgba(239,68,68,0.5)" } : null,
      ]}>
        <Ionicons name={icon} size={18} color={focused ? (isDark ? "#22C55E" : "#16A34A") : (isDark ? "rgba(255,255,255,0.4)" : "#999")} style={{ marginRight: 12 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? "rgba(255,255,255,0.3)" : "#AAA"}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "sentences"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontSize: 16,
            fontFamily: Fonts!.sans,
            color: isDark ? "#FFF" : "#111",
            height: "100%",
          }}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={{ padding: 4 }}>
            <Ionicons name={rightIcon} size={20} color={isDark ? "rgba(255,255,255,0.4)" : "#999"} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <MotiView
          from={{ opacity: 0, translateY: -4 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 }}
        >
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: Fonts!.regular }}>{error}</Text>
        </MotiView>
      )}
    </MotiView>
  );
};

/* ─────────────── Green Pill Button ─────────────── */
const PillButton = ({ label, onPress, loading, disabled, isDark }: any) => {
  const primaryColor = isDark ? "#22C55E" : "#16A34A";
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={{ marginTop: 8 }}>
      <View style={[
        styles.pillButton,
        { backgroundColor: disabled ? "rgba(22,163,74,0.4)" : primaryColor },
      ]}>
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#FFF", fontFamily: Fonts!.bold, fontSize: 17 }}>{label}</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

/* ─────────────── MAIN SCREEN ─────────────── */
export default function RegisterWizard() {
  const { register } = (React.useContext(AuthContext) as any) ?? {};
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? "light";
  const isDark = scheme === "dark";
  const colors = Colors[scheme];

  // Wizard State
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Form Data
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [collegeId, setCollegeId] = useState("");
  const [religionId, setReligionId] = useState("");

  // Lists
  const [colleges, setColleges] = useState<CollegeType[]>([]);
  const [religions, setReligions] = useState<CommunityLite[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});

  /* ── Fetch Lists ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [colRes, relRes] = await Promise.all([
          api.get(`/api/public/colleges`),
          api.get(`/api/public/communities?type=religion&type=custom&paginated=false`),
        ]);
        if (mounted) {
          setColleges(Array.isArray(colRes.data) ? colRes.data : []);
          setReligions(Array.isArray(relRes.data) ? relRes.data : relRes.data?.items || []);
          setLoadingLists(false);
        }
      } catch (e) {
        console.log("Failed to load lists", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ── Auto Detect College ── */
  useEffect(() => {
    const domain = email.trim().toLowerCase().split("@")[1];
    if (domain && colleges.length > 0) {
      const match = colleges.find((c) => c.emailDomains?.includes(domain));
      if (match) {
        setCollegeId(match._id);
        setErrors((prev) => ({ ...prev, college: null }));
      }
    }
  }, [email, colleges]);

  /* ── Computed ── */
  const filteredCommunities = useMemo(() => {
    if (!collegeId) return [];
    const col = colleges.find((c) => c._id === collegeId);
    if (!col) return [];
    const collegeKey = col.key.toLowerCase();
    const collegeName = col.name.toLowerCase();
    return religions.filter((r) => {
      const tags = (r.tags || []).map((t) => t.toLowerCase());
      return tags.includes(collegeKey) || r.name.toLowerCase().includes(collegeName);
    });
  }, [collegeId, colleges, religions]);

  /* ── Image Picker ── */
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to set your avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0].uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  /* ── Validation ── */
  const validateStep1 = () => {
    const errs: any = {};
    if (!name.trim()) errs.name = "What should we call you?";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: any = {};
    const em = email.trim().toLowerCase();
    if (!em) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(em)) errs.email = "Please enter a valid email";
    if (!pw) errs.pw = "Password is required";
    else if (pw.length < 8) errs.pw = "Must be at least 8 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs: any = {};
    if (!collegeId) errs.college = "Please select your campus";
    if (!religionId) errs.community = "Please join a community";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  /* ── Submit ── */
  const handleRegister = async () => {
    if (!validateStep3()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const body = {
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        password: pw,
        collegeId,
        religionId,
      };
      const data = await register(body);
      if (avatarUri) {
        await AsyncStorage.setItem(`pending_avatar_${body.email}`, avatarUri);
      }
      router.replace({
        pathname: "/verify-email",
        params: { email: body.email, message: data.message },
      });
    } catch (err: any) {
      const e = err?.response?.data?.error;
      if (typeof e === "object") {
        setServerError(String(Object.values(e)[0]));
      } else {
        setServerError(e || "Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Background gradient colors ─── */
  const bgColors: [string, string, string] = isDark
    ? ["#121C23", "#0F1F18", "#0A1612"]
    : ["#C8F0DC", "#E0EEF8", "#EDE8F8"]; // mint → light blue → soft lavender (matches screenshot)

  const primaryColor = isDark ? "#22C55E" : "#16A34A";

  /* ─────── STEP 1: Identity ─────── */
  const renderIdentity = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft}>
      {/* Title */}
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "spring", damping: 16, delay: 50 }}
        style={{ alignItems: "center", marginBottom: 32 }}
      >
        <Text style={[styles.stepTitle, { color: isDark ? "#FFF" : "#111" }]}>Who are you?</Text>
        <Text style={[styles.stepSubtitle, { color: isDark ? "rgba(255,255,255,0.6)" : "#666" }]}>
          Let's put a face to the name.
        </Text>
      </MotiView>

      {/* Mascot + Avatar overlap section */}
      <View style={{ height: 200, marginBottom: 32, flexDirection: "row", justifyContent: "center", alignItems: "flex-end" }}>
        
        {/* Frosted avatar circle in front on the left */}
        <TouchableOpacity onPress={pickImage} style={{ zIndex: 2, marginRight: -50, marginBottom: 10 }} activeOpacity={0.9}>
          <View style={[
            styles.avatarCircle,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.65)",
              borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.9)",
              shadowColor: "#000",
            },
          ]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="camera-outline" size={44} color={isDark ? "rgba(255,255,255,0.5)" : "#888"} />
            )}
          </View>
          {/* Green + badge */}
          <View style={[styles.avatarBadge, { backgroundColor: primaryColor, borderColor: "rgba(255,255,255,0.8)" }]}>
            <Ionicons name="add" size={20} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Mascot behind on the right */}
        <View style={{ zIndex: 1, paddingBottom: 10 }}>
          <StepMascot step={step} size={190} />
        </View>
      </View>

      {/* Full Name Input */}
      <GlassInput
        label="Full Name"
        placeholder="Jane Doe"
        value={name}
        onChangeText={setName}
        icon="person-outline"
        error={errors.name}
        isDark={isDark}
      />

      <PillButton label="Next Step" onPress={nextStep} isDark={isDark} />
    </Animated.View>
  );

  /* ─────── STEP 2: Credentials ─────── */
  const renderCredentials = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft}>
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "spring", damping: 16, delay: 50 }}
        style={{ alignItems: "center", marginBottom: 24 }}
      >
        <Text style={[styles.stepTitle, { color: isDark ? "#FFF" : "#111" }]}>Secure account</Text>
        <Text style={[styles.stepSubtitle, { color: isDark ? "rgba(255,255,255,0.6)" : "#666" }]}>
          Use your .edu email if you have one.
        </Text>
      </MotiView>

      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <StepMascot step={step} size={180} />
      </View>

      <GlassInput
        label="Email Address"
        placeholder="student@college.edu"
        value={email}
        onChangeText={setEmail}
        icon="mail-outline"
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        isDark={isDark}
        delay={100}
      />
      <GlassInput
        label="Password"
        placeholder="Min 8 characters"
        value={pw}
        onChangeText={setPw}
        icon="lock-closed-outline"
        secureTextEntry={!showPw}
        rightIcon={showPw ? "eye-off-outline" : "eye-outline"}
        onRightIconPress={() => setShowPw(!showPw)}
        error={errors.pw}
        isDark={isDark}
        delay={200}
      />

      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "spring", damping: 16, delay: 300 }}>
        <PillButton label="Next Step" onPress={nextStep} isDark={isDark} />
      </MotiView>
    </Animated.View>
  );

  /* ─────── STEP 3: Community ─────── */
  const renderCommunity = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft}>
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "spring", damping: 16, delay: 50 }}
        style={{ alignItems: "center", marginBottom: 20 }}
      >
        <Text style={[styles.stepTitle, { color: isDark ? "#FFF" : "#111" }]}>Find your tribe</Text>
        <Text style={[styles.stepSubtitle, { color: isDark ? "rgba(255,255,255,0.6)" : "#666" }]}>
          Connect with your campus community.
        </Text>
      </MotiView>

      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <StepMascot step={step} size={140} />
      </View>

      {/* College Picker */}
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "spring", damping: 16, delay: 100 }} style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 11, fontFamily: Fonts!.bold, color: isDark ? "rgba(255,255,255,0.6)" : "#444", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>
          {collegeId ? "Your Campus" : "Select Campus"}
        </Text>
        {collegeId ? (
          <Animated.View entering={FadeInRight} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[styles.selectedChip, { backgroundColor: primaryColor, flex: 1 }]}>
              <Text style={{ color: "#fff", fontFamily: Fonts!.bold, fontSize: 15 }}>
                {colleges.find((c) => c._id === collegeId)?.name}
              </Text>
              <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.8)" />
            </View>
            <TouchableOpacity onPress={() => { setCollegeId(""); setReligionId(""); }} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#666", fontFamily: Fonts!.sans, fontSize: 13 }}>Change</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {loadingLists ? <ActivityIndicator color={primaryColor} /> : colleges.map((c) => (
              <TouchableOpacity
                key={c._id}
                onPress={() => { setCollegeId(c._id); setReligionId(""); }}
                style={[styles.chip, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)",
                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
                }]}
              >
                <Text style={{ color: isDark ? "#FFF" : "#333", fontFamily: Fonts!.sans, fontSize: 13 }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {errors.college && <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errors.college}</Text>}
      </MotiView>

      {/* Community Picker */}
      {collegeId && (
        <Animated.View entering={FadeInRight} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontFamily: Fonts!.bold, color: isDark ? "rgba(255,255,255,0.6)" : "#444", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>
            Select Community
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {filteredCommunities.length > 0 ? filteredCommunities.map((r) => (
              <TouchableOpacity
                key={r._id}
                onPress={() => setReligionId(r._id)}
                style={[styles.chip, {
                  backgroundColor: religionId === r._id ? primaryColor : (isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)"),
                  borderColor: religionId === r._id ? primaryColor : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"),
                }]}
              >
                <Text style={{ color: religionId === r._id ? "#FFF" : (isDark ? "#FFF" : "#333"), fontFamily: Fonts!.sans, fontSize: 13 }}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            )) : (
              <Text style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#999", fontStyle: "italic", fontSize: 14 }}>
                No communities found for this campus.
              </Text>
            )}
          </View>
          {errors.community && <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{errors.community}</Text>}
        </Animated.View>
      )}

      {serverError && (
        <View style={{ marginBottom: 16, padding: 12, backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "#EF4444" }}>
          <Text style={{ color: "#EF4444", fontFamily: Fonts!.sans, fontSize: 14 }}>{serverError}</Text>
        </View>
      )}

      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "spring", damping: 16, delay: 200 }}>
        <PillButton label="Join Campustry 🎉" onPress={handleRegister} loading={submitting} isDark={isDark} />
      </MotiView>
    </Animated.View>
  );

  /* ─────────── ROOT RENDER ─────────── */
  return (
    <LinearGradient colors={bgColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      {/* Floating bg decorative shapes */}
      <FloatingShape size={100} top={height * 0.08} left={-30} icon="person-outline" opacity={0.08} delay={0} />
      <FloatingShape size={80} top={height * 0.25} right={-20} icon="triangle-outline" opacity={0.1} delay={300} />
      <FloatingShape size={90} bottom={height * 0.15} right={-15} icon="person-outline" opacity={0.07} delay={600} />
      <FloatingShape size={70} bottom={height * 0.05} left={-10} icon="ellipse-outline" opacity={0.09} delay={900} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header row: back button | dots centered | spacer */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <TouchableOpacity onPress={prevStep} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={isDark ? "#FFF" : "#222"} />
            </TouchableOpacity>
            <StepDots currentStep={step} totalSteps={totalSteps} color={primaryColor} />
            {/* Spacer to balance */}
            <View style={{ width: 36 }} />
          </View>

          {/* Step content */}
          {step === 1 && renderIdentity()}
          {step === 2 && renderCredentials()}
          {step === 3 && renderCommunity()}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/* ─────────────── Styles ─────────────── */
const styles = StyleSheet.create({
  stepTitle: {
    fontFamily: Fonts!.bold,
    fontSize: 34,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: Fonts!.regular,
    fontSize: 16,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    height: 60,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  pillButton: {
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectedChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
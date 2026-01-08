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
} from "react-native-reanimated";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get("window");

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

/* ---------------- Components ---------------- */

const StepIndicator = ({ currentStep, totalSteps, color }: { currentStep: number, totalSteps: number, color: string }) => {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 30, gap: 8 }}>
      {Array.from({ length: totalSteps }).map((_, i) => {
        const isActive = i + 1 === currentStep;
        const isCompleted = i + 1 < currentStep;
        return (
          <Animated.View
            key={i}
            style={{
              height: 4,
              width: isActive ? 32 : 12,
              borderRadius: 2,
              backgroundColor: isActive || isCompleted ? color : 'rgba(150,150,150,0.3)',
            }}
          />
        );
      })}
    </View>
  )
}

const InputField = ({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  error,
  rightIcon,
  onRightIconPress,
  isDark,
  colors,
  ...props
}: any) => {
  const [focused, setFocused] = useState(false);
  const inputBg = isDark ? "#18181B" : "#F3F4F6";
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={{ marginBottom: 20 }}>
      {label && <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: inputBg,
          borderRadius: 16,
          height: 56,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          borderColor,
        }}
      >
        <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 16,
            color: colors.text,
            fontFamily: Fonts.sans,
          }}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Animated.Text entering={FadeInRight} style={{ color: colors.danger, fontSize: 12, marginTop: 6, marginLeft: 4, fontFamily: Fonts.bold }}>
          {error}
        </Animated.Text>
      )}
    </View>
  );
};

const WizardButton = ({ onPress, loading, disabled, label, primaryColor, icon = "arrow-forward" }: any) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: disabled ? "#9CA3AF" : primaryColor,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        shadowColor: primaryColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: disabled ? 0 : 0.3,
        shadowRadius: 10,
        elevation: disabled ? 0 : 6,
        marginTop: 20
      }}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          <Text style={{ color: '#fff', fontSize: 16, fontFamily: Fonts.bold, marginRight: 8 }}>{label}</Text>
          <Ionicons name={icon as any} size={20} color="#fff" />
        </>
      )}
    </TouchableOpacity>
  );
};

/* ---------------- MAIN SCREEN ---------------- */
export default function RegisterWizard() {
  const { register } = (React.useContext(AuthContext) as any) ?? {};
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
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

  // Lists Data
  const [colleges, setColleges] = useState<CollegeType[]>([]);
  const [religions, setReligions] = useState<CommunityLite[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Errors
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});

  /* ---------------- Fetch Data ---------------- */
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

  /* ---------------- Auto Detect ---------------- */
  useEffect(() => {
    const domain = email.trim().toLowerCase().split("@")[1];
    if (domain && colleges.length > 0) {
      const match = colleges.find(c => c.emailDomains?.includes(domain));
      if (match) {
        setCollegeId(match._id);
        setErrors(prev => ({ ...prev, college: null }));
      }
    }
  }, [email, colleges]);

  /* ---------------- Computed Data (HOISTED) ---------------- */
  const filteredCommunities = useMemo(() => {
    if (!collegeId) return [];
    const col = colleges.find(c => c._id === collegeId);
    if (!col) return [];
    const collegeKey = col.key.toLowerCase();
    const collegeName = col.name.toLowerCase();
    return religions.filter(r => {
      const tags = (r.tags || []).map(t => t.toLowerCase());
      return tags.includes(collegeKey) || r.name.toLowerCase().includes(collegeName);
    });
  }, [collegeId, colleges, religions]);

  /* ---------------- Step Logic ---------------- */
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to set your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // FIXED: Use string literal array to avoid type errors
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0].uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const validateStep1 = () => {
    let errs: any = {};
    if (!name.trim()) errs.name = "What should we call you?";
    // Avatar is optional but recommended. We won't block.
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    let errs: any = {};
    const em = email.trim().toLowerCase();
    if (!em) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(em)) errs.email = "Please enter a valid email";

    if (!pw) errs.pw = "Password is required";
    else if (pw.length < 8) errs.pw = "Must be at least 8 characters";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const validateStep3 = () => {
    let errs: any = {};
    if (!collegeId) errs.college = "Please select your campus";
    if (!religionId) errs.community = "Please join a community";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  }

  /* ---------------- Submit ---------------- */
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

      // Save avatar to AsyncStorage for post-login upload
      if (avatarUri) {
        await AsyncStorage.setItem(`pending_avatar_${body.email}`, avatarUri);
      }

      router.replace({
        pathname: "/verify-email",
        params: { email: body.email, message: data.message },
      });

    } catch (err: any) {
      const e = err?.response?.data?.error;
      if (typeof e === 'object') {
        const firstVal = Object.values(e)[0];
        setServerError(String(firstVal));
      } else {
        setServerError(e || "Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Render Steps ---------------- */

  // Step 1: Identity
  const renderIdentity = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <TouchableOpacity onPress={pickImage} style={{ marginBottom: 12 }}>
          <View style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: isDark ? '#27272A' : '#F3F4F6',
            borderWidth: 2, borderColor: avatarUri ? colors.primary : colors.border,
            justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
          }}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Ionicons name="camera" size={40} color={colors.textMuted} />
            )}
          </View>
          <View style={{
            position: 'absolute', bottom: 0, right: 0,
            backgroundColor: colors.primary, width: 36, height: 36,
            borderRadius: 18, justifyContent: 'center', alignItems: 'center',
            borderWidth: 3, borderColor: colors.background
          }}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 24, color: colors.text }}>Who are you?</Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>Let's put a face to the name.</Text>
      </View>

      <InputField
        label="Full Name"
        placeholder="Jane Doe"
        value={name}
        onChangeText={setName}
        icon="person-outline"
        error={errors.name}
        isDark={isDark}
        colors={colors}
      />
      <WizardButton label="Next Step" onPress={nextStep} primaryColor={colors.primary} />
    </Animated.View>
  );

  // Step 2: Credentials
  const renderCredentials = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={{ flex: 1 }}>
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 24, color: colors.text, marginBottom: 8 }}>Secure your account</Text>
        <Text style={{ color: colors.textMuted }}>Use your .edu email if you have one.</Text>
      </View>

      <InputField
        label="Email Address"
        placeholder="student@college.edu"
        value={email}
        onChangeText={setEmail}
        icon="mail-outline"
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        isDark={isDark}
        colors={colors}
      />

      <InputField
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
        colors={colors}
      />

      <WizardButton label="Next Step" onPress={nextStep} primaryColor={colors.primary} />
    </Animated.View>
  );

  // Step 3: Community
  const renderCommunity = () => {
    return (
      <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={{ flex: 1 }}>
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 24, color: colors.text, marginBottom: 8 }}>Find your tribe</Text>
          <Text style={{ color: colors.textMuted }}>Connect with your campus community.</Text>
        </View>

        {/* College Picker */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>
            {collegeId ? 'Your Campus' : 'Select Campus'}
          </Text>

          {collegeId ? (
            <Animated.View entering={FadeInRight} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                flex: 1, paddingVertical: 12, paddingHorizontal: 16,
                backgroundColor: colors.primary, borderRadius: 12,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <Text style={{ color: '#fff', fontFamily: Fonts.bold, fontSize: 16 }}>
                  {colleges.find(c => c._id === collegeId)?.name}
                </Text>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <TouchableOpacity
                onPress={() => { setCollegeId(""); setReligionId(""); }}
                style={{ marginLeft: 12, padding: 8 }}
              >
                <Text style={{ color: colors.textMuted, fontFamily: Fonts.sans, fontSize: 14 }}>Change</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {loadingLists ? <ActivityIndicator /> : colleges.map(c => (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => { setCollegeId(c._id); setReligionId(""); }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <Text style={{ color: colors.text, fontFamily: Fonts.sans }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {errors.college && <Text style={{ color: colors.danger, marginBottom: 20 }}>{errors.college}</Text>}

        {/* Community Picker */}
        {collegeId && (
          <Animated.View entering={FadeInRight}>
            <Text style={{ fontSize: 13, fontFamily: Fonts.bold, color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>Select Community</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {filteredCommunities.length > 0 ? filteredCommunities.map(r => (
                <TouchableOpacity
                  key={r._id}
                  onPress={() => setReligionId(r._id)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: religionId === r._id ? colors.primary : (isDark ? '#27272A' : '#F3F4F6'),
                    borderWidth: 1,
                    borderColor: religionId === r._id ? colors.primary : colors.border
                  }}
                >
                  <Text style={{ color: religionId === r._id ? '#fff' : colors.text, fontFamily: Fonts.sans }}>{r.name}</Text>
                </TouchableOpacity>
              )) : (
                <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No communities found for this campus.</Text>
              )}
            </View>
          </Animated.View>
        )}
        {errors.community && <Text style={{ color: colors.danger, marginTop: 8 }}>{errors.community}</Text>}

        {serverError && (
          <View style={{ marginTop: 20, padding: 12, backgroundColor: isDark ? '#450a0a' : '#fee2e2', borderRadius: 8 }}>
            <Text style={{ color: colors.danger }}>{serverError}</Text>
          </View>
        )}

        <WizardButton
          label="Join Campustry"
          onPress={handleRegister}
          primaryColor={colors.primary}
          loading={submitting}
          icon="rocket"
        />
      </Animated.View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={prevStep} style={{ padding: 8, marginLeft: -8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <StepIndicator currentStep={step} totalSteps={totalSteps} color={colors.primary} />

        {/* Steps */}
        {step === 1 && renderIdentity()}
        {step === 2 && renderCredentials()}
        {step === 3 && renderCommunity()}

      </ScrollView>
    </View>
  );
}
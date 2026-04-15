import React, { useState, useContext, useCallback } from 'react';
import { Linking } from 'react-native';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    TextInput,
    Image,
    FlatList,
    Modal,
    StatusBar,
    Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/api';
import { AuthContext } from '@/src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── TYPES ────────────────────────────────────────────────────────────────────
type FormData = {
    firstName: string;
    gender: string;
    birthDate: {
        day: string;
        month: string;
        year: string;
    };
    major: string;
    year: string;
    bio: string;
    hobbies: string[];
    photos: string[]; // local uris
    instagramHandle: string;
    height: string;
};

// ToS version — bump this string whenever terms change; stored server-side with consent
const TOS_VERSION = '2025-04-15';

const STEPS = [
    'Agreement',   // Step 0 — legal gate
    'Welcome',
    'The Basics',
    'Your Vibe',
    'Photos',
    'Review'
];

const PREDEFINED_HOBBIES = [
    "Gym", "Coffee", "Hiking", "Anime", "Gaming", "Study",
    "Music", "Art", "Travel", "Foodie", "Nightlife", "Sports",
    "Reading", "Movies", "Photography", "Fashion", "Cooking", "Dancing"
];

const STUDY_YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student", "Alumni"];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const { user } = useContext(AuthContext) as any;
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const insets = useSafeAreaInsets();

    // ── Legal Consent State ────────────────────────────────────────────────────
    const [agreedAge, setAgreedAge] = useState(false);
    const [agreedTos, setAgreedTos] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const allConsentsGiven = agreedAge && agreedTos && agreedPrivacy;

    // Form State
    const [formData, setFormData] = useState<FormData>({
        firstName: user?.fullName?.split(' ')[0] || '',
        gender: '',
        birthDate: { day: '', month: '', year: '' },
        major: '',
        year: '',
        bio: '',
        hobbies: [],
        photos: [],
        instagramHandle: '',
        height: ''
    });

    // ── Log consent to backend before proceeding from Agreement step ──────────
    const logConsent = useCallback(async () => {
        try {
            await api.post('/api/dating/consent', {
                tosVersion: TOS_VERSION,
                agreedAt: new Date().toISOString(),
                platform: Platform.OS,
            });
        } catch (e) {
            // Non-blocking: consent is already tracked client-side via state.
            // Backend should also validate presence of consent on profile creation.
            console.warn('[Dating] consent log failed:', e);
        }
    }, []);

    const nextStep = async () => {
        // ── Step 0: Legal Agreement Gate ──────────────────────────────────────
        if (step === 0) {
            if (!allConsentsGiven) {
                return Alert.alert(
                    'Agreement Required',
                    'You must confirm your age and agree to our Terms of Service and Privacy Policy to continue.'
                );
            }
            await logConsent();
            setStep(1);
            return;
        }

        // ── Step 2: Basics ────────────────────────────────────────────────────
        if (step === 2) {
            if (!formData.firstName.trim()) return Alert.alert('Required', 'Please enter your first name.');
            if (!formData.gender) return Alert.alert('Required', 'Please select your gender.');

            const { day, month, year } = formData.birthDate;
            if (!day || !month || !year || year.length < 4) {
                return Alert.alert('Required', 'Please enter your complete date of birth.');
            }

            // ── Accurate age check using real calendar date ────────────────
            const dayN = parseInt(day, 10);
            const monthN = parseInt(month, 10) - 1; // JS months are 0-indexed
            const yearN = parseInt(year, 10);
            const birthDate = new Date(yearN, monthN, dayN);
            const today = new Date();

            // Validate that the parsed date is a real date
            if (
                birthDate.getFullYear() !== yearN ||
                birthDate.getMonth() !== monthN ||
                birthDate.getDate() !== dayN
            ) {
                return Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
            }

            let age = today.getFullYear() - yearN;
            if (
                today.getMonth() < monthN ||
                (today.getMonth() === monthN && today.getDate() < dayN)
            ) {
                age -= 1; // Birthday hasn't occurred yet this year
            }

            if (yearN < 1900 || yearN > today.getFullYear()) {
                return Alert.alert('Invalid Date', 'Please enter a valid birth year.');
            }

            if (age < 18) {
                return Alert.alert(
                    'Age Restriction',
                    'You must be 18 years of age or older to use Campustry Dating. This is strictly enforced.'
                );
            }

            if (!formData.major.trim() || !formData.year) {
                return Alert.alert('Required', 'Please tell us your major and year.');
            }
        }

        // ── Step 3: Vibe (Bio) ────────────────────────────────────────────────
        if (step === 3) {
            if (!formData.bio.trim()) return Alert.alert('Required', 'Please write a short bio.');
        }

        // ── Step 4: Photos ────────────────────────────────────────────────────
        if (step === 4) {
            if (formData.photos.length < 2) return Alert.alert('Required', 'Please add at least 2 photos.');
        }

        if (step < STEPS.length - 1) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    const pickImage = async () => {
        // Permission
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission to access camera roll is required!");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: false,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            // Store URI for preview, but we might need to store base64 for upload?
            // Actually, let's just store the URI in state, but we need the base64 for upload.
            // Problem: formData.photos is string[]. Changing it to object might break things.
            // Solution: We will stick to URI in state, but when uploading, we need base64. 
            // Since ImagePicker returns base64 NOW, we can hack it: 
            // append base64 data to the URI string or store it separately? 
            // Better: Let's read the file as base64 during upload if use `FileSystem`? 
            // OR: Just upload immediately? No that blocks UI.

            // Simplest: `result.assets[0].base64` is available now.
            // Let's attach the base64 to a sophisticated object or temp storage.
            // But refactoring State `photos: string[]` to `photos: PhotoObj[]` is risky.

            // Hack: Store base64 in a parallel map or just re-read it? 
            // Re-reading needs `expo-file-system`.

            // ALTERNATIVE: Pass base64 instantly to a "pre-upload" state? No.

            // Let's modify state to hold an object if possible? 
            // Check usage: `renderPhotos` uses `uri`.
            // Let's stick to URI in state, but we attach the base64 to it? 
            // `uri` is a string.

            // OK, let's use `FileSystem.readAsStringAsync` in `uploadPhoto`? 
            // Or change `photos` state to `{ uri: string, base64?: string }[]`.
            // Let's try changing the type definition of FormData slightly or just cast it.

            // WAIT - I can just attach it to the component instance (ref) if I don't want to change state types?
            // Or just change state. `photos: {uri, base64}[]`. 
            // Let's check `FormData` type definition in this file.

            // Type FormData on line 22 defined photos: string[].
            // I should update that type definition first to be safe.

            // Actually, let's just return the base64 string from `pickImage`? 
            // No, `pickImage` is void.

            // LET'S DO THIS: 
            // Update `pickImage` to NOT set state immediately but return the asset?
            // No, `pickImage` is triggered by UI.

            // Plan B: Update `FormData` type to allow photos to receive objects? 
            // Or simpler:
            // Use `data:image/jpeg;base64,...` string as the "URI" in the state?
            // The `Image` component supports data URIs!
            // `param uri`: `data:image/jpeg;base64,${base64}`.
            // This is perfect! It works for Image source AND gives us the data for upload.

            if (asset.base64) {
                const dataUri = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
                if (formData.photos.length >= 6) return Alert.alert("Max 6 photos allowed");
                setFormData(prev => ({ ...prev, photos: [...prev.photos, dataUri] }));
            }
        }
    };

    const removePhoto = (index: number) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const uploadPhoto = async (dataUri: string) => {
        // If already remote (http), return as is
        if (dataUri.startsWith('http')) return dataUri;

        // If it's a data URI (base64)
        if (dataUri.startsWith('data:')) {
            console.log("Uploading base64 photo...");
            const base64Data = dataUri.split(',')[1];

            // Uses new backend route that leverages ImageKit (same as Avatar)
            const { data } = await api.post('/api/upload/base64', {
                image: base64Data,
                fileName: `dating_photo_${Date.now()}.jpg`,
                folder: "community_talk_dating"
            });
            return data.url;
        }

        // Fallback for file:// URIs using the old fetch method if needed, 
        // but we are converting everything to base64 data URIs now.
        return dataUri;
    };

    const handleSubmit = async () => {
        // Guard: consent must have been given at step 0 before we ever reach here.
        // This is a client-side safety net; backend also enforces via tosVersion field.
        if (!allConsentsGiven) {
            Alert.alert('Error', 'Agreement step was not completed. Please restart.');
            setStep(0);
            return;
        }

        try {
            setLoading(true);

            // 1. Upload Photos Sequentially
            const uploadedUrls: string[] = [];
            for (const photoUri of formData.photos) {
                const url = await uploadPhoto(photoUri);
                uploadedUrls.push(url);
            }

            // 2. Construct ISO Date
            const isoDate = `${formData.birthDate.year}-${formData.birthDate.month.padStart(2, '0')}-${formData.birthDate.day.padStart(2, '0')}T00:00:00.000Z`;

            const genderMap: Record<string, string> = {
                'Male': 'MALE',
                'Female': 'FEMALE',
                'Non-binary': 'NON_BINARY',
            };
            const yearMap: Record<string, string> = {
                'Freshman': 'FRESHMAN',
                'Sophomore': 'SOPHOMORE',
                'Junior': 'JUNIOR',
                'Senior': 'SENIOR',
                'Grad Student': 'GRADUATE',
                'Alumni': 'ALUMNI',
            };

            const payload = {
                firstName: formData.firstName.trim(),
                gender: genderMap[formData.gender] || 'OTHER',
                birthDate: isoDate,
                major: formData.major.trim(),
                year: yearMap[formData.year] || 'OTHER',
                bio: formData.bio.trim(),
                hobbies: formData.hobbies,
                instagramHandle: formData.instagramHandle.trim() || null,
                height: formData.height ? parseInt(formData.height, 10) : null,
                photos: uploadedUrls,
                // Consent metadata sent with every profile creation request
                tosVersion: TOS_VERSION,
                tosAgreedAt: new Date().toISOString(),
            };

            await api.post('/api/dating/profile', payload);

            Alert.alert(
                'Welcome to Campustry Dating! 🎉',
                'Your profile is under review. You can start swiping while your photos are approved.',
                [{ text: 'OK', onPress: () => onComplete() }]
            );
        } catch (err: any) {
            console.error('Profile creation error:', err);
            Alert.alert('Error', err.response?.data?.error || 'Failed to create profile. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    // ── RENDERERS ──────────────────────────────────────────────────────────────

    // Step 0 — Legal Agreement (required gate before any profile data is entered)
    const renderAgreement = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="shield-checkmark" size={60} color="#EF4444" />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Before You Continue</Text>
            <Text style={[styles.text, { color: theme.textMuted }]}>
                Campustry Dating is an adults-only feature. You must confirm the following before creating a profile.
            </Text>

            {/* Age Confirmation */}
            <TouchableOpacity
                style={[styles.consentRow, { backgroundColor: theme.surface, borderColor: agreedAge ? theme.primary : theme.border }]}
                onPress={() => setAgreedAge(!agreedAge)}
                activeOpacity={0.8}
            >
                <View style={[styles.checkbox, { backgroundColor: agreedAge ? theme.primary : 'transparent', borderColor: agreedAge ? theme.primary : theme.textMuted }]}>
                    {agreedAge && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.consentText, { color: theme.text }]}>
                    I confirm that I am <Text style={{ fontFamily: Fonts.bold }}>18 years of age or older.</Text> I understand that misrepresenting my age will result in a permanent ban and may have legal consequences.
                </Text>
            </TouchableOpacity>

            {/* Terms of Service */}
            <TouchableOpacity
                style={[styles.consentRow, { backgroundColor: theme.surface, borderColor: agreedTos ? theme.primary : theme.border }]}
                onPress={() => setAgreedTos(!agreedTos)}
                activeOpacity={0.8}
            >
                <View style={[styles.checkbox, { backgroundColor: agreedTos ? theme.primary : 'transparent', borderColor: agreedTos ? theme.primary : theme.textMuted }]}>
                    {agreedTos && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.consentText, { color: theme.text }]}>
                    I agree to Campustry's{' '}
                    <Text style={{ color: theme.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://campustry.com/terms')}>
                        Terms of Service
                    </Text>
                    {', including the Community Guidelines and Safety Policies.  '}
                </Text>
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity
                style={[styles.consentRow, { backgroundColor: theme.surface, borderColor: agreedPrivacy ? theme.primary : theme.border }]}
                onPress={() => setAgreedPrivacy(!agreedPrivacy)}
                activeOpacity={0.8}
            >
                <View style={[styles.checkbox, { backgroundColor: agreedPrivacy ? theme.primary : 'transparent', borderColor: agreedPrivacy ? theme.primary : theme.textMuted }]}>
                    {agreedPrivacy && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.consentText, { color: theme.text }]}>
                    I have read and agree to Campustry's{' '}
                    <Text style={{ color: theme.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://campustry.com/privacy')}>
                        Privacy Policy
                    </Text>
                    {', including how my location, photos, and profile data are used.  '}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.primaryButton,
                    { backgroundColor: allConsentsGiven ? theme.primary : theme.muted, marginTop: 8 }
                ]}
                onPress={nextStep}
                disabled={!allConsentsGiven}
                activeOpacity={0.8}
            >
                <Text style={[styles.primaryButtonText, { color: allConsentsGiven ? '#FFF' : theme.textMuted }]}>
                    {allConsentsGiven ? 'I Agree — Continue' : 'Please check all boxes above'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Step 1 — Welcome / What to expect
    const renderIntro = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="shield-checkmark" size={60} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Verified & Exclusive</Text>
            <Text style={[styles.text, { color: theme.textMuted }]}>
                Campustry Dating is exclusively for verified CUNY students.
            </Text>
            <View style={[styles.bulletList, { backgroundColor: theme.surface }]}>
                <Text style={[styles.bullet, { color: theme.text }]}>• Real Names Only</Text>
                <Text style={[styles.bullet, { color: theme.text }]}>• Verified .edu Emails</Text>
                <Text style={[styles.bullet, { color: theme.text }]}>• Zero Tolerance for Fake Profiles</Text>
                <Text style={[styles.bullet, { color: theme.text }]}>• Respect Boundaries & Consent</Text>
                <Text style={[styles.bullet, { color: theme.text }]}>• Report anything suspicious immediately</Text>
            </View>
        </View>
    );

    const renderBasics = () => (
        <View style={styles.formContainer}>
            <Text style={[styles.label, { color: theme.text }]}>First Name</Text>
            <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.firstName}
                onChangeText={t => setFormData({ ...formData, firstName: t })}
                placeholder="Your Name"
                placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.text }]}>Gender</Text>
            <View style={styles.chipRow}>
                {['Male', 'Female', 'Non-binary'].map(g => (
                    <TouchableOpacity
                        key={g}
                        style={[
                            styles.chip,
                            { backgroundColor: theme.muted, borderColor: 'transparent' },
                            formData.gender === g && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                        ]}
                        onPress={() => setFormData({ ...formData, gender: g })}
                    >
                        <Text style={[
                            styles.chipText,
                            { color: theme.textMuted },
                            formData.gender === g && { color: theme.primary }
                        ]}>{g}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Date of Birth</Text>
            <View style={styles.dateRow}>
                <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder="MM"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    maxLength={2}
                    value={formData.birthDate.month}
                    onChangeText={t => setFormData({ ...formData, birthDate: { ...formData.birthDate, month: t } })}
                />
                <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder="DD"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    maxLength={2}
                    value={formData.birthDate.day}
                    onChangeText={t => setFormData({ ...formData, birthDate: { ...formData.birthDate, day: t } })}
                />
                <TextInput
                    style={[styles.input, { flex: 2, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder="YYYY"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    maxLength={4}
                    value={formData.birthDate.year}
                    onChangeText={t => setFormData({ ...formData, birthDate: { ...formData.birthDate, year: t } })}
                />
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Major</Text>
            <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.major}
                onChangeText={t => setFormData({ ...formData, major: t })}
                placeholder="e.g. Computer Science"
                placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.label, { color: theme.text }]}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {STUDY_YEARS.map(y => (
                    <TouchableOpacity
                        key={y}
                        style={[
                            styles.chip,
                            { backgroundColor: theme.muted, borderColor: 'transparent' },
                            formData.year === y && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                        ]}
                        onPress={() => setFormData({ ...formData, year: y })}
                    >
                        <Text style={[
                            styles.chipText,
                            { color: theme.textMuted },
                            formData.year === y && { color: theme.primary }
                        ]}>{y}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderVibe = () => (
        <View style={styles.formContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Bio</Text>
            <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top', backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.bio}
                onChangeText={t => setFormData({ ...formData, bio: t })}
                placeholder="Tell us about yourself..."
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={500}
            />
            <Text style={[styles.hint, { color: theme.textMuted }]}>{formData.bio.length}/500</Text>

            <Text style={[styles.label, { color: theme.text }]}>Height (cm) (Optional)</Text>
            <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.height}
                onChangeText={t => setFormData({ ...formData, height: t })}
                placeholder="e.g. 175"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
            />

            <Text style={[styles.label, { color: theme.text }]}>Hobbies / Interests (Pick up to 5)</Text>
            <View style={styles.chipRowWrap}>
                {PREDEFINED_HOBBIES.map(h => {
                    const selected = formData.hobbies.includes(h);
                    return (
                        <TouchableOpacity
                            key={h}
                            style={[
                                styles.chip,
                                { backgroundColor: theme.muted, borderColor: 'transparent' },
                                selected && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                            ]}
                            onPress={() => {
                                const newHobbies = selected
                                    ? formData.hobbies.filter(i => i !== h)
                                    : formData.hobbies.length < 5 ? [...formData.hobbies, h] : formData.hobbies;
                                setFormData({ ...formData, hobbies: newHobbies });
                            }}
                        >
                            <Text style={[
                                styles.chipText,
                                { color: theme.textMuted },
                                selected && { color: theme.primary }
                            ]}>{h}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Instagram — disclosed as optional + shown on profile */}
            <Text style={[styles.label, { color: theme.text }]}>Instagram Handle{' '}
                <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: theme.textMuted }}>(Optional)</Text>
            </Text>
            <Text style={[styles.hint, { color: theme.textMuted, marginTop: -6, marginBottom: 8 }]}>
                If provided, this will be visible on your public dating profile.
            </Text>
            <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formData.instagramHandle}
                onChangeText={t => setFormData({ ...formData, instagramHandle: t.replace('@', '') })}
                placeholder="yourhandle  (without @)"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
            />
        </View>
    );

    const renderPhotos = () => (
        <View style={styles.formContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Add Photos (Min 2)</Text>
            <Text style={[styles.text, { color: theme.textMuted, textAlign: 'left', marginBottom: 4 }]}>First photo is your main profile picture.</Text>

            <View style={styles.photoGrid}>
                {formData.photos.map((uri, idx) => (
                    <View key={idx} style={[styles.photoSlot, { 
                        backgroundColor: theme.muted,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                        elevation: 4,
                    }]}>
                        <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
                        <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(idx)}>
                            <Ionicons name="close-circle" size={22} color="#FF3B30" />
                        </TouchableOpacity>
                        {idx === 0 && (
                            <View style={[styles.mainBadge, { backgroundColor: theme.primary }]}>
                                <Text style={styles.mainBadgeText}>MAIN</Text>
                            </View>
                        )}
                    </View>
                ))}

                {formData.photos.length < 6 && (
                    <TouchableOpacity 
                        style={[styles.addPhotoSlot, { backgroundColor: theme.surface, borderColor: theme.primary + '40' }]} 
                        onPress={pickImage}
                        activeOpacity={0.7}
                    >
                        <View style={{ 
                            width: 44, height: 44, borderRadius: 22, 
                            backgroundColor: theme.primary + '15', 
                            alignItems: 'center', justifyContent: 'center', 
                            marginBottom: 6 
                        }}>
                            <Ionicons name="camera" size={22} color={theme.primary} />
                        </View>
                        <Text style={{ fontSize: 12, color: theme.textMuted, fontFamily: Fonts.bold }}>Add Photo</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderReview = () => (
        <View style={styles.stepContainer}>
            <Image source={{ uri: formData.photos[0] }} style={{ width: 150, height: 200, borderRadius: 12, marginBottom: 20 }} />
            <Text style={[styles.title, { color: theme.text }]}>{formData.firstName}, {new Date().getFullYear() - parseInt(formData.birthDate.year)}</Text>
            <Text style={[styles.text, { color: theme.textMuted }]}>{formData.major} • {formData.year}</Text>
            <Text style={[styles.text, { fontStyle: 'italic', marginTop: 10, color: theme.textMuted }]}>&quot;{formData.bio}&quot;</Text>

            <View style={{ height: 20 }} />
            <Text style={[styles.label, { color: theme.text }]}>Ready to join the pool?</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>You can edit your profile later.</Text>
        </View>
    );

    const renderStepContent = () => {
        switch (step) {
            case 0: return renderAgreement();
            case 1: return renderIntro();
            case 2: return renderBasics();
            case 3: return renderVibe();
            case 4: return renderPhotos();
            case 5: return renderReview();
            default: return null;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar 
                backgroundColor={theme.background} 
                barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
                translucent={false}
            />
            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, 12) : 8 }]}>
                {step > 0 && (
                    <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                )}
                <Text style={[styles.stepTitle, { color: theme.text }]}>{STEPS[step]}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.progressBar}>
                {STEPS.map((_, i) => (
                    <View key={i} style={[styles.progressDot, { backgroundColor: i <= step ? theme.primary : theme.muted }]} />
                ))}
            </View>

            <ScrollView 
                contentContainerStyle={[styles.content, { paddingBottom: 120 }]} 
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                decelerationRate="fast"
                keyboardShouldPersistTaps="handled"
                overScrollMode="never"
            >
                {renderStepContent()}
            </ScrollView>

            {step > 0 && (
                <View style={[styles.footer, { borderTopColor: theme.border }]}>
                    {step === STEPS.length - 1 ? (
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Create Profile</Text>}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                            onPress={nextStep}
                        >
                            <Text style={styles.primaryButtonText}>Next</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    backButton: {
        padding: 8,
    },
    stepTitle: {
        fontSize: 18,
        fontFamily: Fonts.bold,
        color: Colors.light.text,
    },
    progressBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.muted
    },
    progressDotActive: {
        backgroundColor: Colors.light.primary
    },
    content: {
        padding: 24,
        flexGrow: 1,
    },
    footer: {
        padding: 24,
        paddingBottom: 100, // Extra padding for TabBar/FAB
        borderTopWidth: 1,
        borderTopColor: Colors.light.border
    },
    stepContainer: {
        alignItems: 'center',
        gap: 20
    },
    formContainer: {
        gap: 20
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.light.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    title: {
        fontSize: 24,
        fontFamily: Fonts.bold,
        textAlign: 'center',
        color: Colors.light.text,
    },
    text: {
        fontSize: 16,
        textAlign: 'center',
        color: Colors.light.textMuted,
        lineHeight: 24,
        fontFamily: Fonts.regular
    },
    bulletList: {
        alignSelf: 'stretch',
        backgroundColor: Colors.light.surface,
        padding: 20,
        borderRadius: 16,
        marginTop: 10
    },
    bullet: {
        fontSize: 16,
        fontFamily: Fonts.bold,
        marginBottom: 8,
        color: Colors.light.text
    },
    label: {
        fontSize: 16,
        fontFamily: Fonts.bold,
        color: Colors.light.text,
        marginBottom: 4
    },
    hint: {
        fontSize: 12,
        color: Colors.light.textMuted,
        marginTop: -10,
        textAlign: 'right',
        fontFamily: Fonts.regular
    },
    input: {
        backgroundColor: Colors.light.surface,
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        color: Colors.light.text,
        fontFamily: Fonts.regular
    },
    chipRow: {
        flexDirection: 'row',
        gap: 10
    },
    chipRowWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: Colors.light.muted,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    chipActive: {
        backgroundColor: Colors.light.primary + '20',
        borderColor: Colors.light.primary
    },
    chipText: {
        fontFamily: Fonts.bold,
        color: Colors.light.textMuted
    },
    chipTextActive: {
        color: Colors.light.primary
    },
    dateRow: {
        flexDirection: 'row',
        gap: 10
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10
    },
    photoSlot: {
        width: '30%',
        aspectRatio: 3 / 4,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: Colors.light.muted
    },
    addPhotoSlot: {
        width: '30%',
        aspectRatio: 3 / 4,
        borderRadius: 10,
        backgroundColor: Colors.light.surface,
        borderWidth: 2,
        borderColor: Colors.light.border,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center'
    },
    photoImage: {
        width: '100%',
        height: '100%'
    },
    removeButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    mainBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.light.primary,
        paddingVertical: 4,
        alignItems: 'center'
    },
    mainBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontFamily: Fonts.bold
    },
    primaryButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        alignSelf: 'stretch'
    },
    primaryButtonText: {
        color: '#FFF',
        fontFamily: Fonts.bold,
        fontSize: 16
    },
    consentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        gap: 12,
        alignSelf: 'stretch',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
    },
    consentText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontFamily: Fonts.regular,
    },
});

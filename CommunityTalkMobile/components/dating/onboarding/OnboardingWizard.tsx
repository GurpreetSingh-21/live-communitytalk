import React, { useState, useContext, useCallback, useMemo } from 'react';
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
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/api';
import { AuthContext } from '@/src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type FormData = {
    // Basics
    firstName: string;
    gender: string;
    birthDate: { day: string; month: string; year: string };
    height: string;
    // Campus
    major: string;
    year: string;
    gradYear: string;
    livingArrangement: string;
    campusActivities: string[];
    studyStyle: string;
    // Lifestyle
    lookingFor: string;
    loveLanguage: string;
    physicallyActive: string;
    drinking: string;
    smoking: string;
    diet: string;
    religion: string;
    hometown: string;
    // Vibe
    headline: string;
    bio: string;
    hobbies: string[];
    instagramHandle: string;
    // Prompts
    prompts: { question: string; answer: string }[];
    // Photos
    photos: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TOS_VERSION = '2025-04-15';

const STEPS = [
    'Agreement',     // 0
    'Welcome',       // 1
    'The Basics',    // 2
    'Campus Life',   // 3
    'Lifestyle',     // 4
    'Your Vibe',     // 5
    'Prompts',       // 6
    'Photos',        // 7
    'Review',        // 8
];

const HOBBIES = [
    "Gym", "Coffee", "Hiking", "Anime", "Gaming", "Study", "Music", "Art",
    "Travel", "Foodie", "Nightlife", "Sports", "Reading", "Movies",
    "Photography", "Fashion", "Cooking", "Dancing", "Thrifting", "Yoga",
    "Running", "Swimming", "Cycling", "Chess", "Volunteering", "Coding",
];

const STUDY_YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student", "Alumni"];

const LOOKING_FOR_OPTIONS = [
    { key: 'RELATIONSHIP', label: '❤️  Relationship', sub: 'Looking for something serious' },
    { key: 'CASUAL', label: '✨  Casual Dating', sub: 'Exploring and seeing what happens' },
    { key: 'FRIENDS', label: '🤝  Friends First', sub: 'Build a connection first' },
    { key: 'UNSURE', label: '🤷  Not Sure Yet', sub: 'Open to anything' },
];

const LOVE_LANGUAGES = ['Words of Affirmation', 'Acts of Service', 'Receiving Gifts', 'Quality Time', 'Physical Touch'];
const PHYSICALLY_ACTIVE = ['Not active', 'Sometimes active', 'Moderately active', 'Very active', 'Fitness fanatic'];
const DRINKING_OPTIONS = ['No', 'Occasionally', 'Socially', 'Yes'];
const SMOKING_OPTIONS = ['No', 'Occasionally', 'Yes'];
const DIET_OPTIONS = ['Everything', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free'];
const RELIGION_OPTIONS = ['Agnostic', 'Atheist', 'Buddhist', 'Christian', 'Hindu', 'Jewish', 'Muslim', 'Sikh', 'Spiritual', 'Other', 'Prefer not to say'];
const LIVING_OPTIONS = ['Dorm / Residence Hall', 'Off-campus apartment', 'Commuter (live at home)', 'Greek house / Sorority/Fraternity'];
const STUDY_STYLES = ['Night owl 🦉', 'Early bird 🌅', 'Library person 📚', 'Café worker ☕', 'Wherever-I-can 🏃'];
const CAMPUS_ACTIVITIES_OPTIONS = [
    'Student Government', 'Sports Team', 'Debate Club', 'Music/Band', 'Theater/Drama',
    'Cultural Club', 'Pre-Med Society', 'Engineering Club', 'Business Club',
    'Greek Life', 'Volunteer/Community Service', 'Research', 'ROTC', 'Other',
];

const PROFILE_PROMPTS = [
    'My go-to campus spot is…',
    'You'll catch me on campus…',
    'The best thing about my major is…',
    'My ideal campus date would be…',
    'I procrastinate by…',
    'On weekends, I usually…',
    'A fun fact about me is…',
    'My love language is…',
    'Together, we could…',
    'I'm looking for someone who…',
    'The way to my heart is…',
    'I get way too excited about…',
    'My most controversial opinion is…',
    'Two truths and a lie about me…',
    'After class, you'll find me…',
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE COMPLETION CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
function calcCompletion(f: FormData): number {
    let pct = 20; // name/gender/dob always present once past basics
    if (f.photos.length >= 2) pct += 20;
    if (f.bio.trim().length > 20) pct += 15;
    if (f.headline.trim().length > 0) pct += 10;
    if (f.lookingFor || f.loveLanguage || f.drinking) pct += 15;
    if (f.hobbies.length >= 3) pct += 10;
    if (f.prompts.filter(p => p.answer.trim()).length >= 1) pct += 10;
    return Math.min(pct, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const genderMap: Record<string, string> = { Male: 'MALE', Female: 'FEMALE', 'Non-binary': 'NON_BINARY' };
const yearMap: Record<string, string> = {
    Freshman: 'FRESHMAN', Sophomore: 'SOPHOMORE', Junior: 'JUNIOR',
    Senior: 'SENIOR', 'Grad Student': 'GRADUATE', Alumni: 'ALUMNI',
};

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE CHIP
// ─────────────────────────────────────────────────────────────────────────────
function Chip({
    label, selected, onPress, theme,
}: { label: string; selected: boolean; onPress: () => void; theme: any }) {
    return (
        <TouchableOpacity
            style={[
                styles.chip,
                { backgroundColor: selected ? theme.primary + '20' : theme.muted, borderColor: selected ? theme.primary : 'transparent' }
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.chipText, { color: selected ? theme.primary : theme.textMuted }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE-SELECT ROW (like Dil Mil's "Dil Details")
// ─────────────────────────────────────────────────────────────────────────────
function SelectRow({
    icon, label, value, options, onSelect, theme,
}: {
    icon: string; label: string; value: string; options: string[];
    onSelect: (v: string) => void; theme: any;
}) {
    const [open, setOpen] = useState(false);
    return (
        <View style={{ marginBottom: 4 }}>
            <TouchableOpacity
                style={[styles.detailRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setOpen(!open)}
                activeOpacity={0.7}
            >
                <Ionicons name={icon as any} size={18} color={theme.primary} style={{ marginRight: 10 }} />
                <Text style={[styles.detailLabel, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: value ? theme.text : theme.textMuted }]}>
                    {value || 'Select'}
                </Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
            </TouchableOpacity>
            {open && (
                <View style={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.dropdownItem, value === opt && { backgroundColor: theme.primary + '15' }]}
                            onPress={() => { onSelect(opt === value ? '' : opt); setOpen(false); }}
                        >
                            <Text style={[styles.dropdownItemText, { color: value === opt ? theme.primary : theme.text }]}>{opt}</Text>
                            {value === opt && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const { user } = useContext(AuthContext) as any;
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const insets = useSafeAreaInsets();

    // Legal consent
    const [agreedAge, setAgreedAge] = useState(false);
    const [agreedTos, setAgreedTos] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const allConsentsGiven = agreedAge && agreedTos && agreedPrivacy;

    // Form state
    const [formData, setFormData] = useState<FormData>({
        firstName: user?.fullName?.split(' ')[0] || '',
        gender: '',
        birthDate: { day: '', month: '', year: '' },
        height: '',
        major: '',
        year: '',
        gradYear: '',
        livingArrangement: '',
        campusActivities: [],
        studyStyle: '',
        lookingFor: '',
        loveLanguage: '',
        physicallyActive: '',
        drinking: '',
        smoking: '',
        diet: '',
        religion: '',
        hometown: '',
        headline: '',
        bio: '',
        hobbies: [],
        instagramHandle: '',
        prompts: [
            { question: '', answer: '' },
            { question: '', answer: '' },
        ],
        photos: [],
    });

    const update = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    }, []);

    const completionPct = useMemo(() => calcCompletion(formData), [formData]);

    // ── Consent ───────────────────────────────────────────────────────────────
    const logConsent = useCallback(async () => {
        try {
            await api.post('/api/dating/consent', {
                tosVersion: TOS_VERSION,
                agreedAt: new Date().toISOString(),
                platform: Platform.OS,
            });
        } catch (e) {
            console.warn('[Dating] consent log failed:', e);
        }
    }, []);

    // ── Navigation ────────────────────────────────────────────────────────────
    const nextStep = async () => {
        if (step === 0) {
            if (!allConsentsGiven) return Alert.alert('Agreement Required', 'Please check all boxes to continue.');
            await logConsent();
            setStep(1);
            return;
        }
        if (step === 2) {
            if (!formData.firstName.trim()) return Alert.alert('Required', 'Please enter your first name.');
            if (!formData.gender) return Alert.alert('Required', 'Please select your gender.');
            const { day, month, year } = formData.birthDate;
            if (!day || !month || !year || year.length < 4) return Alert.alert('Required', 'Please enter your complete date of birth.');
            const dayN = parseInt(day, 10), monthN = parseInt(month, 10) - 1, yearN = parseInt(year, 10);
            const birthDate = new Date(yearN, monthN, dayN);
            const today = new Date();
            if (birthDate.getFullYear() !== yearN || birthDate.getMonth() !== monthN || birthDate.getDate() !== dayN)
                return Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
            let age = today.getFullYear() - yearN;
            if (today.getMonth() < monthN || (today.getMonth() === monthN && today.getDate() < dayN)) age--;
            if (yearN < 1900 || yearN > today.getFullYear()) return Alert.alert('Invalid Date', 'Please enter a valid birth year.');
            if (age < 18) return Alert.alert('Age Restriction', 'You must be 18 or older to use Campustry Dating.');
        }
        if (step === 3) {
            if (!formData.major.trim() || !formData.year) return Alert.alert('Required', 'Please enter your major and year.');
        }
        if (step === 5) {
            if (!formData.bio.trim()) return Alert.alert('Required', 'Please write a short bio.');
        }
        if (step === 7) {
            if (formData.photos.length < 2) return Alert.alert('Required', 'Please add at least 2 photos.');
        }
        if (step < STEPS.length - 1) setStep(s => s + 1);
    };

    const prevStep = () => { if (step > 0) setStep(s => s - 1); };

    // ── Photo handling ────────────────────────────────────────────────────────
    const pickImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission required', 'Please allow photo access.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images', allowsEditing: false, quality: 0.7, base64: true,
        });
        if (!result.canceled && result.assets[0]?.base64) {
            const { base64, mimeType } = result.assets[0];
            const dataUri = `data:${mimeType || 'image/jpeg'};base64,${base64}`;
            if (formData.photos.length >= 6) return Alert.alert('Max 6 photos allowed');
            update('photos', [...formData.photos, dataUri]);
        }
    };

    const removePhoto = (index: number) => {
        update('photos', formData.photos.filter((_, i) => i !== index));
    };

    const uploadPhoto = async (dataUri: string): Promise<string> => {
        if (dataUri.startsWith('http')) return dataUri;
        if (dataUri.startsWith('data:')) {
            const base64Data = dataUri.split(',')[1];
            const { data } = await api.post('/api/upload/base64', {
                image: base64Data,
                fileName: `dating_photo_${Date.now()}.jpg`,
                folder: 'community_talk_dating',
            });
            return data.url;
        }
        return dataUri;
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!allConsentsGiven) { setStep(0); return; }
        try {
            setLoading(true);
            const uploadedUrls: string[] = [];
            for (const photoUri of formData.photos) {
                uploadedUrls.push(await uploadPhoto(photoUri));
            }
            const isoDate = `${formData.birthDate.year}-${formData.birthDate.month.padStart(2, '0')}-${formData.birthDate.day.padStart(2, '0')}T00:00:00.000Z`;
            const validPrompts = formData.prompts.filter(p => p.question && p.answer.trim());

            const payload = {
                firstName: formData.firstName.trim(),
                gender: genderMap[formData.gender] || 'OTHER',
                birthDate: isoDate,
                height: formData.height ? parseInt(formData.height, 10) : null,
                major: formData.major.trim(),
                year: yearMap[formData.year] || 'OTHER',
                gradYear: formData.gradYear || null,
                livingArrangement: formData.livingArrangement || null,
                campusActivities: formData.campusActivities,
                studyStyle: formData.studyStyle || null,
                lookingFor: formData.lookingFor ? [formData.lookingFor] : [],
                loveLanguage: formData.loveLanguage || null,
                physicallyActive: formData.physicallyActive || null,
                drinking: formData.drinking || null,
                smoking: formData.smoking || null,
                diet: formData.diet || null,
                religion: formData.religion || null,
                hometown: formData.hometown || null,
                headline: formData.headline.trim() || null,
                bio: formData.bio.trim(),
                hobbies: formData.hobbies,
                interests: formData.hobbies,
                instagramHandle: formData.instagramHandle.trim() || null,
                prompts: validPrompts,
                photos: uploadedUrls,
                tosVersion: TOS_VERSION,
                tosAgreedAt: new Date().toISOString(),
            };

            await api.post('/api/dating/profile', payload);
            Alert.alert(
                '🎉 Profile Submitted!',
                'Your profile is under review by our team. You\'ll be notified once approved!',
                [{ text: 'Got it!', onPress: () => onComplete() }]
            );
        } catch (err: any) {
            console.error('Profile creation error:', err);
            Alert.alert('Error', err.response?.data?.error || 'Failed to create profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP RENDERERS
    // ─────────────────────────────────────────────────────────────────────────

    // Step 0 — Legal Agreement
    const renderAgreement = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="shield-checkmark" size={60} color="#EF4444" />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Before You Continue</Text>
            <Text style={[styles.text, { color: theme.textMuted }]}>
                Campustry Dating is an adults-only feature. Please confirm the following.
            </Text>
            {[
                { state: agreedAge, set: setAgreedAge, text: 'I confirm I am 18 years of age or older. Misrepresenting my age will result in a permanent ban.' },
                { state: agreedTos, set: setAgreedTos, text: 'I agree to Campustry\'s Terms of Service and Community Guidelines.', link: { label: 'Terms of Service', url: 'https://campustry.com/terms' } },
                { state: agreedPrivacy, set: setAgreedPrivacy, text: 'I have read and agree to Campustry\'s Privacy Policy.', link: { label: 'Privacy Policy', url: 'https://campustry.com/privacy' } },
            ].map((item, idx) => (
                <TouchableOpacity
                    key={idx}
                    style={[styles.consentRow, { backgroundColor: theme.surface, borderColor: item.state ? theme.primary : theme.border }]}
                    onPress={() => item.set(!item.state)}
                    activeOpacity={0.8}
                >
                    <View style={[styles.checkbox, { backgroundColor: item.state ? theme.primary : 'transparent', borderColor: item.state ? theme.primary : theme.textMuted }]}>
                        {item.state && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                    <Text style={[styles.consentText, { color: theme.text }]}>
                        {item.text}
                        {item.link && (
                            <Text style={{ color: theme.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(item.link!.url)}>
                                {' '}{item.link.label}
                            </Text>
                        )}
                    </Text>
                </TouchableOpacity>
            ))}
            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: allConsentsGiven ? theme.primary : theme.muted, marginTop: 8 }]}
                onPress={nextStep}
                disabled={!allConsentsGiven}
            >
                <Text style={[styles.primaryButtonText, { color: allConsentsGiven ? '#FFF' : theme.textMuted }]}>
                    {allConsentsGiven ? 'I Agree — Let\'s Go' : 'Please check all boxes'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Step 1 — Welcome
    const renderIntro = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="heart" size={60} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Welcome to Campustry Dating ❤️</Text>
            <Text style={[styles.text, { color: theme.textMuted }]}>
                The exclusive dating space for verified CUNY students.
            </Text>
            <View style={[styles.bulletList, { backgroundColor: theme.surface }]}>
                {['✅  Real Names & Verified .edu Emails', '🛡️  Every profile manually reviewed', '🚫  Zero tolerance for fake profiles', '📸  Photos reviewed for authenticity', '🔒  Your safety is our top priority'].map(b => (
                    <Text key={b} style={[styles.bullet, { color: theme.text }]}>{b}</Text>
                ))}
            </View>
            <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'center', marginTop: 4 }]}>
                Building your profile takes about 3 minutes. Let's make it count!
            </Text>
        </View>
    );

    // Step 2 — The Basics
    const renderBasics = () => (
        <View style={styles.formContainer}>
            <View>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ABOUT YOU</Text>
                <Text style={[styles.label, { color: theme.text }]}>First Name</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.firstName}
                    onChangeText={t => update('firstName', t)}
                    placeholder="Your first name"
                    placeholderTextColor={theme.textMuted}
                />
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Gender</Text>
                <View style={styles.chipRow}>
                    {['Male', 'Female', 'Non-binary'].map(g => (
                        <Chip key={g} label={g} selected={formData.gender === g} onPress={() => update('gender', g)} theme={theme} />
                    ))}
                </View>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Date of Birth</Text>
                <View style={styles.dateRow}>
                    {[
                        { placeholder: 'MM', field: 'month', len: 2, flex: 1 },
                        { placeholder: 'DD', field: 'day', len: 2, flex: 1 },
                        { placeholder: 'YYYY', field: 'year', len: 4, flex: 2 },
                    ].map(f => (
                        <TextInput
                            key={f.field}
                            style={[styles.input, { flex: f.flex, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                            placeholder={f.placeholder}
                            placeholderTextColor={theme.textMuted}
                            keyboardType="numeric"
                            maxLength={f.len}
                            value={(formData.birthDate as any)[f.field]}
                            onChangeText={t => update('birthDate', { ...formData.birthDate, [f.field]: t })}
                        />
                    ))}
                </View>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Height <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(cm, Optional)</Text></Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.height}
                    onChangeText={t => update('height', t)}
                    placeholder="e.g. 175"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                />
            </View>
        </View>
    );

    // Step 3 — Campus Life
    const renderCampus = () => (
        <View style={styles.formContainer}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CAMPUS INFO</Text>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Major</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.major}
                    onChangeText={t => update('major', t)}
                    placeholder="e.g. Computer Science"
                    placeholderTextColor={theme.textMuted}
                />
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Year</Text>
                <View style={styles.chipRowWrap}>
                    {STUDY_YEARS.map(y => (
                        <Chip key={y} label={y} selected={formData.year === y} onPress={() => update('year', y)} theme={theme} />
                    ))}
                </View>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Grad Year <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Optional)</Text></Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.gradYear}
                    onChangeText={t => update('gradYear', t)}
                    placeholder="e.g. Class of 2027"
                    placeholderTextColor={theme.textMuted}
                />
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Where do you live?</Text>
                <View style={styles.chipRowWrap}>
                    {LIVING_OPTIONS.map(o => (
                        <Chip key={o} label={o} selected={formData.livingArrangement === o} onPress={() => update('livingArrangement', formData.livingArrangement === o ? '' : o)} theme={theme} />
                    ))}
                </View>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Study Style <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Optional)</Text></Text>
                <View style={styles.chipRowWrap}>
                    {STUDY_STYLES.map(s => (
                        <Chip key={s} label={s} selected={formData.studyStyle === s} onPress={() => update('studyStyle', formData.studyStyle === s ? '' : s)} theme={theme} />
                    ))}
                </View>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Campus Activities <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Optional, pick all that apply)</Text></Text>
                <View style={styles.chipRowWrap}>
                    {CAMPUS_ACTIVITIES_OPTIONS.map(a => {
                        const sel = formData.campusActivities.includes(a);
                        return (
                            <Chip
                                key={a}
                                label={a}
                                selected={sel}
                                onPress={() => update('campusActivities', sel ? formData.campusActivities.filter(x => x !== a) : [...formData.campusActivities, a])}
                                theme={theme}
                            />
                        );
                    })}
                </View>
            </View>
        </View>
    );

    // Step 4 — Lifestyle (Dil Mil parity "Dil Details")
    const renderLifestyle = () => (
        <View style={styles.formContainer}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ABOUT YOUR LIFESTYLE</Text>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Looking For</Text>
                {LOOKING_FOR_OPTIONS.map(opt => (
                    <TouchableOpacity
                        key={opt.key}
                        style={[styles.lookingForCard, {
                            backgroundColor: theme.surface,
                            borderColor: formData.lookingFor === opt.key ? theme.primary : theme.border,
                            borderWidth: formData.lookingFor === opt.key ? 2 : 1,
                        }]}
                        onPress={() => update('lookingFor', formData.lookingFor === opt.key ? '' : opt.key)}
                        activeOpacity={0.7}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.lookingForLabel, { color: theme.text }]}>{opt.label}</Text>
                            <Text style={[styles.lookingForSub, { color: theme.textMuted }]}>{opt.sub}</Text>
                        </View>
                        {formData.lookingFor === opt.key && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ gap: 2 }}>
                <Text style={[styles.label, { color: theme.text, marginBottom: 8 }]}>Details <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(All optional)</Text></Text>
                <SelectRow icon="heart-outline" label="Love Language" value={formData.loveLanguage} options={LOVE_LANGUAGES} onSelect={v => update('loveLanguage', v)} theme={theme} />
                <SelectRow icon="barbell-outline" label="Physically Active" value={formData.physicallyActive} options={PHYSICALLY_ACTIVE} onSelect={v => update('physicallyActive', v)} theme={theme} />
                <SelectRow icon="restaurant-outline" label="Diet" value={formData.diet} options={DIET_OPTIONS} onSelect={v => update('diet', v)} theme={theme} />
                <SelectRow icon="wine-outline" label="Drinking" value={formData.drinking} options={DRINKING_OPTIONS} onSelect={v => update('drinking', v)} theme={theme} />
                <SelectRow icon="cloud-outline" label="Smoking" value={formData.smoking} options={SMOKING_OPTIONS} onSelect={v => update('smoking', v)} theme={theme} />
                <SelectRow icon="sunny-outline" label="Religion" value={formData.religion} options={RELIGION_OPTIONS} onSelect={v => update('religion', v)} theme={theme} />
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Hometown <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Raised in)</Text></Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.hometown}
                    onChangeText={t => update('hometown', t)}
                    placeholder="e.g. Queens, NY"
                    placeholderTextColor={theme.textMuted}
                />
            </View>
        </View>
    );

    // Step 5 — Your Vibe (Bio, Headline, Hobbies, Instagram)
    const renderVibe = () => (
        <View style={styles.formContainer}>
            <View>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>YOUR VIBE</Text>
                <Text style={[styles.label, { color: theme.text }]}>Headline <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Optional)</Text></Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.headline}
                    onChangeText={t => update('headline', t)}
                    placeholder="A punchy one-liner about you…"
                    placeholderTextColor={theme.textMuted}
                    maxLength={100}
                />
                <Text style={[styles.hint, { color: theme.textMuted }]}>{formData.headline.length}/100</Text>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>About Me</Text>
                <TextInput
                    style={[styles.input, { height: 110, textAlignVertical: 'top', backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.bio}
                    onChangeText={t => update('bio', t)}
                    placeholder="Tell people who you really are…"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    maxLength={500}
                />
                <Text style={[styles.hint, { color: formData.bio.length > 430 ? theme.primary : theme.textMuted }]}>{formData.bio.length}/500</Text>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Hobbies & Interests <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Pick up to 6)</Text></Text>
                <View style={styles.chipRowWrap}>
                    {HOBBIES.map(h => {
                        const sel = formData.hobbies.includes(h);
                        return (
                            <Chip
                                key={h}
                                label={h}
                                selected={sel}
                                onPress={() => {
                                    if (sel) update('hobbies', formData.hobbies.filter(x => x !== h));
                                    else if (formData.hobbies.length < 6) update('hobbies', [...formData.hobbies, h]);
                                }}
                                theme={theme}
                            />
                        );
                    })}
                </View>
            </View>

            <View>
                <Text style={[styles.label, { color: theme.text }]}>Instagram <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Optional — visible on profile)</Text></Text>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formData.instagramHandle}
                    onChangeText={t => update('instagramHandle', t.replace('@', ''))}
                    placeholder="yourhandle  (without @)"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>
        </View>
    );

    // Step 6 — Prompts (Hinge-style)
    const renderPrompts = () => (
        <View style={styles.formContainer}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PROFILE PROMPTS</Text>
            <Text style={[styles.text, { color: theme.textMuted, textAlign: 'left', fontSize: 14 }]}>
                Prompts give matches a reason to message you. Pick 1–2 questions and write your answers.
            </Text>
            {formData.prompts.map((p, idx) => (
                <View key={idx} style={[styles.promptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.promptCardTitle, { color: theme.textMuted }]}>Prompt {idx + 1} {idx === 0 ? '' : '(Optional)'}</Text>

                    {/* Question picker */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {PROFILE_PROMPTS.map(q => (
                                <TouchableOpacity
                                    key={q}
                                    style={[styles.promptPill, {
                                        backgroundColor: p.question === q ? theme.primary : theme.muted,
                                        borderColor: p.question === q ? theme.primary : 'transparent',
                                    }]}
                                    onPress={() => {
                                        const newPrompts = [...formData.prompts];
                                        newPrompts[idx] = { question: q, answer: newPrompts[idx].answer };
                                        update('prompts', newPrompts);
                                    }}
                                >
                                    <Text style={[styles.promptPillText, { color: p.question === q ? '#FFF' : theme.textMuted }]}>{q}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {p.question ? (
                        <>
                            <Text style={[styles.promptQuestion, { color: theme.primary }]}>"{p.question}"</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: theme.muted, borderColor: 'transparent', color: theme.text, marginTop: 8 }]}
                                value={p.answer}
                                onChangeText={t => {
                                    const newPrompts = [...formData.prompts];
                                    newPrompts[idx] = { question: p.question, answer: t };
                                    update('prompts', newPrompts);
                                }}
                                placeholder="Your answer…"
                                placeholderTextColor={theme.textMuted}
                                multiline
                                maxLength={300}
                            />
                            <Text style={[styles.hint, { color: theme.textMuted }]}>{p.answer.length}/300</Text>
                        </>
                    ) : (
                        <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'left' }]}>← Scroll to pick a question</Text>
                    )}
                </View>
            ))}
        </View>
    );

    // Step 7 — Photos
    const renderPhotos = () => {
        const slots = [...formData.photos, ...Array(Math.max(0, 6 - formData.photos.length)).fill(null)];
        return (
            <View style={styles.formContainer}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>YOUR PHOTOS</Text>
                <Text style={[styles.label, { color: theme.text }]}>Add Photos <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: theme.textMuted }}>(Min 2, Max 6)</Text></Text>
                <Text style={[styles.text, { color: theme.textMuted, textAlign: 'left', fontSize: 13, marginTop: -8 }]}>
                    First photo is your main profile picture. Use clear, recent photos of your face.
                </Text>
                <View style={styles.photoGrid}>
                    {slots.map((uri, idx) => uri ? (
                        <View key={idx} style={[styles.photoSlot, { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 }]}>
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
                    ) : (
                        <TouchableOpacity key={idx} style={[styles.addPhotoSlot, { backgroundColor: theme.surface, borderColor: theme.primary + '40' }]} onPress={pickImage} activeOpacity={0.7}>
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                                <Ionicons name="camera" size={22} color={theme.primary} />
                            </View>
                            <Text style={{ fontSize: 12, color: theme.textMuted, fontFamily: Fonts.bold }}>Add Photo</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Profile completion bar */}
                <View style={[styles.completionBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={[styles.completionLabel, { color: theme.text }]}>Profile Strength</Text>
                        <Text style={[styles.completionPct, { color: theme.primary }]}>{completionPct}%</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: theme.muted }]}>
                        <View style={[styles.progressFill, { width: `${completionPct}%` as any, backgroundColor: completionPct >= 80 ? '#22c55e' : completionPct >= 50 ? theme.primary : '#f59e0b' }]} />
                    </View>
                    <Text style={[styles.hint, { textAlign: 'left', marginTop: 6, color: theme.textMuted }]}>
                        {completionPct < 50 ? 'Add more details to stand out!' : completionPct < 80 ? 'Looking good — add a headline or prompt!' : 'Great profile! You\'re ready to go 🎉'}
                    </Text>
                </View>
            </View>
        );
    };

    // Step 8 — Review
    const renderReview = () => {
        const age = formData.birthDate.year ? new Date().getFullYear() - parseInt(formData.birthDate.year) : null;
        return (
            <View style={styles.stepContainer}>
                {formData.photos[0] ? (
                    <Image source={{ uri: formData.photos[0] }} style={styles.reviewPhoto} resizeMode="cover" />
                ) : (
                    <View style={[styles.reviewPhoto, { backgroundColor: theme.muted, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person" size={60} color={theme.textMuted} />
                    </View>
                )}
                <Text style={[styles.title, { color: theme.text }]}>
                    {formData.firstName}{age ? `, ${age}` : ''}
                </Text>
                {formData.headline ? <Text style={[styles.reviewHeadline, { color: theme.primary }]}>"{formData.headline}"</Text> : null}
                <Text style={[styles.text, { color: theme.textMuted }]}>{formData.major} • {formData.year}</Text>
                {formData.bio ? <Text style={[styles.reviewBio, { color: theme.text, backgroundColor: theme.surface }]}>"{formData.bio}"</Text> : null}

                <View style={[styles.reviewStats, { backgroundColor: theme.surface }]}>
                    {[
                        { label: 'Photos', val: `${formData.photos.length}` },
                        { label: 'Hobbies', val: `${formData.hobbies.length}` },
                        { label: 'Prompts', val: `${formData.prompts.filter(p => p.answer.trim()).length}` },
                        { label: 'Complete', val: `${completionPct}%` },
                    ].map(s => (
                        <View key={s.label} style={styles.reviewStatItem}>
                            <Text style={[styles.reviewStatVal, { color: theme.primary }]}>{s.val}</Text>
                            <Text style={[styles.reviewStatLabel, { color: theme.textMuted }]}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={[styles.completionBar, { backgroundColor: theme.surface, borderColor: theme.border, alignSelf: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={[styles.completionLabel, { color: theme.text }]}>Profile Strength</Text>
                        <Text style={[styles.completionPct, { color: theme.primary }]}>{completionPct}%</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: theme.muted }]}>
                        <View style={[styles.progressFill, { width: `${completionPct}%` as any, backgroundColor: completionPct >= 80 ? '#22c55e' : completionPct >= 50 ? theme.primary : '#f59e0b' }]} />
                    </View>
                </View>

                <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'center', marginTop: 4 }]}>
                    Our team will review your profile. You'll be notified once approved! You can edit your profile anytime.
                </Text>
            </View>
        );
    };

    const renderStepContent = () => {
        switch (step) {
            case 0: return renderAgreement();
            case 1: return renderIntro();
            case 2: return renderBasics();
            case 3: return renderCampus();
            case 4: return renderLifestyle();
            case 5: return renderVibe();
            case 6: return renderPrompts();
            case 7: return renderPhotos();
            case 8: return renderReview();
            default: return null;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, 12) : 8 }]}>
                {step > 0 && (
                    <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                )}
                <Text style={[styles.stepTitle, { color: theme.text }]}>{STEPS[step]}</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
                <View style={[styles.progressTrack, { backgroundColor: theme.muted, height: 4 }]}>
                    <View style={[styles.progressFill, { width: `${((step) / (STEPS.length - 1)) * 100}%` as any, backgroundColor: theme.primary, height: 4 }]} />
                </View>
                <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'center', marginTop: 4 }]}>Step {step + 1} of {STEPS.length}</Text>
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: 140 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                overScrollMode="never"
            >
                {renderStepContent()}
            </ScrollView>

            {step > 0 && (
                <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
                    {step === STEPS.length - 1 ? (
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Submit Profile 🎉</Text>}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={nextStep}>
                            <Text style={styles.primaryButtonText}>Continue</Text>
                        </TouchableOpacity>
                    )}
                    {step >= 4 && step < STEPS.length - 1 && (
                        <TouchableOpacity onPress={nextStep} style={{ marginTop: 12, alignItems: 'center' }}>
                            <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'center' }]}>Skip for now</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    backButton: { padding: 8, width: 40 },
    stepTitle: { fontSize: 18, fontFamily: Fonts.bold },
    progressBarContainer: { paddingHorizontal: 24, marginBottom: 8 },
    progressTrack: { borderRadius: 4, overflow: 'hidden' },
    progressFill: { borderRadius: 4 },
    content: { padding: 24, flexGrow: 1 },
    footer: {
        padding: 24,
        paddingBottom: 36,
        borderTopWidth: 1,
    },
    stepContainer: { alignItems: 'center', gap: 18 },
    formContainer: { gap: 20 },
    iconCircle: {
        width: 120, height: 120, borderRadius: 60,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    title: { fontSize: 26, fontFamily: Fonts.bold, textAlign: 'center' },
    text: { fontSize: 15, textAlign: 'center', lineHeight: 22, fontFamily: Fonts.regular },
    bulletList: { alignSelf: 'stretch', padding: 20, borderRadius: 16, marginTop: 6, gap: 8 },
    bullet: { fontSize: 15, fontFamily: Fonts.regular, lineHeight: 22 },
    sectionLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 8 },
    label: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 8 },
    hint: { fontSize: 12, marginTop: 4, fontFamily: Fonts.regular },
    input: {
        padding: 14, borderRadius: 12, fontSize: 16,
        borderWidth: 1, fontFamily: Fonts.regular,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
        borderWidth: 1.5,
    },
    chipText: { fontFamily: Fonts.bold, fontSize: 14 },
    dateRow: { flexDirection: 'row', gap: 10 },
    detailRow: {
        flexDirection: 'row', alignItems: 'center', padding: 14,
        borderRadius: 12, borderWidth: 1, marginBottom: 6,
    },
    detailLabel: { flex: 1, fontFamily: Fonts.regular, fontSize: 15 },
    detailValue: { fontFamily: Fonts.regular, fontSize: 14, marginRight: 6 },
    dropdownContainer: { borderRadius: 12, borderWidth: 1, marginBottom: 6, overflow: 'hidden' },
    dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    dropdownItemText: { fontFamily: Fonts.regular, fontSize: 15 },
    lookingForCard: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderRadius: 14, marginBottom: 10,
    },
    lookingForLabel: { fontFamily: Fonts.bold, fontSize: 15, marginBottom: 2 },
    lookingForSub: { fontFamily: Fonts.regular, fontSize: 13 },
    promptCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 6 },
    promptCardTitle: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, marginBottom: 4 },
    promptPill: {
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1.5,
    },
    promptPillText: { fontFamily: Fonts.regular, fontSize: 13, whiteSpace: 'nowrap' } as any,
    promptQuestion: { fontFamily: Fonts.bold, fontSize: 15 },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photoSlot: { width: '30%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
    addPhotoSlot: {
        width: '30%', aspectRatio: 3 / 4, borderRadius: 12,
        borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    },
    photoImage: { width: '100%', height: '100%' },
    removeButton: {
        position: 'absolute', top: 6, right: 6,
        backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, width: 24, height: 24,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
    },
    mainBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4, alignItems: 'center' },
    mainBadgeText: { color: '#FFF', fontSize: 10, fontFamily: Fonts.bold },
    completionBar: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 8 },
    completionLabel: { fontFamily: Fonts.bold, fontSize: 14 },
    completionPct: { fontFamily: Fonts.bold, fontSize: 16 },
    reviewPhoto: { width: 160, height: 210, borderRadius: 16, marginBottom: 12 },
    reviewHeadline: { fontFamily: Fonts.bold, fontSize: 15, textAlign: 'center', fontStyle: 'italic' },
    reviewBio: {
        padding: 16, borderRadius: 14, fontFamily: Fonts.regular, fontSize: 14,
        lineHeight: 20, textAlign: 'center', maxWidth: 320, fontStyle: 'italic',
    },
    reviewStats: { flexDirection: 'row', borderRadius: 16, padding: 16, gap: 8, alignSelf: 'stretch', justifyContent: 'space-around' },
    reviewStatItem: { alignItems: 'center' },
    reviewStatVal: { fontFamily: Fonts.bold, fontSize: 22 },
    reviewStatLabel: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 2 },
    primaryButton: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    primaryButtonText: { color: '#FFF', fontFamily: Fonts.bold, fontSize: 16 },
    consentRow: {
        flexDirection: 'row', alignItems: 'flex-start', padding: 14,
        borderRadius: 14, borderWidth: 1.5, gap: 12, alignSelf: 'stretch',
    },
    checkbox: {
        width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
    },
    consentText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: Fonts.regular },
});

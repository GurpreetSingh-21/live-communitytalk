import React, { useState, useContext } from 'react';
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
    Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/api';
import { AuthContext } from '@/src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

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

const STEPS = [
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

    const nextStep = () => {
        // Validation
        if (step === 1) { // Basics
            if (!formData.firstName) return Alert.alert("Required", "Please enter your first name.");
            if (!formData.gender) return Alert.alert("Required", "Please select your gender.");
            if (!formData.birthDate.day || !formData.birthDate.month || !formData.birthDate.year) return Alert.alert("Required", "Please enter your full birth date.");
            // Basic age check
            const age = new Date().getFullYear() - parseInt(formData.birthDate.year);
            if (age < 18) return Alert.alert("Age Restriction", "You must be 18+ to use Dating.");
            if (!formData.major || !formData.year) return Alert.alert("Required", "Please tell us your major and year.");
        }
        if (step === 2) { // Photos (Swapping order: Vibe -> Photos -> Review is better? No, Photos -> Vibe -> Review usually. Let's stick to STEPS array.)
            // STEPS: Welcome, Basics, Vibe, Photos, Review
            // Current Step 2 is Vibe (Bio)
            if (!formData.bio) return Alert.alert("Required", "Please write a short bio.");
        }
        if (step === 3) { // Photos
            if (formData.photos.length < 2) return Alert.alert("Required", "Please add at least 2 photos.");
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
            allowsEditing: true,
            aspect: [3, 4], // Portrait aspect ratio like Tinder
            quality: 0.5, // Good balance for base64
            base64: true, // ✅ Request Base64
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
        try {
            setLoading(true);

            // 1. Upload Photos Sequentially to prevent network congestion
            console.log("Starting uploads...");
            const uploadedUrls = [];
            for (const photoUri of formData.photos) {
                const url = await uploadPhoto(photoUri);
                uploadedUrls.push(url);
            }
            console.log("Uploads done:", uploadedUrls);

            // 2. Construct ISO Date
            const isoDate = `${formData.birthDate.year}-${formData.birthDate.month.padStart(2, '0')}-${formData.birthDate.day.padStart(2, '0')}T00:00:00.000Z`;

            // Enum Mapping
            const genderMap: Record<string, string> = {
                "Male": "MALE",
                "Female": "FEMALE",
                "Non-binary": "NON_BINARY" // Important: Underscore matches Schema
            };

            const yearMap: Record<string, string> = {
                "Freshman": "FRESHMAN",
                "Sophomore": "SOPHOMORE",
                "Junior": "JUNIOR",
                "Senior": "SENIOR",
                "Grad Student": "GRADUATE",
                "Alumni": "ALUMNI"
            };

            // Helpers to safely get enum or fallback
            const safeGender = genderMap[formData.gender] || "OTHER";
            const safeYear = yearMap[formData.year] || "OTHER";

            const payload = {
                firstName: formData.firstName,
                gender: safeGender,
                birthDate: isoDate,
                major: formData.major,
                year: safeYear,
                bio: formData.bio,
                hobbies: formData.hobbies,
                instagramHandle: formData.instagramHandle,
                height: formData.height ? parseInt(formData.height) : null, // Ensure height is Int or null
                photos: uploadedUrls
            };

            const { data } = await api.post('/api/dating/profile', payload);

            // Success
            Alert.alert(
                "Welcome!",
                "Your profile is created.",
                [{
                    text: "OK",
                    onPress: () => onComplete()
                }]
            );
        } catch (err: any) {
            console.error("Profile creation error:", err);
            Alert.alert("Error", err.response?.data?.error || "Failed to create profile. Check your internet.");
        } finally {
            setLoading(false);
        }
    };

    // ── RENDERERS ──────────────────────────────────────────────────────────────

    const renderIntro = () => (
        <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={60} color="#4C5FD5" />
            </View>
            <Text style={styles.title}>Verified & Exclusive</Text>
            <Text style={styles.text}>
                CommunityTalk Dating is exclusively for verified CUNY students.
            </Text>
            <View style={styles.bulletList}>
                <Text style={styles.bullet}>• Real Names Only</Text>
                <Text style={styles.bullet}>• Verified .edu Emails</Text>
                <Text style={styles.bullet}>• No Toxicity Tolerated</Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
                <Text style={styles.primaryButtonText}>I Pledge to be Respectful</Text>
            </TouchableOpacity>
        </View>
    );

    const renderBasics = () => (
        <View style={styles.formContainer}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={t => setFormData({ ...formData, firstName: t })}
                placeholder="Your Name"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
                {['Male', 'Female', 'Non-binary'].map(g => (
                    <TouchableOpacity
                        key={g}
                        style={[styles.chip, formData.gender === g && styles.chipActive]}
                        onPress={() => setFormData({ ...formData, gender: g })}
                    >
                        <Text style={[styles.chipText, formData.gender === g && styles.chipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.dateRow}>
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="MM"
                    keyboardType="numeric"
                    maxLength={2}
                    value={formData.birthDate.month}
                    onChangeText={t => setFormData({ ...formData, birthDate: { ...formData.birthDate, month: t } })}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="DD"
                    keyboardType="numeric"
                    maxLength={2}
                    value={formData.birthDate.day}
                    onChangeText={t => setFormData({ ...formData, birthDate: { ...formData.birthDate, day: t } })}
                />
                <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="YYYY"
                    keyboardType="numeric"
                    maxLength={4}
                    value={formData.birthDate.year}
                    onChangeText={t => setFormData({ ...formData, birthDate: { ...formData.birthDate, year: t } })}
                />
            </View>

            <Text style={styles.label}>Major</Text>
            <TextInput
                style={styles.input}
                value={formData.major}
                onChangeText={t => setFormData({ ...formData, major: t })}
                placeholder="e.g. Computer Science"
            />

            <Text style={styles.label}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {STUDY_YEARS.map(y => (
                    <TouchableOpacity
                        key={y}
                        style={[styles.chip, formData.year === y && styles.chipActive]}
                        onPress={() => setFormData({ ...formData, year: y })}
                    >
                        <Text style={[styles.chipText, formData.year === y && styles.chipTextActive]}>{y}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderVibe = () => (
        <View style={styles.formContainer}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                value={formData.bio}
                onChangeText={t => setFormData({ ...formData, bio: t })}
                placeholder="Tell us about yourself..."
                multiline
                maxLength={500}
            />
            <Text style={styles.hint}>{formData.bio.length}/500</Text>

            <Text style={styles.label}>Height (cm) (Optional)</Text>
            <TextInput
                style={styles.input}
                value={formData.height}
                onChangeText={t => setFormData({ ...formData, height: t })}
                placeholder="e.g. 175"
                keyboardType="numeric"
            />

            <Text style={styles.label}>Hobbies / Interests (Pick up to 5)</Text>
            <View style={styles.chipRowWrap}>
                {PREDEFINED_HOBBIES.map(h => {
                    const selected = formData.hobbies.includes(h);
                    return (
                        <TouchableOpacity
                            key={h}
                            style={[styles.chip, selected && styles.chipActive]}
                            onPress={() => {
                                const newHobbies = selected
                                    ? formData.hobbies.filter(i => i !== h)
                                    : formData.hobbies.length < 5 ? [...formData.hobbies, h] : formData.hobbies;
                                setFormData({ ...formData, hobbies: newHobbies });
                            }}
                        >
                            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{h}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderPhotos = () => (
        <View style={styles.formContainer}>
            <Text style={styles.label}>Add Photos (Min 2)</Text>
            <Text style={styles.text}>Drag to reorder (Coming soon). First photo is your main one.</Text>

            <View style={styles.photoGrid}>
                {formData.photos.map((uri, idx) => (
                    <View key={idx} style={styles.photoSlot}>
                        <Image source={{ uri }} style={styles.photoImage} />
                        <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(idx)}>
                            <Ionicons name="close" size={16} color="#FFF" />
                        </TouchableOpacity>
                        {idx === 0 && (
                            <View style={styles.mainBadge}>
                                <Text style={styles.mainBadgeText}>MAIN</Text>
                            </View>
                        )}
                    </View>
                ))}

                {formData.photos.length < 6 && (
                    <TouchableOpacity style={styles.addPhotoSlot} onPress={pickImage}>
                        <Ionicons name="add" size={40} color="#CCC" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderReview = () => (
        <View style={styles.stepContainer}>
            <Image source={{ uri: formData.photos[0] }} style={{ width: 150, height: 200, borderRadius: 12, marginBottom: 20 }} />
            <Text style={styles.title}>{formData.firstName}, {new Date().getFullYear() - parseInt(formData.birthDate.year)}</Text>
            <Text style={styles.text}>{formData.major} • {formData.year}</Text>
            <Text style={[styles.text, { fontStyle: 'italic', marginTop: 10 }]}>"{formData.bio}"</Text>

            <View style={{ height: 20 }} />
            <Text style={styles.label}>Ready to join the pool?</Text>
            <Text style={styles.hint}>You can edit your profile later.</Text>
        </View>
    );

    const renderStepContent = () => {
        switch (step) {
            case 0: return renderIntro();
            case 1: return renderBasics();
            case 2: return renderVibe();
            case 3: return renderPhotos();
            case 4: return renderReview();
            default: return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {step > 0 && (
                    <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                )}
                <Text style={styles.stepTitle}>{STEPS[step]}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.progressBar}>
                {STEPS.map((_, i) => (
                    <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {renderStepContent()}
            </ScrollView>

            {step > 0 && (
                <View style={styles.footer}>
                    {step === STEPS.length - 1 ? (
                        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Create Profile</Text>}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
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
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60, // Safe Area
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    progressBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E0E0E0'
    },
    progressDotActive: {
        backgroundColor: '#4C5FD5'
    },
    content: {
        padding: 24,
        flexGrow: 1,
    },
    footer: {
        padding: 24,
        paddingBottom: 100, // Extra padding for TabBar/FAB
        borderTopWidth: 1,
        borderTopColor: '#EEE'
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
        backgroundColor: 'rgba(76,95,213,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center'
    },
    text: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
        lineHeight: 24
    },
    bulletList: {
        alignSelf: 'stretch',
        backgroundColor: '#F8F9FC',
        padding: 20,
        borderRadius: 16,
        marginTop: 10
    },
    bullet: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333'
    },
    label: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4
    },
    hint: {
        fontSize: 12,
        color: '#999',
        marginTop: -10,
        textAlign: 'right'
    },
    input: {
        backgroundColor: '#F5F5F5',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#EEE'
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
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    chipActive: {
        backgroundColor: '#EEF2FF',
        borderColor: '#4C5FD5'
    },
    chipText: {
        fontWeight: '600',
        color: '#666'
    },
    chipTextActive: {
        color: '#4C5FD5'
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
        backgroundColor: '#F0F0F0'
    },
    addPhotoSlot: {
        width: '30%',
        aspectRatio: 3 / 4,
        borderRadius: 10,
        backgroundColor: '#F8F8F8',
        borderWidth: 2,
        borderColor: '#EEE',
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
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
        padding: 4
    },
    mainBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(76,95,213,0.8)',
        paddingVertical: 4,
        alignItems: 'center'
    },
    mainBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800'
    },
    primaryButton: {
        backgroundColor: '#4C5FD5',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        alignSelf: 'stretch'
    },
    primaryButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16
    }
});

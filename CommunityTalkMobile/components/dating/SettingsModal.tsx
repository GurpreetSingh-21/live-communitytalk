import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Alert, Image, ActivityIndicator, TextInput, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import DatingAPI, { DatingProfile, DatingPhoto } from '@/src/api/dating';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    onDeleteSuccess?: () => void;
}

const PRESET_INTERESTS = [
    'Gym', 'Coffee', 'Hiking', 'Anime', 'Gaming', 'Study',
    'Music', 'Art', 'Travel', 'Foodie', 'Nightlife', 'Sports',
    'Reading', 'Movies', 'Photography', 'Fashion', 'Cooking', 'Dancing', 'Thrifting'
];

const PRESET_PROMPTS = [
    "A shower thought I recently had...",
    "Unpopular opinion...",
    "Best spot to study on campus is...",
    "Two truths and a lie...",
    "I geek out on..."
];

export default function SettingsModal({ visible, onClose, onDeleteSuccess }: SettingsModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

    const [profile, setProfile] = useState<DatingProfile | null>(null);
    const [photos, setPhotos] = useState<DatingPhoto[]>([]);

    // Editable Fields
    const [bio, setBio] = useState('');
    const [major, setMajor] = useState('');
    const [gradYear, setGradYear] = useState('');
    const [greekLife, setGreekLife] = useState('');
    const [interests, setInterests] = useState<string[]>([]);
    const [prompts, setPrompts] = useState<{ question: string, answer: string }[]>([]);
    const [spotifyTopArtists, setSpotifyTopArtists] = useState<string[]>([]);

    // Discovery Settings
    const [ageMin, setAgeMin] = useState(18);
    const [ageMax, setAgeMax] = useState(30);
    const [maxDistance, setMaxDistance] = useState(50);
    const [interestedInGender, setInterestedInGender] = useState<string[]>([]);
    const [showOnCampus, setShowOnCampus] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (visible) {
            loadProfile();
        }
    }, [visible]);

    const loadProfile = async () => {
        setLoading(true);
        const data = await DatingAPI.getMyProfile();
        if (data) {
            setProfile(data);
            setPhotos(data.photos || []);
            setBio(data.bio || '');
            setMajor(data.major || '');
            setGradYear(data.gradYear || '');
            setGreekLife(data.greekLife || '');
            // 'interests' is the new field; fall back to legacy 'hobbies' for existing profiles
            setInterests((data.interests && data.interests.length > 0) ? data.interests : (data.hobbies || []));
            setPrompts(data.prompts || []);
            setSpotifyTopArtists(data.spotifyTopArtists || []);
            setIsPaused(data.isPaused || false);

            if (data.preference) {
                setAgeMin(data.preference.ageMin);
                setAgeMax(Math.min(data.preference.ageMax, 35));
                setMaxDistance(data.preference.maxDistance);
                setInterestedInGender(data.preference.interestedInGender || []);
                setShowOnCampus(data.preference.showToPeopleOnCampusOnly);
            }
        }
        setLoading(false);
    };

    const requestLocationForDistance = () => {
        Alert.alert(
            'Location Used for Distance',
            `Campustry uses your device location only to show nearby profiles. Your exact location is never shared with other users.`,
            [
                { text: 'Got it', style: 'default' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
        );
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Dating Profile',
            'This will permanently delete your dating profile, all photos, matches, and conversations. This action is irreversible.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => setDeleteConfirmVisible(true),
                },
            ]
        );
    };

    const handleConfirmedDelete = async () => {
        if (deleteConfirmInput.trim().toUpperCase() !== 'DELETE') {
            Alert.alert('Incorrect', 'Please type DELETE in all caps to confirm.');
            return;
        }
        setDeleting(true);
        try {
            await DatingAPI.deleteDatingProfile();
            setDeleteConfirmVisible(false);
            // Delay closing the main modal and routing so the iOS view hierarchy has time to remove the nested modal
            setTimeout(() => {
                onClose();
                Alert.alert(
                    'Profile Deleted',
                    'Your dating profile has been permanently deleted.',
                    [
                        { 
                            text: 'OK', 
                            onPress: () => {
                                if (onDeleteSuccess) {
                                    onDeleteSuccess();
                                } else {
                                    router.replace('/(tabs)');
                                }
                            }
                        }
                    ]
                );
            }, 300);
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to delete profile. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedProfile = await DatingAPI.updateProfile({
                bio,
                major,
                gradYear,
                greekLife,
                interests,
                prompts,
                spotifyTopArtists,
                photos: photos.map((p, index) => ({
                    url: p.url,
                    isMain: index === 0
                })),
                preferences: {
                    ageMin,
                    ageMax,
                    maxDistance,
                    interestedInGender,
                    showToPeopleOnCampusOnly: showOnCampus
                },
                pauseProfile: isPaused
            });

            if (updatedProfile) {
                Alert.alert("Success", "Profile updated successfully");
                onClose();
            } else {
                Alert.alert("Error", "Failed to update profile");
            }
        } catch (error) {
            Alert.alert("Error", "Something went wrong saving your profile.");
        } finally {
            setSaving(false);
        }
    };

    const pickImage = async () => {
        if (photos.length >= 6) {
            Alert.alert("Limit Reached", "You can only have 6 photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.7,
            base64: true
        });

        if (!result.canceled && result.assets[0].base64) {
            try {
                const isFirst = photos.length === 0;
                const tempId = Date.now().toString();
                const localUri = result.assets[0].uri;

                const newPhoto: DatingPhoto = { id: tempId, url: localUri, isMain: isFirst, status: 'PENDING' };
                setPhotos([...photos, newPhoto]);

                const uploadedUrl = await DatingAPI.uploadPhoto(result.assets[0].base64);
                if (uploadedUrl) {
                    setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, url: uploadedUrl } : p));
                } else {
                    Alert.alert("Upload Failed", "Could not upload image. Please try again.");
                    setPhotos(prev => prev.filter(p => p.id !== tempId));
                }
            } catch (e) {
                console.error("Pick image error", e);
            }
        }
    };

    const removePhoto = (id: string) => {
        setPhotos(photos.filter(p => p.id !== id));
    };

    const makeMain = (index: number) => {
        if (index === 0) return;
        const newPhotos = [...photos];
        const [movedPhoto] = newPhotos.splice(index, 1);
        newPhotos.unshift(movedPhoto);
        newPhotos.forEach((p, i) => p.isMain = i === 0);
        setPhotos(newPhotos);
    };

    const toggleInterest = (interest: string) => {
        if (interests.includes(interest)) {
            setInterests(interests.filter(i => i !== interest));
        } else {
            if (interests.length >= 5) {
                Alert.alert("Limit Reached", "You can select up to 5 interests.");
                return;
            }
            setInterests([...interests, interest]);
        }
    };

    const addPrompt = () => {
        if (prompts.length >= 3) {
            Alert.alert("Limit Reached", "You can have up to 3 prompts.");
            return;
        }
        setPrompts([...prompts, { question: PRESET_PROMPTS[0], answer: '' }]);
    };

    const updatePrompt = (index: number, key: 'question' | 'answer', value: string) => {
        const newPrompts = [...prompts];
        newPrompts[index][key] = value;
        setPrompts(newPrompts);
    };

    const removePrompt = (index: number) => {
        const newPrompts = [...prompts];
        newPrompts.splice(index, 1);
        setPrompts(newPrompts);
    };

    if (loading && !profile) {
        return (
            <Modal transparent visible={visible}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                </View>
            </Modal>
        );
    }

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.container}>
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="chevron-down" size={28} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#FF6B6B" /> : <Text style={styles.doneText}>Save</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    
                    {/* PHOTO MANAGEMENT (DYNAMIC GRID) */}
                    <Text style={styles.sectionTitle}>My Photos</Text>
                    {/* Flat photo grid: up to 6 slots (1 big + up to 5 small) */}
                    <View style={styles.photoGrid}>
                        {/* HERO / MAIN PHOTO */}
                        {photos.length > 0 ? (
                            <TouchableOpacity style={styles.heroPhoto} onPress={() => makeMain(0)}>
                                <Image source={{ uri: photos[0].url }} style={styles.photoImage} />
                                <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(photos[0].id)}>
                                    <Ionicons name="close" size={14} color="#FFF" />
                                </TouchableOpacity>
                                <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.heroPhotoAdd} onPress={pickImage}>
                                <Ionicons name="add" size={40} color="#9CA3AF" />
                                <Text style={{ color: '#9CA3AF', marginTop: 8, fontWeight: '600' }}>Add Photo</Text>
                            </TouchableOpacity>
                        )}

                        {/* SMALLER PHOTOS — only show filled slots + one add button */}
                        <View style={styles.smallPhotosContainer}>
                            {photos.slice(1).map((photo, i) => (
                                <TouchableOpacity key={photo.id} style={styles.smallPhoto} onPress={() => makeMain(i + 1)}>
                                    <Image source={{ uri: photo.url }} style={styles.photoImage} />
                                    <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(photo.id)}>
                                        <Ionicons name="close" size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ))}
                            {/* Show add button if we have at least 1 photo but fewer than 6 */}
                            {photos.length > 0 && photos.length < 6 && (
                                <TouchableOpacity style={styles.smallPhotoAdd} onPress={pickImage}>
                                    <Ionicons name="add" size={24} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <Text style={styles.hintText}>Tap a photo to set as Main. Tap ✕ to remove. Max 6 photos.</Text>

                    {/* BIO EDIT */}
                    <Text style={styles.sectionTitle}>About Me</Text>
                    <View style={styles.glassCard}>
                        <TextInput
                            style={styles.bioInput}
                            multiline
                            placeholder="Write something interesting..."
                            placeholderTextColor="#9CA3AF"
                            value={bio}
                            onChangeText={setBio}
                            maxLength={500}
                        />
                        <Text style={styles.charCount}>{bio.length}/500</Text>
                    </View>

                    {/* THE "BASICS" (COLLEGE VITALS) */}
                    <Text style={styles.sectionTitle}>The Basics</Text>
                    <View style={styles.glassCard}>
                        <View style={styles.inputRow}>
                            <Ionicons name="book-outline" size={20} color="#6B7280" />
                            <TextInput
                                style={styles.basicInput}
                                placeholder="Major (e.g. Computer Science)"
                                placeholderTextColor="#9CA3AF"
                                value={major}
                                onChangeText={setMajor}
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="school-outline" size={20} color="#6B7280" />
                            <TextInput
                                style={styles.basicInput}
                                placeholder="Grad Year (e.g. Class of 2026)"
                                placeholderTextColor="#9CA3AF"
                                value={gradYear}
                                onChangeText={setGradYear}
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="home-outline" size={20} color="#6B7280" />
                            <TextInput
                                style={styles.basicInput}
                                placeholder="Greek Life / Dorm (Optional)"
                                placeholderTextColor="#9CA3AF"
                                value={greekLife}
                                onChangeText={setGreekLife}
                            />
                        </View>
                    </View>

                    {/* VIBES / INTERESTS */}
                    <Text style={styles.sectionTitle}>My Vibe (Interests)</Text>
                    <View style={styles.pillsContainer}>
                        {PRESET_INTERESTS.map(interest => {
                            const isSelected = interests.includes(interest);
                            return (
                                <TouchableOpacity 
                                    key={interest} 
                                    onPress={() => toggleInterest(interest)}
                                    style={[styles.pill, isSelected && styles.pillSelected]}
                                >
                                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{interest}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>

                    {/* PROMPTS (HINGE STYLE) */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Profile Prompts</Text>
                        {prompts.length < 3 && (
                            <TouchableOpacity onPress={addPrompt}>
                                <Ionicons name="add-circle" size={24} color="#FF6B6B" />
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    {prompts.map((prompt, index) => (
                        <MotiView 
                            key={index} 
                            from={{ opacity: 0, translateY: 10 }} 
                            animate={{ opacity: 1, translateY: 0 }} 
                            style={styles.promptCard}
                        >
                            <TouchableOpacity style={styles.promptRemoveBtn} onPress={() => removePrompt(index)}>
                                <Ionicons name="close-circle" size={24} color="#D1D5DB" />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.promptQuestionInput}
                                value={prompt.question}
                                onChangeText={(val) => updatePrompt(index, 'question', val)}
                                placeholder="Type a prompt question..."
                                placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                                style={styles.promptAnswerInput}
                                value={prompt.answer}
                                onChangeText={(val) => updatePrompt(index, 'answer', val)}
                                placeholder="Your answer..."
                                placeholderTextColor="#9CA3AF"
                                multiline
                            />
                        </MotiView>
                    ))}

                    {/* DISCOVERY SETTINGS */}
                    <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Discovery Settings</Text>
                    <View style={styles.glassCard}>
                        {/* Distance */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Maximum Distance</Text>
                            <Text style={styles.value}>{maxDistance} mi</Text>
                        </View>
                        <View style={styles.sliderRow}>
                            <TouchableOpacity onPress={() => { setMaxDistance(Math.max(5, maxDistance - 5)); requestLocationForDistance(); }} style={styles.stepper}><Text style={styles.stepperText}>-</Text></TouchableOpacity>
                            <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${(maxDistance / 100) * 100}%` }]} /></View>
                            <TouchableOpacity onPress={() => { setMaxDistance(Math.min(100, maxDistance + 5)); requestLocationForDistance(); }} style={styles.stepper}><Text style={styles.stepperText}>+</Text></TouchableOpacity>
                        </View>
                        <View style={styles.divider} />
                        
                        {/* Show Me */}
                        <View style={styles.row}><Text style={styles.label}>Show Me</Text></View>
                        <View style={styles.segmentContainer}>
                            {['Men', 'Women', 'Everyone'].map((opt) => {
                                let val: string[] = [];
                                if (opt === 'Men') val = ['MALE'];
                                if (opt === 'Women') val = ['FEMALE'];
                                const isSelected = opt === 'Everyone' ? interestedInGender.length === 0 : interestedInGender.includes(val[0]) && interestedInGender.length === 1;
                                return (
                                    <TouchableOpacity key={opt} style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]} onPress={() => setInterestedInGender(val)}>
                                        <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>{opt}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.divider} />
                        
                        {/* Age Range */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Age Range</Text>
                            <Text style={styles.value}>{ageMin} – {ageMax}</Text>
                        </View>
                        <View style={styles.sliderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between' }}>
                                <TouchableOpacity onPress={() => setAgeMin(Math.max(18, ageMin - 1))} style={styles.stepperSmall}><Text>-</Text></TouchableOpacity>
                                <Text style={styles.rangeVal}>Min: {ageMin}</Text>
                                <TouchableOpacity onPress={() => setAgeMin(Math.min(ageMax - 1, ageMin + 1))} style={styles.stepperSmall}><Text>+</Text></TouchableOpacity>
                                <View style={{ width: 20 }} />
                                <TouchableOpacity onPress={() => setAgeMax(Math.max(ageMin + 1, ageMax - 1))} style={styles.stepperSmall}><Text>-</Text></TouchableOpacity>
                                <Text style={styles.rangeVal}>Max: {ageMax}</Text>
                                <TouchableOpacity onPress={() => setAgeMax(Math.min(35, ageMax + 1))} style={styles.stepperSmall}><Text>+</Text></TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        
                        {/* Campus Toggle */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Show Only on Campus</Text>
                            <Switch value={showOnCampus} onValueChange={setShowOnCampus} trackColor={{ false: "#D1D5DB", true: "#FF6B6B" }} />
                        </View>
                    </View>

                    {/* ACCOUNT SETTINGS */}
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.glassCard}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Pause Profile</Text>
                            <Switch value={isPaused} onValueChange={setIsPaused} trackColor={{ false: "#D1D5DB", true: "#FF6B6B" }} />
                        </View>
                        <Text style={styles.cardFooter}>Pausing stops you from being shown to new people. You can still chat with existing matches.</Text>
                    </View>

                    <TouchableOpacity style={styles.logoutButton} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                        <Text style={styles.logoutText}>Delete Dating Profile</Text>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>

            {/* Delete Confirmation Modal */}
            <Modal visible={deleteConfirmVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmVisible(false)}>
                <View style={styles.deleteOverlay}>
                    <View style={styles.deleteSheet}>
                        <View style={styles.deleteIconCircle}>
                            <Ionicons name="warning" size={32} color="#EF4444" />
                        </View>
                        <Text style={styles.deleteTitle}>Are you absolutely sure?</Text>
                        <Text style={styles.deleteBody}>This permanently deletes your dating profile, all photos, matches, and conversations. There is no undo.</Text>
                        <Text style={styles.deleteInstructions}>Type <Text style={{ fontWeight: '700', color: '#EF4444' }}>DELETE</Text> to confirm:</Text>
                        <TextInput style={styles.deleteInput} value={deleteConfirmInput} onChangeText={setDeleteConfirmInput} placeholder="Type DELETE here" placeholderTextColor="#9CA3AF" autoCapitalize="characters" autoCorrect={false} />
                        <TouchableOpacity onPress={handleConfirmedDelete} disabled={deleting} style={[styles.deleteConfirmBtn, { opacity: deleting ? 0.7 : 1 }]}>
                            {deleting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.deleteConfirmBtnText}>Permanently Delete</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setDeleteConfirmVisible(false); setDeleteConfirmInput(''); }} style={styles.deleteCancelBtn}>
                            <Text style={styles.deleteCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },

    // ── SHELL ───────────────────────────────────────────────────────────────────
    // The outer container is the cool grouped-list gray (#EEF0F3)
    // The white header floats above it with a visible shadow — exactly like iOS Settings
    container: {
        flex: 1,
        marginTop: 50,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#EEF0F3',   // <-- cool iOS-grouped gray
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',   // <-- stark white
        // Crisp drop shadow so the header feels elevated above the content
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#0D0D0D', letterSpacing: -0.3 },
    doneText: { fontSize: 16, fontWeight: '700', color: '#FF6B6B' },
    closeButton: { width: 40 },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8A8A8E', marginTop: 28, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 4 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 8, paddingRight: 4 },
    

    // DYNAMIC PHOTO GRID
    photoGrid: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    heroPhoto: { flex: 2, aspectRatio: 0.8, borderRadius: 16, overflow: 'hidden', backgroundColor: '#D1D5DB' },
    heroPhotoAdd: { flex: 2, aspectRatio: 0.8, borderRadius: 16, backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    smallPhotosContainer: { flex: 1, gap: 10, justifyContent: 'flex-start' },
    smallPhoto: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#D1D5DB' },
    smallPhotoAdd: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    removeButton: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4, zIndex: 2 },
    mainBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FF6B6B', paddingVertical: 4, alignItems: 'center' },
    mainBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    hintText: { fontSize: 13, color: '#9CA3AF', marginBottom: 20, marginLeft: 4 },


    // GLASS CARDS & INPUTS
    glassCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    bioInput: { fontSize: 16, color: '#0D0D0D', minHeight: 80, textAlignVertical: 'top' },
    charCount: { textAlign: 'right', fontSize: 12, color: '#AEAEB2', marginTop: 4 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    basicInput: { flex: 1, fontSize: 16, color: '#0D0D0D' },
    

    // PILLS (INTERESTS)
    pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB' },
    pillSelected: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
    pillText: { fontSize: 14, fontWeight: '500', color: '#3C3C43' },
    pillTextSelected: { color: '#FFFFFF', fontWeight: '700' },


    // PROMPTS
    promptCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    promptQuestionInput: { fontSize: 13, fontWeight: '700', color: '#FF6B6B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    promptAnswerInput: { fontSize: 20, fontWeight: '600', color: '#0D0D0D', minHeight: 40 },
    promptRemoveBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10 },


    // SETTINGS
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
    label: { fontSize: 16, fontWeight: '500', color: '#0D0D0D' },
    value: { fontSize: 16, color: '#8A8A8E' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#C6C6C8', marginLeft: 0 },
    cardFooter: { fontSize: 13, color: '#AEAEB2', marginTop: 6, marginBottom: 4, lineHeight: 18 },

    // SLIDERS & SEGMENTS
    sliderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 14, gap: 10 },
    stepper: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
    stepperSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
    stepperText: { fontSize: 18, fontWeight: '600', color: '#0D0D0D' },
    sliderTrack: { flex: 1, height: 6, backgroundColor: '#E5E5EA', borderRadius: 3, overflow: 'hidden' },
    sliderFill: { height: '100%', backgroundColor: '#FF6B6B', borderRadius: 3 },
    rangeVal: { fontSize: 14, fontWeight: '600', color: '#0D0D0D' },
    segmentContainer: { flexDirection: 'row', backgroundColor: '#E5E5EA', borderRadius: 10, padding: 3, marginBottom: 12 },
    segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    segmentBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
    segmentText: { fontSize: 14, fontWeight: '500', color: '#8A8A8E' },
    segmentTextActive: { color: '#0D0D0D', fontWeight: '700' },

    // LOGOUT / DELETE
    logoutButton: { marginTop: 30, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
    logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
    deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    deleteSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
    deleteIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
    deleteTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 10 },
    deleteBody: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    deleteInstructions: { fontSize: 14, color: '#111827', marginBottom: 10 },
    deleteInput: { borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 12, padding: 14, fontSize: 16, color: '#111827', marginBottom: 16 },
    deleteConfirmBtn: { backgroundColor: '#EF4444', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
    deleteConfirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    deleteCancelBtn: { padding: 12, alignItems: 'center' },
    deleteCancelText: { color: '#6B7280', fontSize: 16, fontWeight: '500' },
});

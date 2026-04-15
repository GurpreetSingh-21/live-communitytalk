import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Alert, Image, ActivityIndicator, TextInput, Platform, Linking, TextInput as RNTextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import DatingAPI, { DatingProfile, DatingPhoto, DatingPreference } from '@/src/api/dating';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

    // State
    const [profile, setProfile] = useState<DatingProfile | null>(null);
    const [photos, setPhotos] = useState<DatingPhoto[]>([]);

    // Editable Fields
    const [bio, setBio] = useState('');
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
            setIsPaused(data.isPaused || false);

            if (data.preference) {
                setAgeMin(data.preference.ageMin);
                // Enforce platform cap at load time
                setAgeMax(Math.min(data.preference.ageMax, 35));
                setMaxDistance(data.preference.maxDistance);
                setInterestedInGender(data.preference.interestedInGender || []);
                setShowOnCampus(data.preference.showToPeopleOnCampusOnly);
            }
        }
        setLoading(false);
    };

    /**
     * Show a transparent disclosure when the user adjusts the distance preference.
     * The OS will surface a native location permission dialog automatically the
     * first time the swipe pool makes a location-aware request.
     * If the user has previously denied permission, we deep-link to Settings.
     */
    const requestLocationForDistance = () => {
        Alert.alert(
            'Location Used for Distance',
            `Campustry uses your device location only to show nearby profiles. Your exact location is never shared with other users.\n\nIf profiles are not appearing, make sure Location is enabled for Campustry in your device Settings.`,
            [
                { text: 'Got it', style: 'default' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
        );
    };

    const handleDelete = () => {
        // Step 1 — First warning
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
            onClose();
            Alert.alert(
                'Profile Deleted',
                'Your dating profile has been permanently deleted.',
                [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
            );
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to delete profile. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Optimistic update or just wait for response
            const updatedProfile = await DatingAPI.updateProfile({
                bio,
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
        // limit to 6 photos
        if (photos.length >= 6) {
            Alert.alert("Limit Reached", "You can only have 6 photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.7, // Compress a bit
            base64: true
        });

        if (!result.canceled && result.assets[0].base64) {
            // Upload immediately?
            // User expects instant feedback, so show local uri first with "uploading" state?
            // For simplicity, we block-wait for upload or show spinner on the placeholder.
            // Let's allow adding it to state with a temp ID, upload in background? 
            // Better: Upload now.
            try {
                // Determine if this is the first photo (Main)
                const isFirst = photos.length === 0;

                // Add temp placeholder
                const tempId = Date.now().toString();
                const localUri = result.assets[0].uri;

                // Optimistically add to UI
                const newPhoto: DatingPhoto = { id: tempId, url: localUri, isMain: isFirst, status: 'PENDING' };
                setPhotos([...photos, newPhoto]);

                // Upload
                const uploadedUrl = await DatingAPI.uploadPhoto(result.assets[0].base64);
                if (uploadedUrl) {
                    // Update the photo with real URL
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
        // Update isMain flags
        newPhotos.forEach((p, i) => p.isMain = i === 0);
        setPhotos(newPhotos);
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
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="chevron-down" size={30} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#FF6B6B" /> : <Text style={styles.doneText}>Save</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* PHOTO MANAGEMENT */}
                    <Text style={styles.sectionTitle}>My Photos</Text>
                    <View style={styles.photoGrid}>
                        {photos.map((photo, index) => (
                            <TouchableOpacity
                                key={photo.id || index}
                                style={[styles.photoCard, index === 0 && styles.mainPhotoCard]}
                                onPress={() => makeMain(index)}
                            >
                                <Image source={{ uri: photo.url }} style={styles.photoImage} />
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => removePhoto(photo.id)}
                                >
                                    <Ionicons name="close" size={16} color="#FFF" />
                                </TouchableOpacity>
                                {index === 0 && (
                                    <View style={styles.mainBadge}>
                                        <Text style={styles.mainBadgeText}>Main</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}

                        {photos.length < 6 && (
                            <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                                <Ionicons name="add" size={32} color="#CCC" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.hintText}>Tap a photo to set as Main. Tap X to remove.</Text>

                    {/* BIO EDIT */}
                    <Text style={styles.sectionTitle}>About Me</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.bioInput}
                            multiline
                            placeholder="Write something interesting..."
                            placeholderTextColor="#999"
                            value={bio}
                            onChangeText={setBio}
                            maxLength={500}
                        />
                        <Text style={styles.charCount}>{bio.length}/500</Text>
                    </View>

                    {/* DISCOVERY SETTINGS */}
                    <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Discovery Settings</Text>
                    <View style={styles.card}>
                        {/* Distance */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Maximum Distance</Text>
                            <Text style={styles.value}>{maxDistance} mi</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#999', marginBottom: 6, marginTop: -4 }}>
                            Location access is used only to show nearby profiles.
                        </Text>
                        <View style={styles.sliderRow}>
                            <TouchableOpacity
                                onPress={() => {
                                    setMaxDistance(Math.max(5, maxDistance - 5));
                                    requestLocationForDistance();
                                }}
                                style={styles.stepper}
                            >
                                <Text style={styles.stepperText}>-</Text>
                            </TouchableOpacity>
                            <View style={styles.sliderTrack}>
                                <View style={[styles.sliderFill, { width: `${(maxDistance / 100) * 100}%` }]} />
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setMaxDistance(Math.min(100, maxDistance + 5));
                                    requestLocationForDistance();
                                }}
                                style={styles.stepper}
                            >
                                <Text style={styles.stepperText}>+</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* Show Me (Gender) */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Show Me</Text>
                        </View>
                        <View style={styles.segmentContainer}>
                            {['Men', 'Women', 'Everyone'].map((opt) => {
                                let val: string[] = [];
                                if (opt === 'Men') val = ['MALE'];
                                if (opt === 'Women') val = ['FEMALE'];
                                // Everyone = [] (Empty array implies all in backend logic)

                                const isSelected = opt === 'Everyone'
                                    ? interestedInGender.length === 0
                                    : interestedInGender.includes(val[0]) && interestedInGender.length === 1;

                                return (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]}
                                        onPress={() => setInterestedInGender(val)}
                                    >
                                        <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>
                                            {opt}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.divider} />

                        {/* Age Range — capped at 35 for a college platform */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Age Range</Text>
                            <Text style={styles.value}>{ageMin} – {ageMax}</Text>
                        </View>
                        {ageMax - ageMin > 10 && (
                            <View style={styles.ageWarning}>
                                <Ionicons name="warning" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
                                <Text style={styles.ageWarningText}>
                                    Large age gap selected. Ensure this is intentional.
                                </Text>
                            </View>
                        )}
                        <View style={styles.sliderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between' }}>
                                <TouchableOpacity onPress={() => setAgeMin(Math.max(18, ageMin - 1))} style={styles.stepperSmall}><Text>-</Text></TouchableOpacity>
                                <Text style={styles.rangeVal}>Min: {ageMin}</Text>
                                <TouchableOpacity onPress={() => setAgeMin(Math.min(ageMax - 1, ageMin + 1))} style={styles.stepperSmall}><Text>+</Text></TouchableOpacity>

                                <View style={{ width: 20 }} />

                                <TouchableOpacity onPress={() => setAgeMax(Math.max(ageMin + 1, ageMax - 1))} style={styles.stepperSmall}><Text>-</Text></TouchableOpacity>
                                <Text style={styles.rangeVal}>Max: {ageMax}</Text>
                                {/* Hard cap at 35 for college dating platform */}
                                <TouchableOpacity onPress={() => setAgeMax(Math.min(35, ageMax + 1))} style={styles.stepperSmall}><Text>+</Text></TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text style={styles.label}>Show Only on Campus</Text>
                            <Switch
                                value={showOnCampus}
                                onValueChange={setShowOnCampus}
                                trackColor={{ false: "#767577", true: "#FF6B6B" }}
                            />
                        </View>
                    </View>

                    {/* ACCOUNT SETTINGS */}
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Pause Profile</Text>
                            <Switch
                                value={isPaused}
                                onValueChange={setIsPaused}
                                trackColor={{ false: "#767577", true: "#FF6B6B" }}
                            />
                        </View>
                        <Text style={styles.cardFooter}>
                            Pausing your profile stops you from being shown to new people. You can still chat with existing matches.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleDelete}
                    >
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
                        <Text style={styles.logoutText}>Delete Dating Profile</Text>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={deleteConfirmVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteConfirmVisible(false)}
            >
                <View style={styles.deleteOverlay}>
                    <View style={styles.deleteSheet}>
                        <View style={styles.deleteIconCircle}>
                            <Ionicons name="warning" size={32} color="#FF3B30" />
                        </View>
                        <Text style={styles.deleteTitle}>Are you absolutely sure?</Text>
                        <Text style={styles.deleteBody}>
                            This permanently deletes your dating profile, all photos, matches, and conversations. There is no undo.
                        </Text>
                        <Text style={styles.deleteInstructions}>
                            Type{' '}<Text style={{ fontWeight: '700', color: '#FF3B30' }}>DELETE</Text>{' '}to confirm:
                        </Text>
                        <TextInput
                            style={styles.deleteInput}
                            value={deleteConfirmInput}
                            onChangeText={setDeleteConfirmInput}
                            placeholder="Type DELETE here"
                            placeholderTextColor="#999"
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            onPress={handleConfirmedDelete}
                            disabled={deleting}
                            style={[
                                styles.deleteConfirmBtn,
                                { opacity: deleting ? 0.7 : 1 }
                            ]}
                        >
                            {deleting
                                ? <ActivityIndicator color="#FFF" />
                                : <Text style={styles.deleteConfirmBtnText}>Permanently Delete</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setDeleteConfirmVisible(false); setDeleteConfirmInput(''); }}
                            style={styles.deleteCancelBtn}
                        >
                            <Text style={styles.deleteCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
        marginTop: 50, // iOS modal effect
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA'
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#000'
    },
    doneText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FF6B6B'
    },
    closeButton: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        marginTop: 20,
        marginBottom: 8,
        textTransform: 'uppercase',
        marginLeft: 4
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8
    },
    photoCard: {
        width: '30%',
        aspectRatio: 0.75,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#EEE'
    },
    mainPhotoCard: {
        borderColor: '#FF6B6B',
        borderWidth: 2
    },
    photoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    addPhotoButton: {
        width: '30%',
        aspectRatio: 0.75,
        backgroundColor: '#E5E5EA',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D1D1D6',
        borderStyle: 'dashed'
    },
    removeButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2
    },
    mainBadge: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: '#FF6B6B',
        alignItems: 'center',
        paddingVertical: 2
    },
    mainBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    hintText: {
        fontSize: 13,
        color: '#999',
        marginBottom: 20,
        marginLeft: 4
    },
    inputContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12
    },
    bioInput: {
        fontSize: 16,
        color: '#000',
        minHeight: 80,
        textAlignVertical: 'top'
    },
    charCount: {
        textAlign: 'right',
        fontSize: 12,
        color: '#CCC',
        marginTop: 4
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12
    },
    label: {
        fontSize: 16,
        color: '#000'
    },
    value: {
        fontSize: 16,
        color: '#8E8E93'
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 0
    },
    cardFooter: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 8,
        marginBottom: 8,
        lineHeight: 18,
        paddingHorizontal: 4
    },
    logoutButton: {
        marginTop: 30,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center'
    },
    logoutText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600'
    },
    deleteOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    deleteSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 28,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    },
    deleteIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFF0F0',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    deleteTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#000',
        textAlign: 'center',
        marginBottom: 10,
    },
    deleteBody: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    deleteInstructions: {
        fontSize: 14,
        color: '#333',
        marginBottom: 10,
    },
    deleteInput: {
        borderWidth: 1.5,
        borderColor: '#FF3B30',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#000',
        marginBottom: 16,
    },
    deleteConfirmBtn: {
        backgroundColor: '#FF3B30',
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    deleteConfirmBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
    deleteCancelBtn: {
        padding: 12,
        alignItems: 'center',
    },
    deleteCancelText: {
        color: '#666',
        fontSize: 16,
    },
    // Custom Slider Styles
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 12,
        gap: 10
    },
    stepper: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center'
    },
    stepperSmall: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center'
    },
    stepperText: { fontSize: 18, fontWeight: '600', color: '#333' },
    sliderTrack: { flex: 1, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, overflow: 'hidden' },
    sliderFill: { height: '100%', backgroundColor: '#FF6B6B' },
    rangeVal: { fontSize: 14, fontWeight: '600', color: '#555' },
    ageWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 8,
    },
    ageWarningText: {
        flex: 1,
        fontSize: 12,
        color: '#92400E',
        fontWeight: '500',
    },

    // Segment Control
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#F2F2F7',
        borderRadius: 8,
        padding: 2,
        marginBottom: 12
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6
    },
    segmentBtnActive: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666'
    },
    segmentTextActive: {
        color: '#000',
        fontWeight: '600'
    }
});

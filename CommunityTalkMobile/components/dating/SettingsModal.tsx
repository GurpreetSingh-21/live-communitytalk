import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Alert, Image, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DatingAPI, { DatingProfile, DatingPhoto, DatingPreference } from '@/src/api/dating';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // State
    const [profile, setProfile] = useState<DatingProfile | null>(null);
    const [photos, setPhotos] = useState<DatingPhoto[]>([]);

    // Editable Fields
    const [bio, setBio] = useState('');
    const [ageMin, setAgeMin] = useState(18);
    const [ageMax, setAgeMax] = useState(30);
    const [maxDistance, setMaxDistance] = useState(50);
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
                setAgeMax(data.preference.ageMax);
                setMaxDistance(data.preference.maxDistance);
                setShowOnCampus(data.preference.showToPeopleOnCampusOnly);
            }
        }
        setLoading(false);
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
                        {/* Mock Slider for now - implementing native slider requires generic component */}
                        <View style={styles.sliderRow}>
                            <TouchableOpacity onPress={() => setMaxDistance(Math.max(5, maxDistance - 5))} style={styles.stepper}><Text style={styles.stepperText}>-</Text></TouchableOpacity>
                            <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${(maxDistance / 100) * 100}%` }]} /></View>
                            <TouchableOpacity onPress={() => setMaxDistance(Math.min(100, maxDistance + 5))} style={styles.stepper}><Text style={styles.stepperText}>+</Text></TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* Age Range */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Age Range</Text>
                            <Text style={styles.value}>{ageMin} - {ageMax}</Text>
                        </View>
                        <View style={styles.sliderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between' }}>
                                <TouchableOpacity onPress={() => setAgeMin(Math.max(18, ageMin - 1))} style={styles.stepperSmall}><Text>-</Text></TouchableOpacity>
                                <Text style={styles.rangeVal}>Min: {ageMin}</Text>
                                <TouchableOpacity onPress={() => setAgeMin(Math.min(ageMax, ageMin + 1))} style={styles.stepperSmall}><Text>+</Text></TouchableOpacity>

                                <View style={{ width: 20 }} />

                                <TouchableOpacity onPress={() => setAgeMax(Math.max(ageMin, ageMax - 1))} style={styles.stepperSmall}><Text>-</Text></TouchableOpacity>
                                <Text style={styles.rangeVal}>Max: {ageMax}</Text>
                                <TouchableOpacity onPress={() => setAgeMax(Math.min(60, ageMax + 1))} style={styles.stepperSmall}><Text>+</Text></TouchableOpacity>
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

                    <TouchableOpacity style={styles.logoutButton} onPress={() => Alert.alert("Delete Account", "Functionality coming soon.")}>
                        <Text style={styles.logoutText}>Delete Account</Text>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>
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
    rangeVal: { fontSize: 14, fontWeight: '600', color: '#555' }
});

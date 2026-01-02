import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthContext } from '@/src/context/AuthContext';
import { api } from '@/src/api/api';
import * as ImagePicker from 'expo-image-picker';

// Force a visible green for the save button to ensure it stands out
const ACTION_COLOR = '#10B981';

export default function EditProfileScreen() {
    const insets = useSafeAreaInsets();
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const isDark = scheme === 'dark';

    // Cast context to 'any' to avoid the 'updateUser' property missing error 
    const auth = useContext(AuthContext) as any;
    const user = auth?.user;

    // Initialize with safe fallbacks
    const [name, setName] = useState(user?.fullName || '');
    const [bio, setBio] = useState(user?.bio || '');

    // Explicitly type the avatar state
    const [avatar, setAvatar] = useState<string | null>(
        user?.avatar || user?.profilePicture || null
    );

    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            if (!name) setName(user.fullName || '');
            if (!bio) setBio(user.bio || '');

            const currentContextAvatar = user.avatar || user.profilePicture;
            if (currentContextAvatar && currentContextAvatar !== avatar) {
                setAvatar((prev: string | null) => prev || currentContextAvatar);
            }
        }
    }, [user]);

    // Avatar Selection
    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please allow access to your photos to update your avatar.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled && result.assets[0].uri) {
                handleUpload(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    // Upload Logic
    const handleUpload = async (uri: string) => {
        setUploading(true);
        try {
            const formData = new FormData();
            // @ts-ignore
            formData.append('profilePicture', {
                uri,
                name: 'profile.jpg',
                type: 'image/jpeg',
            });

            const res = await api.put('/api/user/profile-picture', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const newUrl = res.data?.user?.profilePicture || res.data?.user?.avatar;

            if (newUrl) {
                setAvatar(newUrl);
                if (auth?.updateAvatar) auth.updateAvatar(newUrl);
                if (auth?.updateUser && res.data?.user) auth.updateUser(res.data.user);
                Alert.alert('Success', 'Profile photo updated!');
            } else {
                Alert.alert('Success', 'Profile photo uploaded. Refresh to see changes.');
            }

        } catch (error) {
            console.error('Upload failed:', error);
            Alert.alert('Upload Failed', 'Could not update profile picture.');
        } finally {
            setUploading(false);
        }
    };

    // Save Profile Logic
    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Name required', 'Please enter your name.');
            return;
        }

        setSaving(true);
        try {
            const res = await api.patch('/api/profile', {
                fullName: name.trim(),
                bio: bio.trim(),
            });

            if (res.data?.user && auth?.updateUser) {
                auth.updateUser(res.data.user);
            }

            router.back();
        } catch (error) {
            console.error('Failed to update profile:', error);
            Alert.alert('Error', 'Could not save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <SafeAreaView style={{ flex: 1 }}>
                {/* Nav Header */}
                <View
                    style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => ({
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1
                        })}
                    >
                        <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>

                    <Text style={{ fontSize: 17, fontFamily: Fonts.bold, color: colors.text }}>
                        Edit Profile
                    </Text>

                    {/* FIX: Nested View to guarantee background color rendering */}
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                    >
                        <View style={{
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            backgroundColor: ACTION_COLOR, // Explicit Green
                            borderRadius: 999,
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 70,
                            opacity: saving ? 0.7 : 1
                        }}>
                            {saving ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Text style={{
                                    color: '#FFFFFF',
                                    fontFamily: Fonts.bold,
                                    fontSize: 14
                                }}>
                                    Save
                                </Text>
                            )}
                        </View>
                    </Pressable>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Avatar Section */}
                        <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 24 }}>
                            <Pressable
                                onPress={pickImage}
                                style={({ pressed }) => ({
                                    position: 'relative',
                                    shadowColor: '#000',
                                    shadowOpacity: 0.1,
                                    shadowRadius: 10,
                                    shadowOffset: { width: 0, height: 4 },
                                    transform: [{ scale: pressed ? 0.98 : 1 }]
                                })}
                            >
                                <View
                                    style={{
                                        width: 120,
                                        height: 120,
                                        borderRadius: 60,
                                        borderWidth: 4,
                                        borderColor: colors.surface,
                                        backgroundColor: colors.muted,
                                        overflow: 'hidden',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {uploading ? (
                                        <ActivityIndicator color={ACTION_COLOR} />
                                    ) : avatar ? (
                                        <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <Text style={{ fontSize: 40, fontFamily: Fonts.bold, color: colors.textMuted }}>
                                            {name ? name.charAt(0).toUpperCase() : 'U'}
                                        </Text>
                                    )}
                                </View>

                                {/* Camera Badge */}
                                <View
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        backgroundColor: ACTION_COLOR,
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 3,
                                        borderColor: colors.background,
                                    }}
                                >
                                    <Ionicons name="camera" size={18} color="#FFF" />
                                </View>
                            </Pressable>

                            <Text style={{ marginTop: 16, fontFamily: Fonts.bold, color: ACTION_COLOR, fontSize: 14 }}>
                                Change Profile Photo
                            </Text>
                        </View>

                        {/* Inputs Section */}
                        <View style={{ gap: 32 }}>
                            {/* Name Field */}
                            <View>
                                <Text style={{
                                    fontFamily: Fonts.bold,
                                    fontSize: 12,
                                    color: colors.textMuted,
                                    textTransform: 'uppercase',
                                    marginBottom: 12,
                                    letterSpacing: 0.5
                                }}>
                                    Display Name
                                </Text>
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    style={{
                                        fontSize: 18,
                                        fontFamily: Fonts.bold,
                                        color: colors.text,
                                        borderBottomWidth: 1,
                                        borderBottomColor: colors.border,
                                        paddingVertical: 12,
                                    }}
                                    placeholder="Your Full Name"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>

                            {/* Bio Field */}
                            <View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <Text style={{
                                        fontFamily: Fonts.bold,
                                        fontSize: 12,
                                        color: colors.textMuted,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}>
                                        Bio
                                    </Text>
                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                        {bio.length}/150
                                    </Text>
                                </View>

                                <TextInput
                                    value={bio}
                                    onChangeText={setBio}
                                    style={{
                                        fontSize: 16,
                                        fontFamily: Fonts.regular,
                                        color: colors.text,
                                        backgroundColor: colors.surface,
                                        borderRadius: 16,
                                        padding: 16,
                                        height: 120,
                                        textAlignVertical: 'top',
                                        lineHeight: 24,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}
                                    multiline
                                    maxLength={150}
                                    placeholder="Write a short bio about yourself..."
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

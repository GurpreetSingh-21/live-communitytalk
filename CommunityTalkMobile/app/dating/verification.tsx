import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DatingAPI from '../../src/api/dating';

type VerificationPose = {
    id: string;
    instruction: string;
    referenceImageUrl: string;
};

export default function VerificationScreen() {
    const router = useRouter();
    const [pose, setPose] = useState<VerificationPose | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selfie, setSelfie] = useState<string | null>(null);

    useEffect(() => {
        loadPose();
    }, []);

    const loadPose = async () => {
        try {
            const data = await DatingAPI.getVerificationPose();
            setPose(data);
        } catch (error) {
            Alert.alert("Error", "Failed to load verification challenge.");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Permission", "Camera permission is required to verify.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.5,
            base64: true,
            cameraType: ImagePicker.CameraType.front
        });

        if (!result.canceled && result.assets[0].base64) {
            setSelfie(result.assets[0].base64);
        }
    };

    const handleSubmit = async () => {
        if (!pose || !selfie) return;

        setSubmitting(true);
        try {
            // Upload photo (get URL)
            const photoUrl = await DatingAPI.uploadPhoto(selfie);
            if (!photoUrl) throw new Error("Photo upload failed");

            // Submit Verification
            await DatingAPI.submitVerification(pose.id, photoUrl);

            Alert.alert(
                "Submission Received",
                "Thanks! We'll review your photo shortly. You'll get your Blue Tick once approved.",
                [{ text: "OK", onPress: () => router.back() }]
            );
        } catch (error) {
            Alert.alert("Error", "Failed to submit verification.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#FF4B4B" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Photo Verification</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Copy this pose</Text>
                <Text style={styles.subtitle}>
                    Take a selfie mimicking the gesture below to prove you're real.
                </Text>

                {pose && (
                    <View style={styles.card}>
                        <Image source={{ uri: pose.referenceImageUrl }} style={styles.referenceImage} />
                        <Text style={styles.instruction}>"{pose.instruction}"</Text>
                    </View>
                )}

                <View style={styles.previewContainer}>
                    {selfie ? (
                        <>
                            <Image
                                source={{ uri: `data:image/jpeg;base64,${selfie}` }}
                                style={styles.selfiePreview}
                            />
                            <TouchableOpacity onPress={takePhoto} style={styles.retakeBtn}>
                                <Text style={styles.retakeText}>Retake Photo</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={takePhoto} style={styles.cameraPlaceholder}>
                            <Ionicons name="camera" size={48} color="#666" />
                            <Text style={styles.cameraText}>Open Camera</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, (!selfie || submitting) && styles.disabledBtn]}
                    onPress={handleSubmit}
                    disabled={!selfie || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitText}>Submit for Review</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    content: { padding: 24, alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 8, color: '#333' },
    subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },

    card: {
        backgroundColor: '#F8F9FA',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        width: '100%',
        marginBottom: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3
    },
    referenceImage: { width: 120, height: 120, marginBottom: 16 },
    instruction: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'center' },

    previewContainer: { width: '100%', aspectRatio: 4 / 5, marginBottom: 24, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F0F0F0' },
    cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cameraText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#666' },
    selfiePreview: { width: '100%', height: '100%' },
    retakeBtn: { position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    retakeText: { color: '#FFF', fontWeight: '600' },

    submitButton: { width: '100%', backgroundColor: '#FF4B4B', padding: 18, borderRadius: 30, alignItems: 'center' },
    disabledBtn: { backgroundColor: '#FFBABA' },
    submitText: { color: '#FFF', fontSize: 18, fontWeight: '700' }
});

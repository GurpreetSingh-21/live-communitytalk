// app/dating/verification.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DatingAPI from '../../src/api/dating';
import { api } from '../../src/api/api';

type VerificationPose = {
    id: string;
    instruction: string;
    referenceImageUrl: string;
};

type VerificationStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

const MAX_DAILY_SUBMISSIONS = 1;

export default function VerificationScreen() {
    const router = useRouter();
    const [pose, setPose] = useState<VerificationPose | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selfie, setSelfie] = useState<string | null>(null);

    // Verification state from backend
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('NONE');
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [submittedToday, setSubmittedToday] = useState(false);

    useEffect(() => {
        loadVerificationState();
    }, []);

    const loadVerificationState = async () => {
        try {
            setLoading(true);

            // Fetch current verification status from profile
            const profile = await DatingAPI.getMyProfile();
            if (profile?.isPhotoVerified) {
                setVerificationStatus('APPROVED');
                setLoading(false);
                return;
            }

            // Fetch pending/rejected request status
            try {
                const { data } = await api.get('/api/dating/verification/status');
                if (data.status) {
                    setVerificationStatus(data.status as VerificationStatus);
                    setRejectionReason(data.adminNote || null);
                }
                // Rate limit: check if submitted in last 24h
                if (data.submittedAt) {
                    const submittedAt = new Date(data.submittedAt).getTime();
                    const oneDayMs = 24 * 60 * 60 * 1000;
                    if (Date.now() - submittedAt < oneDayMs && data.status === 'PENDING') {
                        setSubmittedToday(true);
                    }
                }
            } catch {
                // No existing request — proceed to pose screen
            }

            // Load pose challenge
            const poseData = await DatingAPI.getVerificationPose();
            setPose(poseData);
        } catch (error) {
            Alert.alert('Error', 'Failed to load verification. Please try again.');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(
                'Camera Required',
                'Camera permission is required to verify your identity.',
                [{ text: 'OK' }]
            );
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.5,
            base64: true,
            cameraType: ImagePicker.CameraType.front,
        });

        if (!result.canceled && result.assets[0].base64) {
            setSelfie(result.assets[0].base64);
        }
    };

    const handleSubmit = async () => {
        if (!pose || !selfie) return;

        // Rate limit check
        if (submittedToday) {
            Alert.alert(
                'Limit Reached',
                'You can only submit one verification per day. Please try again tomorrow.',
                [{ text: 'OK' }]
            );
            return;
        }

        setSubmitting(true);
        try {
            const photoUrl = await DatingAPI.uploadPhoto(selfie);
            if (!photoUrl) throw new Error('Photo upload failed');

            await DatingAPI.submitVerification(pose.id, photoUrl);

            setVerificationStatus('PENDING');
            setSubmittedToday(true);

            Alert.alert(
                '✅ Submitted for Review',
                'Thanks! Our team will review your photo within 24 hours. You\'ll receive your Blue Tick once approved.',
                [{ text: 'Done', onPress: () => router.back() }]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to submit verification. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 60 }} />
            </SafeAreaView>
        );
    }

    // Already verified
    if (verificationStatus === 'APPROVED') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Photo Verification</Text>
                </View>
                <View style={styles.statusCard}>
                    <View style={[styles.statusIcon, { backgroundColor: '#10B98115' }]}>
                        <Ionicons name="checkmark-circle" size={52} color="#10B981" />
                    </View>
                    <Text style={styles.statusTitle}>You're Verified!</Text>
                    <Text style={styles.statusBody}>Your blue tick is active on your dating profile.</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Pending review
    if (verificationStatus === 'PENDING' || submittedToday) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Photo Verification</Text>
                </View>
                <View style={styles.statusCard}>
                    <View style={[styles.statusIcon, { backgroundColor: '#6366F115' }]}>
                        <Ionicons name="time" size={52} color="#6366F1" />
                    </View>
                    <Text style={styles.statusTitle}>Under Review</Text>
                    <Text style={styles.statusBody}>
                        Your verification photo was submitted and is being reviewed by our team. This usually takes less than 24 hours.
                    </Text>
                    <Text style={styles.rateLimitNote}>
                        You can submit a new photo after 24 hours if this one is rejected.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Rejected — show rejection reason and allow re-submission
    const isRejected = verificationStatus === 'REJECTED' || verificationStatus === 'NEEDS_CHANGES';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Photo Verification</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Rejection notice */}
                {isRejected && (
                    <View style={styles.rejectionBanner}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rejectionTitle}>Previous Submission Rejected</Text>
                            {rejectionReason && (
                                <Text style={styles.rejectionReason}>Reason: {rejectionReason}</Text>
                            )}
                            <Text style={styles.rejectionNote}>
                                You may submit a new photo. You have {MAX_DAILY_SUBMISSIONS} attempt per day.
                            </Text>
                        </View>
                    </View>
                )}

                <Text style={styles.title}>Copy this pose</Text>
                <Text style={styles.subtitle}>
                    Take a selfie mimicking the gesture below to prove you're a real person on campus.
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
                                <Text style={styles.retakeText}>Retake</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={takePhoto} style={styles.cameraPlaceholder}>
                            <Ionicons name="camera" size={48} color="#666" />
                            <Text style={styles.cameraText}>Open Camera</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Rate limit info */}
                <View style={styles.infoRow}>
                    <Ionicons name="information-circle-outline" size={15} color="#999" />
                    <Text style={styles.infoText}>  You can submit once per day. Photos are reviewed by a human moderator.</Text>
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, (!selfie || submitting || submittedToday) && styles.disabledBtn]}
                    onPress={handleSubmit}
                    disabled={!selfie || submitting || submittedToday}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitText}>Submit for Review</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 18, fontWeight: '700' },

    content: { padding: 24, alignItems: 'center' },

    // Status screens
    statusCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 60,
    },
    statusIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    statusTitle: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 10, textAlign: 'center' },
    statusBody: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
    rateLimitNote: {
        marginTop: 16,
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20,
    },

    // Rejection banner
    rejectionBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 14,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    rejectionTitle: { fontSize: 14, fontWeight: '700', color: '#991B1B', marginBottom: 2 },
    rejectionReason: { fontSize: 13, color: '#B91C1C', marginBottom: 4 },
    rejectionNote: { fontSize: 12, color: '#6B7280' },

    title: { fontSize: 24, fontWeight: '800', marginBottom: 8, color: '#333', alignSelf: 'flex-start' },
    subtitle: {
        fontSize: 15,
        color: '#666',
        lineHeight: 22,
        marginBottom: 28,
        alignSelf: 'flex-start',
    },

    card: {
        backgroundColor: '#F8F9FA',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        width: '100%',
        marginBottom: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    referenceImage: { width: 120, height: 120, marginBottom: 16 },
    instruction: { fontSize: 17, fontWeight: '600', color: '#000', textAlign: 'center' },

    previewContainer: {
        width: '100%',
        aspectRatio: 4 / 5,
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#F0F0F0',
    },
    cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cameraText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#666' },
    selfiePreview: { width: '100%', height: '100%' },
    retakeBtn: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    retakeText: { color: '#FFF', fontWeight: '600' },

    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: 20,
    },
    infoText: { fontSize: 12, color: '#999', flex: 1, lineHeight: 18 },

    submitButton: {
        width: '100%',
        backgroundColor: '#6366F1',
        padding: 18,
        borderRadius: 30,
        alignItems: 'center',
    },
    disabledBtn: { backgroundColor: '#C7D2FE' },
    submitText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});

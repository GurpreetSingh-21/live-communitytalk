import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableWithoutFeedback, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DatingAPI, { ReportReason } from '@/src/api/dating';

const { width, height } = Dimensions.get('window');

type DatingProfile = {
    id: string;
    firstName: string;
    age: number;
    gender: string;
    major: string;
    year: string;
    bio: string;
    photos: string[];
    hobbies: string[];
    collegeName?: string;
    isVerified?: boolean; // controls the blue tick
};

interface DatingCardProps {
    profile: DatingProfile;
}

export default function DatingCard({ profile }: DatingCardProps) {
    const [photoIndex, setPhotoIndex] = useState(0);

    const handleTap = (evt: any) => {
        const locationX = evt.nativeEvent.locationX;
        if (locationX > width / 2) {
            if (photoIndex < profile.photos.length - 1) setPhotoIndex(photoIndex + 1);
            else setPhotoIndex(0);
        } else {
            if (photoIndex > 0) setPhotoIndex(photoIndex - 1);
            else setPhotoIndex(profile.photos.length - 1);
        }
    };

    const handleReport = () => {
        const reasons: { label: string; value: ReportReason }[] = [
            { label: 'Fake Profile or Impersonation', value: 'FAKE_PROFILE' },
            { label: 'Inappropriate Photos', value: 'INAPPROPRIATE_PHOTOS' },
            { label: 'Harassment or Bullying', value: 'HARASSMENT' },
            { label: 'Spam or Scam', value: 'SPAM' },
            { label: 'Appears to Be Underage', value: 'UNDERAGE' },
            { label: 'Hate Speech or Discrimination', value: 'HATE_SPEECH' },
            { label: 'Other', value: 'OTHER' },
        ];

        Alert.alert(
            `Report ${profile.firstName}`,
            'Why are you reporting this profile?',
            [
                ...reasons.map(r => ({
                    text: r.label,
                    onPress: async () => {
                        try {
                            await DatingAPI.reportProfile(profile.id, r.value);
                            Alert.alert(
                                'Report Submitted',
                                'Thank you. Our team will review this profile within 24 hours.'
                            );
                        } catch {
                            Alert.alert('Error', 'Failed to submit report. Please try again.');
                        }
                    },
                })),
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    return (
        <TouchableWithoutFeedback onPress={handleTap}>
            <View style={styles.card}>
                {/* Photo Layer */}
                <Image
                    source={{ uri: profile.photos[photoIndex] }}
                    style={styles.image}
                    resizeMode="cover"
                />

                {/* Gradient Overlay */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)', '#000']}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.gradient}
                >
                    {/* Content */}
                    <View style={styles.content}>
                        {/* College Badge */}
                        {profile.collegeName && (
                            <View style={styles.collegeBadge}>
                                <Text style={styles.college}>{profile.collegeName}</Text>
                            </View>
                        )}

                    <View style={styles.headerRow}>
                            <Text style={styles.name}>{profile.firstName}, {profile.age}</Text>
                            {/* Only show verified badge if the profile is actually verified */}
                            {profile.isVerified && (
                                <Ionicons name="checkmark-circle" size={26} color="#4C5FD5" />
                            )}
                        </View>

                        <Text style={styles.subtext}>{profile.major} • {profile.year}</Text>

                        {/* Divider or spacing? */}
                        <View style={{ height: 12 }} />

                        <View style={styles.chipRow}>
                            {profile.hobbies.slice(0, 4).map((h, i) => (
                                <View key={i} style={styles.chip}>
                                    <Text style={styles.chipText}>{h}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </LinearGradient>

                {/* Report Button */}
                <TouchableOpacity
                    style={styles.reportButton}
                    onPress={handleReport}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>

                {/* Photo Indicators */}
                <View style={styles.indicatorContainer}>
                    {profile.photos.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.indicatorBar,
                                { backgroundColor: i === photoIndex ? '#FFF' : 'rgba(255,255,255,0.3)' }
                            ]}
                        />
                    ))}
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    card: {
        width: width - 24,
        height: height * 0.62, // Reduced height for split layout
        borderRadius: 32,
        backgroundColor: '#1A1A1A',
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
        position: 'relative',
        marginBottom: 20 // Slight spacing from buttons
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '45%',
        justifyContent: 'flex-end',
        paddingHorizontal: 24,
        paddingBottom: 32
    },
    content: {
        gap: 8
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
    },
    name: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4
    },
    subtext: {
        fontSize: 17,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: 0.3
    },
    collegeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    college: {
        fontSize: 13,
        color: '#FFF',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    bio: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 22,
        marginBottom: 16,
        fontWeight: '500'
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    chip: {
        backgroundColor: 'rgba(255,255,255,0.2)', // Glass effect
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)' // Note: native blur needs Expo BlurView usually
    },
    chipText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3
    },
    indicatorContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        flexDirection: 'row',
        gap: 6,
        height: 4
    },
    indicatorBar: {
        flex: 1,
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)'
    },
    reportButton: {
        position: 'absolute',
        top: 48,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 20,
        padding: 8,
        zIndex: 10,
    },
});

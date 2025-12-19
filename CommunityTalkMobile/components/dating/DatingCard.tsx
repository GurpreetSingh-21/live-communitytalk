import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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
};

interface DatingCardProps {
    profile: DatingProfile;
}

export default function DatingCard({ profile }: DatingCardProps) {
    const [photoIndex, setPhotoIndex] = useState(0);

    const handleTap = (evt: any) => {
        const locationX = evt.nativeEvent.locationX;
        if (locationX > width / 2) {
            // Next photo
            if (photoIndex < profile.photos.length - 1) {
                setPhotoIndex(photoIndex + 1);
            } else {
                setPhotoIndex(0); // Loop back? Or stop? Let's loop for now.
            }
        } else {
            // Prev photo
            if (photoIndex > 0) {
                setPhotoIndex(photoIndex - 1);
            } else {
                setPhotoIndex(profile.photos.length - 1);
            }
        }
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
                    colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
                    style={styles.gradient}
                >
                    {/* Content */}
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={styles.name}>{profile.firstName}, {profile.age}</Text>
                            <Ionicons name="checkmark-circle" size={24} color="#4C5FD5" style={{ marginLeft: 6 }} />
                        </View>

                        <Text style={styles.subtext}>{profile.major} • {profile.year}</Text>
                        {profile.collegeName && <Text style={styles.college}>{profile.collegeName}</Text>}

                        <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text>

                        <View style={styles.chipRow}>
                            {profile.hobbies.slice(0, 3).map((h, i) => (
                                <View key={i} style={styles.chip}>
                                    <Text style={styles.chipText}>{h}</Text>
                                </View>
                            ))}
                            {profile.hobbies.length > 3 && (
                                <View style={styles.chip}>
                                    <Text style={styles.chipText}>+{profile.hobbies.length - 3}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </LinearGradient>

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
        width: width - 20, // slightly smaller than screen width
        height: height * 0.75, // fixed height for stack
        borderRadius: 20,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        position: 'relative'
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
        height: '50%',
        justifyContent: 'flex-end',
        padding: 20
    },
    content: {
        marginBottom: 10
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    name: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF'
    },
    subtext: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 4
    },
    college: {
        fontSize: 14,
        color: '#FF6B6B', // Brand accent?
        fontWeight: '700',
        marginBottom: 12
    },
    bio: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 22,
        marginBottom: 16
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    chip: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    chipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600'
    },
    indicatorContainer: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        gap: 4
    },
    indicatorBar: {
        flex: 1,
        height: 4,
        borderRadius: 2
    }
});

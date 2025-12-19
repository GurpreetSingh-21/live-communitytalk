import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { api } from '@/src/api/api';
import DatingCard from './DatingCard';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

export default function SwipingDeck() {
    const [pool, setPool] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchModalVisible, setMatchModalVisible] = useState(false);
    const [lastMatch, setLastMatch] = useState<any>(null);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        fetchPool();
    }, []);

    const fetchPool = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/dating/pool');
            setPool(data.pool || []);
        } catch (err) {
            console.error("Fetch pool error:", err);
            Alert.alert("Error", "Failed to load profiles.");
        } finally {
            setLoading(false);
        }
    };

    const handleSwipeComplete = async (direction: 'left' | 'right' | 'up') => {
        const currentProfile = pool[0];
        if (!currentProfile) return;

        // Optimistic UI: Remove card immediately
        const nextPool = pool.slice(1);
        setPool(nextPool);
        translateX.value = 0;
        translateY.value = 0;

        // Call API
        try {
            const type = direction === 'right' ? 'LIKE' : direction === 'left' ? 'DISLIKE' : 'SUPERLIKE';
            const { data } = await api.post('/api/dating/swipe', {
                targetUserId: currentProfile.userId, // CAUTION: API expects userId or profileId? 
                // datingRoutes.js uses `targetUserId` in body.
                type
            });

            if (data.match) {
                // It's a match!
                setLastMatch(data.match); // Contains partner profile info
                setMatchModalVisible(true);
                Alert.alert("It's a Match!", `You matched with ${currentProfile.firstName}!`);
                // TODO: Show nice modal
            }
        } catch (err) {
            console.error("Swipe error:", err);
            // If error, maybe put card back? For now, ignore.
        }
    };

    /* ──────────────────────────────────────────────────────────────────────────
       GESTURE
       ────────────────────────────────────────────────────────────────────────── */
    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
                // Swipe detected
                const direction = event.translationX > 0 ? 'right' : 'left';
                // Animate off screen
                translateX.value = withSpring(direction === 'right' ? width * 1.5 : -width * 1.5);
                runOnJS(handleSwipeComplete)(direction);
            } else {
                // Return to center
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
            }
        });

    /* ──────────────────────────────────────────────────────────────────────────
       ANIMATIONS
       ────────────────────────────────────────────────────────────────────────── */
    const animatedCardStyle = useAnimatedStyle(() => {
        const rotate = interpolate(
            translateX.value,
            [-width / 2, 0, width / 2],
            [-10, 0, 10], // degrees
            Extrapolation.CLAMP
        );

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotate}deg` }
            ]
        };
    });

    const nextCardOpacity = useAnimatedStyle(() => {
        const opacity = interpolate(
            Math.abs(translateX.value),
            [0, width / 2],
            [0.5, 1],
            Extrapolation.CLAMP
        );
        const scale = interpolate(
            Math.abs(translateX.value),
            [0, width / 2],
            [0.9, 1],
            Extrapolation.CLAMP
        );
        return {
            opacity,
            transform: [{ scale }]
        };
    });

    /* ──────────────────────────────────────────────────────────────────────────
       RENDER
       ────────────────────────────────────────────────────────────────────────── */
    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF6B6B" />
                <Text style={styles.text}>Finding people nearby...</Text>
            </View>
        );
    }

    if (pool.length === 0) {
        return (
            <View style={styles.center}>
                <View style={styles.circle}>
                    <Ionicons name="search" size={50} color="#CCC" />
                </View>
                <Text style={styles.title}>No more profiles</Text>
                <Text style={styles.text}>Check back later for new people.</Text>
                <TouchableOpacity style={styles.button} onPress={fetchPool}>
                    <Text style={styles.buttonText}>Refresh</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Next Card (Underneath) */}
            {pool.length > 1 && (
                <Animated.View style={[styles.cardWrapper, styles.nextCard, nextCardOpacity]}>
                    <DatingCard profile={pool[1]} />
                </Animated.View>
            )}

            {/* Top Card */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.cardWrapper, animatedCardStyle]}>
                    <DatingCard profile={pool[0]} />

                    {/* Overlay Labels (Like/Nope) */}
                    {/* Can implement animated overlay here based on translateX */}
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    },
    cardWrapper: {
        position: 'absolute',
        width: width - 20,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    nextCard: {
        zIndex: -1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    circle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10
    },
    text: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    },
    button: {
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#FF6B6B',
        borderRadius: 20
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '600'
    }
});

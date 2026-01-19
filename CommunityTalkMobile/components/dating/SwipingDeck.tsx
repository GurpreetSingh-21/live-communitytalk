import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator, Alert, TouchableOpacity, Image } from 'react-native';
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
import SwipeOverlay from './SwipeOverlay';
import ActionButtons from './ActionButtons';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

export default function SwipingDeck() {
    const [pool, setPool] = useState<any[]>([]);
    const [activeIndex, setActiveIndex] = useState(0); // Add active index pointer
    const [loading, setLoading] = useState(true);
    const [matchModalVisible, setMatchModalVisible] = useState(false);
    const [lastMatch, setLastMatch] = useState<any>(null);
    const [limitReached, setLimitReached] = useState(false); // Toast state

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        fetchPool();
    }, []);

    const fetchPool = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/dating/pool');
            setPool(Array.isArray(data) ? data : []);
            setActiveIndex(0); // Reset index on fresh fetch
        } catch (err) {
            console.error("Fetch pool error:", err);
            Alert.alert("Error", "Failed to load profiles.");
        } finally {
            setLoading(false);
        }
    };

    // Prefetch images for smooth swiping
    useEffect(() => {
        if (pool.length > 0) {
            const profilesToPrefetch = pool.slice(activeIndex, activeIndex + 5);
            profilesToPrefetch.forEach(p => {
                if (p.photos?.[0]) {
                    Image.prefetch(p.photos[0]).catch(e => console.log("Prefetch failed", e));
                }
            });
        }
    }, [pool, activeIndex]);

    const handleSwipeComplete = async (direction: 'left' | 'right' | 'up') => {
        const currentProfile = pool[activeIndex];
        if (!currentProfile) return;

        const previousIndex = activeIndex;

        // Optimistic UI: Update POINTER
        // Keyed rendering will handle the transition
        setActiveIndex(prev => prev + 1);

        // Reset animation values for the NEW top card (which was previously the Next Card)
        translateX.value = 0;
        translateY.value = 0;

        // Call API
        try {
            const type = direction === 'right' ? 'LIKE' : direction === 'left' ? 'DISLIKE' : 'SUPERLIKE';
            const { data } = await api.post('/api/dating/swipe', {
                targetId: currentProfile.id,
                type
            });

            if (data.match) {
                setLastMatch(data.match);
                setMatchModalVisible(true);
                Alert.alert("It's a Match!", `You matched with ${currentProfile.firstName}!`);
            }
        } catch (err: any) {
            console.error("Swipe error:", err);

            // Revert state on error (especially Limit Reached)
            if (err.response?.status === 429) {
                // Show custom toast instead of alert
                setLimitReached(true);
                // Put card back
                setActiveIndex(previousIndex);
            }
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
                const direction = event.translationX > 0 ? 'right' : 'left';
                translateX.value = withSpring(direction === 'right' ? width * 1.5 : -width * 1.5);
                runOnJS(handleSwipeComplete)(direction);
            } else {
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
                { rotate: `${rotate}deg` },
                { scale: 1 } // Ensure full scale
            ],
            zIndex: 2 // Top card
        };
    });

    const nextCardOpacity = useAnimatedStyle(() => {
        const scale = interpolate(
            Math.abs(translateX.value),
            [0, width / 2],
            [0.9, 1],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ scale }],
            opacity: 1, // Keep visible
            zIndex: 1 // Bottom card
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

    if (pool.length === 0 || activeIndex >= pool.length) {
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

    // Current pointers
    const currentProfile = pool[activeIndex];
    const nextProfile = pool[activeIndex + 1];

    /* ──────────────────────────────────────────────────────────────────────────
       BUTTON HANDLERS
       ────────────────────────────────────────────────────────────────────────── */
    const triggerSwipe = (direction: 'left' | 'right' | 'up') => {
        const destX = direction === 'left' ? -width * 1.5 : direction === 'right' ? width * 1.5 : 0;
        const destY = direction === 'up' ? -1000 : 0;

        if (direction === 'up') {
            translateY.value = withSpring(destY, {}, () => {
                runOnJS(handleSwipeComplete)(direction);
            });
        } else {
            translateX.value = withSpring(destX, {}, () => {
                runOnJS(handleSwipeComplete)(direction);
            });
        }
    };

    return (
        <View style={styles.container}>
            {/* KEYED RENDER: Only render Top 2 Cards. Reverse order so Top is last (highest z-index) */}
            {pool.slice(activeIndex, activeIndex + 2).reverse().map((profile, index) => {
                const isTop = profile.id === pool[activeIndex].id;

                if (isTop) {
                    return (
                        <GestureDetector key={profile.id} gesture={panGesture}>
                            <Animated.View style={[styles.cardWrapper, animatedCardStyle]}>
                                <DatingCard profile={profile} />
                                <SwipeOverlay translateX={translateX} translateY={translateY} />
                            </Animated.View>
                        </GestureDetector>
                    );
                } else {
                    return (
                        <Animated.View
                            key={profile.id}
                            style={[styles.cardWrapper, styles.nextCard, nextCardOpacity]}
                        >
                            <DatingCard profile={profile} />
                        </Animated.View>
                    );
                }
            })}

            {/* Action Buttons */}
            <ActionButtons
                onNope={() => triggerSwipe('left')}
                onLike={() => triggerSwipe('right')}
                onSuperLike={() => triggerSwipe('up')}
                onBoost={() => Alert.alert("Boost", "Feature coming soon!")}
            />

            {/* Premium Toast Overlay */}
            <LimitToast visible={limitReached} onClose={() => setLimitReached(false)} />
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-DEFINED TOAST COMPONENT (Normally in separate file)
// ─────────────────────────────────────────────────────────────────────────────
function LimitToast({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    if (!visible) return null;

    return (
        <View style={toastStyles.overlay}>
            <View style={toastStyles.container}>
                <View style={toastStyles.iconCircle}>
                    <Ionicons name="time" size={32} color="#FF6B6B" />
                </View>
                <Text style={toastStyles.title}>Daily Limit Reached</Text>
                <Text style={toastStyles.message}>
                    You've swiped 5 times today. Wait for tomorrow or upgrade for unlimited swipes!
                </Text>

                <TouchableOpacity style={toastStyles.primaryButton} onPress={() => Alert.alert("Premium", "Upgrade flow coming soon!")}>
                    <Text style={toastStyles.primaryButtonText}>Go Premium ✨</Text>
                </TouchableOpacity>

                <TouchableOpacity style={toastStyles.secondaryButton} onPress={onClose}>
                    <Text style={toastStyles.secondaryButtonText}>I'll wait</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const toastStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: 20
    },
    container: {
        backgroundColor: '#FFF',
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    iconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFF0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 8,
        textAlign: 'center'
    },
    message: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24
    },
    primaryButton: {
        backgroundColor: '#FF6B6B',
        paddingVertical: 14,
        width: '100%',
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: "#FF6B6B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700'
    },
    secondaryButton: {
        paddingVertical: 10,
    },
    secondaryButtonText: {
        color: '#999',
        fontSize: 15,
        fontWeight: '600'
    }
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    },
    cardWrapper: {
        position: 'absolute',
        width: width, // Full width to allow overlay to work properly
        height: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start', // Align to top
        paddingTop: 10, // Slight top spacing
        zIndex: 10
    },
    nextCard: {
        zIndex: 1,
        transform: [{ scale: 0.95 }, { translateY: 10 }] // Stack effect
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

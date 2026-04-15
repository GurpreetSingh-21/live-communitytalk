// components/dating/MatchModal.tsx
import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Dimensions,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
    withSequence,
    withTiming,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/thumbs/png?seed=campustry';

interface MatchModalProps {
    visible: boolean;
    onClose: () => void;
    matchData: {
        matchId?: string;
        partnerFirstName: string;
        partnerPhoto?: string | null;
        myPhoto?: string | null;
        partnerUserId?: string;
    } | null;
}

export default function MatchModal({ visible, onClose, matchData }: MatchModalProps) {
    const router = useRouter();

    // Animation values
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const heartScale = useSharedValue(0);
    const slideY = useSharedValue(60);
    const sparkleOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Sequence: background fades in → portraits scale in → heart bounces → text slides up → sparkles
            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 180 }));
            heartScale.value = withDelay(500, withSequence(
                withSpring(1.4, { damping: 6, stiffness: 300 }),
                withSpring(1.0, { damping: 10 })
            ));
            slideY.value = withDelay(400, withSpring(0, { damping: 14 }));
            sparkleOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
        } else {
            // Reset
            scale.value = 0;
            opacity.value = 0;
            heartScale.value = 0;
            slideY.value = 60;
            sparkleOpacity.value = 0;
        }
    }, [visible]);

    const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const portraitStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }],
    }));
    const textStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideY.value }],
        opacity: opacity.value,
    }));
    const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkleOpacity.value }));

    if (!matchData) return null;

    const handleMessage = () => {
        onClose();
        if (matchData.partnerUserId) {
            router.push({
                pathname: '/dm/[id]',
                params: { id: matchData.partnerUserId, name: matchData.partnerFirstName, type: 'dating' }
            });
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <Animated.View style={[styles.overlay, overlayStyle]}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Gradient background */}
                <LinearGradient
                    colors={['rgba(99,102,241,0.9)', 'rgba(168,85,247,0.85)', 'rgba(236,72,153,0.8)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />

                {/* Sparkle dots */}
                <Animated.View style={[styles.sparkleContainer, sparkleStyle]} pointerEvents="none">
                    {SPARKLE_POSITIONS.map((pos, i) => (
                        <View
                            key={i}
                            style={[styles.sparkle, {
                                top: pos.top,
                                left: pos.left,
                                width: pos.size,
                                height: pos.size,
                                borderRadius: pos.size / 2,
                                backgroundColor: pos.color,
                                opacity: pos.opacity,
                            }]}
                        />
                    ))}
                </Animated.View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Title */}
                    <Animated.View style={[styles.titleRow, textStyle]}>
                        <Text style={styles.itsA}>It's a</Text>
                        <Text style={styles.matchWord}>Match!</Text>
                    </Animated.View>

                    {/* Portraits */}
                    <Animated.View style={[styles.portraits, portraitStyle]}>
                        {/* My Photo */}
                        <View style={[styles.portraitWrapper, styles.portraitLeft]}>
                            <Image
                                source={{ uri: matchData.myPhoto || DEFAULT_AVATAR }}
                                style={styles.portrait}
                            />
                        </View>

                        {/* Heart */}
                        <Animated.View style={[styles.heartBadge, heartStyle]}>
                            <Ionicons name="heart" size={28} color="#FFF" />
                        </Animated.View>

                        {/* Partner Photo */}
                        <View style={[styles.portraitWrapper, styles.portraitRight]}>
                            <Image
                                source={{ uri: matchData.partnerPhoto || DEFAULT_AVATAR }}
                                style={styles.portrait}
                            />
                        </View>
                    </Animated.View>

                    {/* Subtitle */}
                    <Animated.Text style={[styles.subtitle, textStyle]}>
                        You and <Text style={styles.name}>{matchData.partnerFirstName}</Text> liked each other.
                    </Animated.Text>

                    {/* CTA Buttons */}
                    <Animated.View style={[styles.buttons, textStyle]}>
                        <TouchableOpacity
                            style={styles.messageBtn}
                            onPress={handleMessage}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="chatbubble-ellipses" size={18} color="#6366F1" style={{ marginRight: 8 }} />
                            <Text style={styles.messageBtnText}>Send a Message</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.keepSwipingBtn}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.keepSwipingText}>Keep Swiping</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Animated.View>
        </Modal>
    );
}

// Random-looking but deterministic sparkle positions
const SPARKLE_POSITIONS = [
    { top: '8%', left: '10%', size: 10, color: '#FFF', opacity: 0.6 },
    { top: '12%', left: '85%', size: 7, color: '#FDE68A', opacity: 0.8 },
    { top: '22%', left: '5%', size: 5, color: '#FFF', opacity: 0.4 },
    { top: '70%', left: '88%', size: 8, color: '#FDE68A', opacity: 0.7 },
    { top: '75%', left: '6%', size: 6, color: '#FFF', opacity: 0.5 },
    { top: '85%', left: '50%', size: 9, color: '#FDD', opacity: 0.5 },
    { top: '30%', left: '92%', size: 5, color: '#FFF', opacity: 0.4 },
    { top: '45%', left: '3%', size: 11, color: '#FDE68A', opacity: 0.6 },
];

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sparkleContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    sparkle: {
        position: 'absolute',
    },
    content: {
        width: width * 0.88,
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    titleRow: {
        alignItems: 'center',
        marginBottom: 36,
    },
    itsA: {
        fontSize: 22,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
        letterSpacing: 1,
        marginBottom: 2,
    },
    matchWord: {
        fontSize: 60,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    portraits: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
        position: 'relative',
    },
    portraitWrapper: {
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 4,
        borderColor: '#FFF',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    portrait: {
        width: '100%',
        height: '100%',
    },
    portraitLeft: {
        marginRight: -18,
        zIndex: 1,
    },
    portraitRight: {
        marginLeft: -18,
        zIndex: 1,
    },
    heartBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        marginBottom: 36,
        lineHeight: 24,
    },
    name: {
        fontWeight: '700',
        color: '#FFF',
    },
    buttons: {
        width: '100%',
        gap: 12,
    },
    messageBtn: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    messageBtnText: {
        color: '#6366F1',
        fontSize: 16,
        fontWeight: '700',
    },
    keepSwipingBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    keepSwipingText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 15,
        fontWeight: '500',
    },
});

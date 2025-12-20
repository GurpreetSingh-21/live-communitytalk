import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence, withDelay } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { height } = Dimensions.get('window');

interface ActionButtonsProps {
    onNope: () => void;
    onLike: () => void;
    onSuperLike: () => void;
    onBoost: () => void;
}

export default function ActionButtons({ onNope, onLike, onSuperLike, onBoost }: ActionButtonsProps) {
    return (
        <View style={styles.floatingContainer}>
            <BlurView intensity={0} tint="light" style={styles.blurContainer}>
                {/* NOPE */}
                <ActionButton
                    icon="close-outline"
                    color="#FF4458"
                    size={28}
                    onPress={onNope}
                />

                {/* SUPER LIKE */}
                <ActionButton
                    icon="star"
                    color="#4C5FD5"
                    size={20}
                    small
                    onPress={onSuperLike}
                    delay={100}
                />

                {/* BOOST */}
                <ActionButton
                    icon="flash"
                    color="#A537FD"
                    size={20}
                    small
                    onPress={onBoost}
                    delay={200}
                />

                {/* LIKE */}
                <ActionButton
                    icon="heart"
                    color="#4CE0B3"
                    size={28}
                    onPress={onLike}
                    delay={300}
                    highlight
                />
            </BlurView>
        </View>
    );
}

interface ButtonProps {
    icon: any;
    color: string;
    size: number;
    small?: boolean;
    onPress: () => void;
    delay?: number;
    highlight?: boolean;
}

function ActionButton({ icon, color, size, small, onPress, delay = 0, highlight }: ButtonProps) {
    const scale = useSharedValue(0);

    useEffect(() => {
        scale.value = withDelay(delay, withSpring(1));
    }, []);

    const handlePress = () => {
        scale.value = withSequence(
            withSpring(0.8),
            withSpring(1)
        );
        onPress();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
            <Animated.View style={[
                styles.button,
                {
                    width: small ? 42 : 54,
                    height: small ? 42 : 54,
                    backgroundColor: highlight ? '#FFF' : 'rgba(255,255,255,0.9)',
                },
                animatedStyle
            ]}>
                <Ionicons name={icon} size={size} color={color} />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        // Position relative to top now, to stay close to card
        top: height * 0.65, // Card ends at ~0.62 + padding
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    blurContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        gap: 24,
        backgroundColor: 'transparent'
    },
    button: {
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)'
    }
});

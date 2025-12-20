import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface SwipeOverlayProps {
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
}

export default function SwipeOverlay({ translateX, translateY }: SwipeOverlayProps) {
    const likeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateX.value,
            [0, 50],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const nopeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateX.value,
            [-50, 0],
            [1, 0],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    /* 
    // Future Super Like implementation
    const superLikeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateY.value,
            [-50, 0],
            [1, 0],
            Extrapolation.CLAMP
        );
        return { opacity };
    });
    */

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* LIKE OVERLAY */}
            <Animated.View style={[styles.overlayLabel, styles.likeLabel, likeStyle]}>
                <Ionicons name="heart" size={100} color="#4CE0B3" />
                <Text style={styles.likeText}>LIKE</Text>
            </Animated.View>

            {/* NOPE OVERLAY */}
            <Animated.View style={[styles.overlayLabel, styles.nopeLabel, nopeStyle]}>
                <Ionicons name="close-circle" size={100} color="#FF4458" />
                <Text style={styles.nopeText}>NOPE</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlayLabel: {
        position: 'absolute',
        top: 40,
        padding: 10,
        borderWidth: 4,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-30deg' }], // Default rotation
    },
    likeLabel: {
        left: 40,
        borderColor: '#4CE0B3',
        transform: [{ rotate: '-30deg' }],
    },
    nopeLabel: {
        right: 40,
        borderColor: '#FF4458',
        transform: [{ rotate: '30deg' }],
    },
    likeText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#4CE0B3',
        letterSpacing: 2
    },
    nopeText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FF4458',
        letterSpacing: 2
    }
});

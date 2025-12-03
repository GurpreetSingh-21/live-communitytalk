import React from 'react';
import {
    View,
    Modal,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface ImageViewerModalProps {
    visible: boolean;
    imageUrl: string;
    onClose: () => void;
}

export default function ImageViewerModal({
    visible,
    imageUrl,
    onClose,
}: ImageViewerModalProps) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StatusBar hidden />
            <View style={styles.container}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="close-circle" size={32} color="white" />
                </TouchableOpacity>

                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.image}
                        contentFit="contain"
                        transition={200}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.9)',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        opacity: 0.8,
    },
    imageContainer: {
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});

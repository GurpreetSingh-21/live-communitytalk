import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Platform,
    TouchableWithoutFeedback,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface MessageActionSheetProps {
    visible: boolean;
    onClose: () => void;
    onReaction: (emoji: string) => void;
    onAction: (action: 'reply' | 'copy' | 'delete' | 'forward') => void;
    isOwnMessage: boolean;
    messageContent?: string;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🚀'];

export default function MessageActionSheet({
    visible,
    onClose,
    onReaction,
    onAction,
    isOwnMessage,
}: MessageActionSheetProps) {
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    const handleAction = (action: 'reply' | 'copy' | 'delete' | 'forward') => {
        Haptics.selectionAsync();
        onAction(action);
        onClose();
    };

    const handleReaction = (emoji: string) => {
        Haptics.selectionAsync();
        onReaction(emoji);
        onClose();
    };

    return (
        <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
                </Animated.View>
            </TouchableWithoutFeedback>

            <View style={styles.container} pointerEvents="box-none">
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            transform: [{ translateY }],
                            opacity: slideAnim,
                        },
                    ]}
                >
                    {/* Reaction Bar */}
                    <View style={styles.reactionContainer}>
                        {EMOJIS.map((emoji) => (
                            <TouchableOpacity
                                key={emoji}
                                style={styles.emojiButton}
                                onPress={() => handleReaction(emoji)}
                            >
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.addReactionButton}>
                            <Ionicons name="add" size={20} color="#A1A1AA" />
                        </TouchableOpacity>
                    </View>

                    {/* Actions List */}
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => handleAction('reply')}
                        >
                            <Text style={styles.actionText}>Reply</Text>
                            <Ionicons name="arrow-undo-outline" size={22} color="#E4E4E7" />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => handleAction('copy')}
                        >
                            <Text style={styles.actionText}>Copy Text</Text>
                            <Ionicons name="copy-outline" size={22} color="#E4E4E7" />
                        </TouchableOpacity>

                        {isOwnMessage && (
                            <>
                                <View style={styles.separator} />
                                <TouchableOpacity
                                    style={styles.actionRow}
                                    onPress={() => handleAction('delete')}
                                >
                                    <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 40,
        paddingHorizontal: 16,
    },
    sheet: {
        width: '100%',
    },
    reactionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#27272A',
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    emojiButton: {
        padding: 4,
    },
    emojiText: {
        fontSize: 24,
    },
    addReactionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3F3F46',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsContainer: {
        backgroundColor: '#27272A',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#27272A',
    },
    actionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#E4E4E7',
    },
    deleteText: {
        color: '#EF4444',
    },
    separator: {
        height: 1,
        backgroundColor: '#3F3F46',
        marginLeft: 16,
    },
});

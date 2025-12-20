// CommunityTalkMobile/components/safety/BlockConfirmation.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    ActivityIndicator,
    Alert,
    useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/api';

interface BlockConfirmationProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    profileId: string;
    userName: string;
}

export function BlockConfirmation({
    visible,
    onClose,
    onSuccess,
    profileId,
    userName,
}: BlockConfirmationProps) {
    const isDark = useColorScheme() === 'dark';
    const [isBlocking, setIsBlocking] = useState(false);

    const bg = isDark ? '#020617' : '#FFFFFF';
    const textPrimary = isDark ? '#F9FAFB' : '#020617';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

    const handleBlock = async () => {
        setIsBlocking(true);

        try {
            await api.post(`/api/dating/block/${profileId}`);

            Alert.alert(
                'User Blocked',
                `${userName} has been blocked. You will no longer see each other's profiles.`,
                [{ text: 'OK', onPress: onSuccess }]
            );
        } catch (err: any) {
            console.error('Failed to block user:', err);
            Alert.alert(
                'Error',
                err?.response?.data?.error || 'Failed to block user. Please try again.'
            );
            setIsBlocking(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/70 justify-center items-center px-5">
                <View
                    style={{ backgroundColor: bg }}
                    className="w-full max-w-md rounded-3xl p-6"
                >
                    {/* Icon */}
                    <View
                        className="w-16 h-16 rounded-full items-center justify-center self-center mb-4"
                        style={{ backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' }}
                    >
                        <Ionicons
                            name="hand-left"
                            size={32}
                            color={isDark ? '#FCA5A5' : '#DC2626'}
                        />
                    </View>

                    {/* Title */}
                    <Text
                        className="text-2xl font-bold text-center mb-2"
                        style={{ color: textPrimary }}
                    >
                        Block {userName}?
                    </Text>

                    {/* Description */}
                    <Text
                        className="text-sm text-center leading-6 mb-6"
                        style={{ color: textSecondary }}
                    >
                        Blocking this user will:
                    </Text>

                    {/* What Happens List */}
                    <View className="mb-6 space-y-3">
                        {[
                            { icon: 'eye-off', text: 'Hide your profiles from each other' },
                            { icon: 'close-circle', text: 'Remove any existing match' },
                            { icon: 'chatbox-ellipses-outline', text: 'Hide all messages between you' },
                            { icon: 'ban', text: 'Prevent future matches' },
                        ].map((item, index) => (
                            <View key={index} className="flex-row items-center">
                                <View
                                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                                    style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}
                                >
                                    <Ionicons
                                        name={item.icon as any}
                                        size={16}
                                        color={isDark ? '#EF4444' : '#DC2626'}
                                    />
                                </View>
                                <Text className="flex-1 text-sm" style={{ color: textPrimary }}>
                                    {item.text}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Info Note */}
                    <View
                        className="p-3 rounded-xl mb-6"
                        style={{ backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }}
                    >
                        <View className="flex-row items-start">
                            <Ionicons
                                name="information-circle"
                                size={16}
                                color={isDark ? '#93C5FD' : '#1E40AF'}
                                style={{ marginRight: 8, marginTop: 2 }}
                            />
                            <Text
                                className="flex-1 text-xs leading-5"
                                style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}
                            >
                                You can unblock this user later from your settings. They will NOT be notified
                                that you blocked them.
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="space-y-3">
                        <Pressable
                            onPress={handleBlock}
                            disabled={isBlocking}
                            className="py-4 rounded-xl items-center"
                            style={{ backgroundColor: isBlocking ? '#9CA3AF' : '#EF4444' }}
                        >
                            {isBlocking ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text className="text-white text-base font-bold">Yes, Block This User</Text>
                            )}
                        </Pressable>

                        <Pressable
                            onPress={onClose}
                            disabled={isBlocking}
                            className="py-4 rounded-xl items-center border"
                            style={{
                                borderColor: isDark ? '#374151' : '#D1D5DB',
                                backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                                opacity: isBlocking ? 0.5 : 1,
                            }}
                        >
                            <Text className="text-base font-semibold" style={{ color: textPrimary }}>
                                Cancel
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

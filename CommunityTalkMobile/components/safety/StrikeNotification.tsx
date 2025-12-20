// CommunityTalkMobile/components/safety/StrikeNotification.tsx
import React from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

type StrikeSeverity = 'MINOR' | 'MODERATE' | 'SEVERE';

interface Strike {
    id: string;
    reason: string;
    severity: StrikeSeverity;
    details?: string;
    createdAt: string;
    expiresAt?: string;
}

interface StrikeNotificationProps {
    visible: boolean;
    onClose: () => void;
    strike: Strike;
    strikeCount: number;
    accountStatus: string;
    suspendedUntil?: string;
}

export function StrikeNotification({
    visible,
    onClose,
    strike,
    strikeCount,
    accountStatus,
    suspendedUntil,
}: StrikeNotificationProps) {
    const isDark = useColorScheme() === 'dark';

    const bg = isDark ? '#020617' : '#FFFFFF';
    const textPrimary = isDark ? '#F9FAFB' : '#020617';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

    const getSeverityColor = (severity: StrikeSeverity) => {
        switch (severity) {
            case 'MINOR':
                return '#F59E0B'; // Amber
            case 'MODERATE':
                return '#EF4444'; // Red
            case 'SEVERE':
                return '#7F1D1D'; // Dark red
            default:
                return '#6B7280';
        }
    };

    const getSeverityIcon = (severity: StrikeSeverity) => {
        switch (severity) {
            case 'MINOR':
                return 'alert-circle';
            case 'MODERATE':
                return 'warning';
            case 'SEVERE':
                return 'alert';
            default:
                return 'alert-circle';
        }
    };

    const getConsequenceText = () => {
        if (strikeCount >= 3) {
            return 'Your account has been permanently banned for violating our community guidelines.';
        }
        if (strikeCount === 2) {
            return `Your account has been suspended for 30 days. You can still view content but cannot interact.`;
        }
        if (strikeCount === 1) {
            return 'This is a warning. Your account remains active, but further violations may result in suspension or ban.';
        }
        return '';
    };

    const getNextStepText = () => {
        if (strikeCount >= 3) {
            return 'You have one chance to appeal this decision. If you believe this was a mistake, you can submit an appeal for review.';
        }
        if (strikeCount === 2) {
            return 'You can appeal this suspension if you believe it was issued in error. Appeals are reviewed within 48 hours.';
        }
        return 'Please review our community guidelines to avoid future strikes. Two more strikes will result in account suspension.';
    };

    const handleAppeal = () => {
        onClose();
        router.push(`/(tabs)/profile`); // Navigate to profile where they can submit appeal
    };

    const handleViewGuidelines = () => {
        onClose();
        // TODO: Navigate to community guidelines
        router.push(`/(tabs)/profile`);
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
                    className="w-full max-w-md rounded-3xl overflow-hidden"
                >
                    {/* Header */}
                    <View
                        className="p-6 items-center"
                        style={{ backgroundColor: getSeverityColor(strike.severity) }}
                    >
                        <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3">
                            <Ionicons
                                name={getSeverityIcon(strike.severity) as any}
                                size={40}
                                color="#FFF"
                            />
                        </View>
                        <Text className="text-white text-2xl font-bold text-center">
                            Community Guideline Violation
                        </Text>
                        <Text className="text-white/90 text-sm mt-1">
                            Strike {strikeCount} of 3
                        </Text>
                    </View>

                    <ScrollView className="px-6 py-5" showsVerticalScrollIndicator={false}>
                        {/* Reason */}
                        <View className="mb-4">
                            <Text
                                className="text-xs font-semibold mb-2"
                                style={{ color: textSecondary }}
                            >
                                REASON
                            </Text>
                            <Text className="text-base font-semibold" style={{ color: textPrimary }}>
                                {strike.reason}
                            </Text>
                            {strike.details && (
                                <Text className="text-sm mt-2" style={{ color: textSecondary }}>
                                    {strike.details}
                                </Text>
                            )}
                        </View>

                        {/* Consequences */}
                        <View className="mb-4">
                            <Text
                                className="text-xs font-semibold mb-2"
                                style={{ color: textSecondary }}
                            >
                                CONSEQUENCES
                            </Text>
                            <Text className="text-sm leading-6" style={{ color: textPrimary }}>
                                {getConsequenceText()}
                            </Text>
                            {suspendedUntil && (
                                <Text className="text-sm mt-2 font-semibold" style={{ color: textPrimary }}>
                                    Suspended until: {new Date(suspendedUntil).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </Text>
                            )}
                        </View>

                        {/* Next Steps */}
                        <View className="mb-4">
                            <Text
                                className="text-xs font-semibold mb-2"
                                style={{ color: textSecondary }}
                            >
                                NEXT STEPS
                            </Text>
                            <Text className="text-sm leading-6" style={{ color: textPrimary }}>
                                {getNextStepText()}
                            </Text>
                        </View>

                        {/* Strike Expiration */}
                        {strike.expiresAt && strike.severity === 'MINOR' && (
                            <View
                                className="p-3 rounded-xl mb-4"
                                style={{ backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }}
                            >
                                <View className="flex-row items-start">
                                    <Ionicons
                                        name="time"
                                        size={16}
                                        color={isDark ? '#93C5FD' : '#1E40AF'}
                                        style={{ marginRight: 8, marginTop: 2 }}
                                    />
                                    <Text
                                        className="flex-1 text-xs leading-5"
                                        style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}
                                    >
                                        This warning will expire on{' '}
                                        {new Date(strike.expiresAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View className="space-y-3">
                            {strikeCount >= 2 && (
                                <Pressable
                                    onPress={handleAppeal}
                                    className="py-4 rounded-xl items-center"
                                    style={{ backgroundColor: '#6366F1' }}
                                >
                                    <Text className="text-white text-base font-bold">Submit an Appeal</Text>
                                </Pressable>
                            )}

                            <Pressable
                                onPress={handleViewGuidelines}
                                className="py-4 rounded-xl items-center border"
                                style={{
                                    borderColor: isDark ? '#374151' : '#D1D5DB',
                                    backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                                }}
                            >
                                <Text className="text-base font-semibold" style={{ color: textPrimary }}>
                                    View Community Guidelines
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={onClose}
                                className="py-4 items-center"
                            >
                                <Text className="text-base font-medium" style={{ color: textSecondary }}>
                                    I Understand
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

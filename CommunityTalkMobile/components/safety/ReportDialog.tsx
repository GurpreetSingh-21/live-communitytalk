// CommunityTalkMobile/components/safety/ReportDialog.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    Pressable,
    ScrollView,
    Alert,
    ActivityIndicator,
    useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api/api';

type ReportReason =
    | 'HARASSMENT'
    | 'FAKE_PROFILE'
    | 'INAPPROPRIATE_CONTENT'
    | 'SAFETY_CONCERN'
    | 'SPAM'
    | 'UNDERAGE'
    | 'HATE_SPEECH'
    | 'IMPERSONATION'
    | 'OTHER';

const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
    { value: 'HARASSMENT', label: 'Harassment or bullying', icon: 'alert-circle' },
    { value: 'FAKE_PROFILE', label: 'Fake profile', icon: 'person-remove' },
    { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content', icon: 'warning' },
    { value: 'SAFETY_CONCERN', label: 'Safety concern', icon: 'shield-checkmark' },
    { value: 'SPAM', label: 'Spam or scam', icon: 'chatbox-ellipses' },
    { value: 'UNDERAGE', label: 'Underage user', icon: 'calendar' },
    { value: 'HATE_SPEECH', label: 'Hate speech', icon: 'ban' },
    { value: 'IMPERSONATION', label: 'Impersonation', icon: 'people' },
    { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal' },
];

interface ReportDialogProps {
    visible: boolean;
    onClose: () => void;
    reportedUserId: string;
    reportedUserName: string;
    targetType?: string;
    targetId?: string;
}

export function ReportDialog({
    visible,
    onClose,
    reportedUserId,
    reportedUserName,
    targetType = 'profile',
    targetId,
}: ReportDialogProps) {
    const isDark = useColorScheme() === 'dark';
    const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const bg = isDark ? '#020617' : '#FFFFFF';
    const textPrimary = isDark ? '#F9FAFB' : '#020617';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
    const border = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.1)';
    const accent = '#EF4444'; // Red for reports

    const handleSubmit = async () => {
        if (!selectedReason) {
            Alert.alert('Missing Information', 'Please select a reason for your report.');
            return;
        }

        setIsSubmitting(true);

        try {
            await api.post('/api/safety/report', {
                reportedId: reportedUserId,
                reason: selectedReason,
                details: details.trim() || undefined,
                targetType,
                targetId,
            });

            Alert.alert(
                'Report Submitted',
                'Thank you for helping keep our community safe. We will review your report within 24 hours.',
                [{ text: 'OK', onPress: () => onClose() }]
            );

            // Reset form
            setSelectedReason(null);
            setDetails('');
        } catch (err: any) {
            console.error('Failed to submit report:', err);
            Alert.alert(
                'Error',
                err?.response?.data?.error || 'Failed to submit report. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-end">
                <View
                    style={{
                        backgroundColor: bg,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        maxHeight: '90%',
                    }}
                >
                    {/* Header */}
                    <View className="px-5 pt-4 pb-3 border-b" style={{ borderColor: border }}>
                        <View className="flex-row items-center justify-between mb-2">
                            <Text
                                className="text-xl font-bold"
                                style={{ color: textPrimary }}
                            >
                                Report User
                            </Text>
                            <Pressable
                                onPress={onClose}
                                className="w-8 h-8 items-center justify-center rounded-full"
                                style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}
                            >
                                <Ionicons name="close" size={20} color={textPrimary} />
                            </Pressable>
                        </View>
                        <Text className="text-sm" style={{ color: textSecondary }}>
                            Reporting: <Text className="font-semibold">{reportedUserName}</Text>
                        </Text>
                    </View>

                    <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
                        {/* Select Reason */}
                        <Text
                            className="text-sm font-semibold mb-3"
                            style={{ color: textSecondary }}
                        >
                            SELECT A REASON
                        </Text>

                        <View className="space-y-2">
                            {REPORT_REASONS.map((reason) => (
                                <Pressable
                                    key={reason.value}
                                    onPress={() => setSelectedReason(reason.value)}
                                    className="flex-row items-center p-3 rounded-xl border"
                                    style={{
                                        backgroundColor:
                                            selectedReason === reason.value
                                                ? isDark
                                                    ? '#7F1D1D'
                                                    : '#FEE2E2'
                                                : isDark
                                                    ? '#1F2937'
                                                    : '#F9FAFB',
                                        borderColor:
                                            selectedReason === reason.value
                                                ? accent
                                                : border,
                                    }}
                                >
                                    <View
                                        className="w-10 h-10 items-center justify-center rounded-full mr-3"
                                        style={{
                                            backgroundColor:
                                                selectedReason === reason.value
                                                    ? accent
                                                    : isDark
                                                        ? '#374151'
                                                        : '#E5E7EB',
                                        }}
                                    >
                                        <Ionicons
                                            name={reason.icon as any}
                                            size={20}
                                            color={selectedReason === reason.value ? '#FFF' : textSecondary}
                                        />
                                    </View>
                                    <Text
                                        className="flex-1 font-medium"
                                        style={{
                                            color:
                                                selectedReason === reason.value
                                                    ? isDark
                                                        ? '#FECACA'
                                                        : '#991B1B'
                                                    : textPrimary,
                                        }}
                                    >
                                        {reason.label}
                                    </Text>
                                    {selectedReason === reason.value && (
                                        <Ionicons name="checkmark-circle" size={24} color={accent} />
                                    )}
                                </Pressable>
                            ))}
                        </View>

                        {/* Additional Details */}
                        <Text
                            className="text-sm font-semibold mt-4 mb-3"
                            style={{ color: textSecondary }}
                        >
                            ADDITIONAL DETAILS (OPTIONAL)
                        </Text>

                        <TextInput
                            value={details}
                            onChangeText={setDetails}
                            placeholder="Provide any additional context that might help us review this report..."
                            placeholderTextColor={textSecondary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            className="p-3 rounded-xl border"
                            style={{
                                backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
                                borderColor: border,
                                color: textPrimary,
                                minHeight: 100,
                            }}
                        />

                        {/* Info Box */}
                        <View
                            className="mt-4 p-3 rounded-xl flex-row"
                            style={{ backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }}
                        >
                            <Ionicons
                                name="information-circle"
                                size={20}
                                color={isDark ? '#93C5FD' : '#1E40AF'}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                className="flex-1 text-xs leading-5"
                                style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}
                            >
                                Your report is confidential. We take all reports seriously and will review
                                this within 24 hours. False reports may result in action against your account.
                            </Text>
                        </View>

                        {/* Submit Button */}
                        <Pressable
                            onPress={handleSubmit}
                            disabled={!selectedReason || isSubmitting}
                            className="mt-6 mb-4 py-4 rounded-xl items-center"
                            style={{
                                backgroundColor:
                                    !selectedReason || isSubmitting
                                        ? isDark
                                            ? '#374151'
                                            : '#D1D5DB'
                                        : accent,
                            }}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text className="text-white text-base font-bold">Submit Report</Text>
                            )}
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

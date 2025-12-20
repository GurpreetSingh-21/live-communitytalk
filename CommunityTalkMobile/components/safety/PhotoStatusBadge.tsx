// CommunityTalkMobile/components/safety/PhotoStatusBadge.tsx
import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface PhotoStatusBadgeProps {
    status: PhotoStatus;
    rejectionReason?: string;
    showLabel?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export function PhotoStatusBadge({
    status,
    rejectionReason,
    showLabel = true,
    size = 'medium',
}: PhotoStatusBadgeProps) {
    const isDark = useColorScheme() === 'dark';

    const getStatusConfig = () => {
        switch (status) {
            case 'PENDING':
                return {
                    icon: 'time' as const,
                    label: 'Pending Review',
                    bgColor: isDark ? '#1E3A8A' : '#DBEAFE',
                    textColor: isDark ? '#93C5FD' : '#1E40AF',
                    iconColor: isDark ? '#60A5FA' : '#2563EB',
                };
            case 'APPROVED':
                return {
                    icon: 'checkmark-circle' as const,
                    label: 'Approved',
                    bgColor: isDark ? '#14532D' : '#D1FAE5',
                    textColor: isDark ? '#86EFAC' : '#065F46',
                    iconColor: isDark ? '#4ADE80' : '#10B981',
                };
            case 'REJECTED':
                return {
                    icon: 'close-circle' as const,
                    label: 'Rejected',
                    bgColor: isDark ? '#7F1D1D' : '#FEE2E2',
                    textColor: isDark ? '#FCA5A5' : '#991B1B',
                    iconColor: isDark ? '#EF4444' : '#DC2626',
                };
            default:
                return {
                    icon: 'help-circle' as const,
                    label: 'Unknown',
                    bgColor: '#6B7280',
                    textColor: '#FFF',
                    iconColor: '#FFF',
                };
        }
    };

    const config = getStatusConfig();
    const iconSize = size === 'small' ? 14 : size === 'large' ? 24 : 18;
    const textSize = size === 'small' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm';
    const padding = size === 'small' ? 'px-2 py-1' : size === 'large' ? 'px-4 py-2' : 'px-3 py-1.5';

    return (
        <View>
            <View
                className={`flex-row items-center rounded-full ${padding}`}
                style={{ backgroundColor: config.bgColor }}
            >
                <Ionicons name={config.icon} size={iconSize} color={config.iconColor} />
                {showLabel && (
                    <Text
                        className={`${textSize} font-semibold ml-1.5`}
                        style={{ color: config.textColor }}
                    >
                        {config.label}
                    </Text>
                )}
            </View>

            {/* Rejection Reason */}
            {status === 'REJECTED' && rejectionReason && showLabel && (
                <View
                    className="mt-2 p-2 rounded-lg"
                    style={{ backgroundColor: isDark ? 'rgba(127,29,29,0.3)' : '#FEE2E2' }}
                >
                    <Text className="text-xs font-medium mb-1" style={{ color: config.textColor }}>
                        Reason:
                    </Text>
                    <Text className="text-xs leading-5" style={{ color: config.textColor }}>
                        {rejectionReason}
                    </Text>
                </View>
            )}
        </View>
    );
}

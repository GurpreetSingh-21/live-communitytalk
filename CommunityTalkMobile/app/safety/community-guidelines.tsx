// CommunityTalkMobile/app/safety/community-guidelines.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    useColorScheme,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const GUIDELINES = [
    {
        icon: 'heart',
        title: 'Be Respectful',
        description: 'Treat others the way you want to be treated. No harassment, hate speech, or discrimination of any kind.',
        color: '#EF4444',
    },
    {
        icon: 'shield-checkmark',
        title: 'Stay Safe',
        description: 'Never share personal information like your address, phone number, or financial details. Report suspicious behavior immediately.',
        color: '#10B981',
    },
    {
        icon: 'person',
        title: 'Be Yourself',
        description: 'Use real, recent photos of yourself only. No celebrity photos, stock images, or photos of other people.',
        color: '#6366F1',
    },
    {
        icon: 'checkmark-done',
        title: 'Be 18+',
        description: 'You must be at least 18 years old to use the dating features. We have a zero-tolerance policy for minors.',
        color: '#F59E0B',
    },
    {
        icon: 'chatbox-ellipses',
        title: 'Communicate Respectfully',
        description: 'No explicit or inappropriate messages. Consent is required for all interactions. "No" means no.',
        color: '#8B5CF6',
    },
    {
        icon: 'ban',
        title: 'No Spam or Solicitation',
        description: 'No promoting businesses, selling products, or requesting money. This is a dating app, not a marketplace.',
        color: '#EC4899',
    },
];

const VIOLATIONS = [
    'Harassment or bullying',
    'Fake profiles or impersonation',
    'Explicit or inappropriate content',
    'Hate speech or discrimination',
    'Spam or scam attempts',
    'Underage users',
    'Solicitation or commercial activity',
];

export default function CommunityGuidelinesScreen() {
    const isDark = useColorScheme() === 'dark';
    const [accepted, setAccepted] = useState(false);

    const bg = isDark ? '#020617' : '#F1F5F9';
    const cardBg = isDark ? '#0F172A' : '#FFFFFF';
    const textPrimary = isDark ? '#F9FAFB' : '#020617';
    const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
    const border = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.1)';

    const handleAccept = () => {
        if (!accepted) {
            Alert.alert('Please Agree', 'You must agree to the community guidelines to continue.');
            return;
        }

        Alert.alert(
            'Guidelines Accepted',
            'Thank you for helping us maintain a safe and respectful community!',
            [{ text: 'OK', onPress: () => router.back() }]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View className="px-5 py-3 flex-row items-center justify-between">
                <Pressable
                    onPress={() => router.back()}
                    className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                >
                    <Ionicons
                        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                        size={22}
                        color={textPrimary}
                    />
                    <Text className="text-base" style={{ color: textPrimary }}>
                        Back
                    </Text>
                </Pressable>

                <View className="w-10" />
            </View>

            <ScrollView
                className="flex-1 px-5"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* Hero */}
                <View className="items-center py-6">
                    <View
                        className="w-20 h-20 rounded-full items-center justify-center mb-4"
                        style={{ backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }}
                    >
                        <Ionicons name="shield-checkmark" size={40} color="#6366F1" />
                    </View>
                    <Text className="text-3xl font-bold text-center mb-2" style={{ color: textPrimary }}>
                        Community Guidelines
                    </Text>
                    <Text className="text-center text-sm leading-6" style={{ color: textSecondary }}>
                        Our guidelines help create a safe, respectful, and enjoyable experience for everyone.
                    </Text>
                </View>

                {/* Guidelines */}
                <View className="space-y-4 mb-6">
                    {GUIDELINES.map((guideline, index) => (
                        <View
                            key={index}
                            className="p-4 rounded-2xl border"
                            style={{ backgroundColor: cardBg, borderColor: border }}
                        >
                            <View className="flex-row items-start mb-2">
                                <View
                                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                    style={{ backgroundColor: `${guideline.color}15` }}
                                >
                                    <Ionicons name={guideline.icon as any} size={20} color={guideline.color} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-bold mb-1" style={{ color: textPrimary }}>
                                        {guideline.title}
                                    </Text>
                                    <Text className="text-sm leading-6" style={{ color: textSecondary }}>
                                        {guideline.description}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Three-Strike System */}
                <View
                    className="p-5 rounded-2xl mb-6"
                    style={{ backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' }}
                >
                    <Text className="text-xl font-bold mb-3" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                        ⚠️ Three-Strike Accountability System
                    </Text>
                    <Text className="text-sm leading-6 mb-3" style={{ color: isDark ? '#FECACA' : '#991B1B' }}>
                        We take violations seriously. Here's how our accountability system works:
                    </Text>
                    <View className="space-y-2">
                        <View className="flex-row items-start">
                            <Text className="font-bold mr-2" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                                Strike 1:
                            </Text>
                            <Text className="flex-1 text-sm" style={{ color: isDark ? '#FECACA' : '#991B1B' }}>
                                Warning - Your account remains active
                            </Text>
                        </View>
                        <View className="flex-row items-start">
                            <Text className="font-bold mr-2" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                                Strike 2:
                            </Text>
                            <Text className="flex-1 text-sm" style={{ color: isDark ? '#FECACA' : '#991B1B' }}>
                                30-day suspension - Profile hidden
                            </Text>
                        </View>
                        <View className="flex-row items-start">
                            <Text className="font-bold mr-2" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                                Strike 3:
                            </Text>
                            <Text className="flex-1 text-sm" style={{ color: isDark ? '#FECACA' : '#991B1B' }}>
                                Permanent ban - No exceptions
                            </Text>
                        </View>
                    </View>
                </View>

                {/* What Gets You in Trouble */}
                <View
                    className="p-5 rounded-2xl mb-6 border"
                    style={{ backgroundColor: cardBg, borderColor: border }}
                >
                    <Text className="text-xl font-bold mb-3" style={{ color: textPrimary }}>
                        What Gets You in Trouble
                    </Text>
                    <View className="space-y-2">
                        {VIOLATIONS.map((violation, index) => (
                            <View key={index} className="flex-row items-start">
                                <Ionicons
                                    name="close-circle"
                                    size={18}
                                    color="#EF4444"
                                    style={{ marginRight: 8, marginTop: 2 }}
                                />
                                <Text className="flex-1 text-sm" style={{ color: textSecondary }}>
                                    {violation}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Reporting */}
                <View
                    className="p-5 rounded-2xl mb-6"
                    style={{ backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }}
                >
                    <Text className="text-lg font-bold mb-2" style={{ color: isDark ? '#93C5FD' : '#1E40AF' }}>
                        See Something, Say Something
                    </Text>
                    <Text className="text-sm leading-6" style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}>
                        If you encounter any behavior that violates these guidelines, please report it
                        immediately. All reports are confidential and reviewed within 24 hours.
                    </Text>
                </View>

                {/* Accept Checkbox */}
                <Pressable
                    onPress={() => setAccepted(!accepted)}
                    className="flex-row items-start p-4 rounded-2xl border mb-4"
                    style={{
                        backgroundColor: cardBg,
                        borderColor: accepted ? '#6366F1' : border,
                        borderWidth: accepted ? 2 : 1,
                    }}
                >
                    <View
                        className="w-6 h-6 rounded items-center justify-center mr-3"
                        style={{
                            backgroundColor: accepted ? '#6366F1' : isDark ? '#374151' : '#E5E7EB',
                        }}
                    >
                        {accepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <Text className="flex-1 text-sm leading-6" style={{ color: textPrimary }}>
                        I have read and agree to follow the Community Guidelines. I understand that
                        violations may result in strikes, suspension, or permanent ban.
                    </Text>
                </Pressable>

                {/* Accept Button */}
                <Pressable
                    onPress={handleAccept}
                    className="py-4 rounded-xl items-center mb-6"
                    style={{
                        backgroundColor: accepted ? '#6366F1' : isDark ? '#374151' : '#D1D5DB',
                    }}
                >
                    <Text className="text-white text-base font-bold">
                        {accepted ? 'Continue' : 'Please Accept to Continue'}
                    </Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

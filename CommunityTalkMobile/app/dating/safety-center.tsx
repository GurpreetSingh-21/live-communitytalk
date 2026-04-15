// app/dating/safety-center.tsx
import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

// ── Content ──────────────────────────────────────────────────────────────────

const TIPS = [
    {
        icon: 'shield-checkmark' as const,
        color: '#6366F1',
        title: 'Protect Your Personal Info',
        body: "Never share your home address, workplace, phone number, or financial details with someone you haven't met in person and fully trust.",
    },
    {
        icon: 'videocam' as const,
        color: '#10B981',
        title: 'Video Chat Before Meeting',
        body: "Do a video call before agreeing to meet. It only takes a few minutes and significantly reduces the risk of encountering fake profiles.",
    },
    {
        icon: 'location' as const,
        color: '#F59E0B',
        title: 'Meet in Public First',
        body: "Always meet for the first time in a busy public place — a café, library, or campus building. Let someone you trust know where you're going.",
    },
    {
        icon: 'car' as const,
        color: '#EF4444',
        title: 'Arrange Your Own Transport',
        body: "Have a plan for getting to and from your date independently. Don't rely on your date for a ride until you know and trust them.",
    },
    {
        icon: 'alert-circle' as const,
        color: '#8B5CF6',
        title: 'Trust Your Instincts',
        body: "If something feels off, it probably is. You are never obligated to continue a conversation or meet anyone. Block and report without hesitation.",
    },
];

const RESOURCES = [
    {
        icon: 'call' as const,
        label: 'RAINN National Sexual Assault Hotline',
        value: '1-800-656-4673',
        action: () => Linking.openURL('tel:18006564673'),
        color: '#EF4444',
    },
    {
        icon: 'call' as const,
        label: 'National Domestic Violence Hotline',
        value: '1-800-799-7233',
        action: () => Linking.openURL('tel:18007997233'),
        color: '#EF4444',
    },
    {
        icon: 'chatbubble-ellipses' as const,
        label: 'Crisis Text Line (Text HOME)',
        value: 'Text HOME to 741741',
        action: () => Linking.openURL('sms:741741&body=HOME'),
        color: '#6366F1',
    },
    {
        icon: 'call' as const,
        label: '911 Emergency',
        value: 'Call 911',
        action: () => Linking.openURL('tel:911'),
        color: '#EF4444',
    },
    {
        icon: 'globe' as const,
        label: 'Campustry Safety Guidelines',
        value: 'campustry.com/safety',
        action: () => Linking.openURL('https://campustry.com/safety'),
        color: '#10B981',
    },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SafetyCenterScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    const bg = isDark ? '#0A0A0F' : '#F8F8FF';
    const cardBg = isDark ? '#13131A' : '#FFFFFF';
    const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons
                        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                        size={24}
                        color={theme.text}
                    />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Safety Center</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* Hero */}
                <View style={[styles.heroBadge, { backgroundColor: '#6366F115' }]}>
                    <Ionicons name="shield-checkmark" size={48} color="#6366F1" />
                </View>
                <Text style={[styles.heroTitle, { color: theme.text }]}>Your Safety Matters</Text>
                <Text style={[styles.heroBody, { color: theme.textMuted }]}>
                    Campustry is a campus community. We take dating safety seriously. Read these guidelines before meeting anyone from the app.
                </Text>

                {/* Safety Tips */}
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Safety Tips</Text>
                {TIPS.map((tip, i) => (
                    <View key={i} style={[styles.tipCard, { backgroundColor: cardBg, borderColor: border }]}>
                        <View style={[styles.tipIcon, { backgroundColor: tip.color + '18' }]}>
                            <Ionicons name={tip.icon} size={22} color={tip.color} />
                        </View>
                        <View style={styles.tipBody}>
                            <Text style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</Text>
                            <Text style={[styles.tipText, { color: theme.textMuted }]}>{tip.body}</Text>
                        </View>
                    </View>
                ))}

                {/* Emergency Resources */}
                <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>
                    Crisis &amp; Emergency Resources
                </Text>
                <View style={[styles.resourceBlock, { backgroundColor: cardBg, borderColor: border }]}>
                    {RESOURCES.map((r, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[
                                styles.resourceRow,
                                i < RESOURCES.length - 1 && { borderBottomWidth: 1, borderBottomColor: border }
                            ]}
                            onPress={r.action}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.resourceIcon, { backgroundColor: r.color + '18' }]}>
                                <Ionicons name={r.icon} size={18} color={r.color} />
                            </View>
                            <View style={styles.resourceInfo}>
                                <Text style={[styles.resourceLabel, { color: theme.textMuted }]}>{r.label}</Text>
                                <Text style={[styles.resourceValue, { color: r.color }]}>{r.value}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Report Reminder */}
                <View style={[styles.reportBanner, { backgroundColor: '#EF444412', borderColor: '#EF444430' }]}>
                    <Ionicons name="flag" size={18} color="#EF4444" style={{ marginRight: 10, flexShrink: 0 }} />
                    <Text style={styles.reportText}>
                        <Text style={{ fontFamily: Fonts.bold }}>See something wrong? </Text>
                        Use the ⋯ button on any profile or long-press a match to report it. Every report is reviewed within 24 hours.
                    </Text>
                </View>

                <View style={{ height: 48 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    headerTitle: {
        fontSize: 17,
        fontFamily: Fonts.bold,
    },
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    heroBadge: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 18,
    },
    heroTitle: {
        fontSize: 26,
        fontFamily: Fonts.bold,
        textAlign: 'center',
        marginBottom: 10,
    },
    heroBody: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        fontFamily: Fonts.regular,
        marginBottom: 28,
    },
    sectionLabel: {
        fontSize: 12,
        fontFamily: Fonts.bold,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10,
        gap: 14,
    },
    tipIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    tipBody: { flex: 1 },
    tipTitle: {
        fontSize: 15,
        fontFamily: Fonts.bold,
        marginBottom: 4,
    },
    tipText: {
        fontSize: 13,
        lineHeight: 19,
        fontFamily: Fonts.regular,
    },
    resourceBlock: {
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 20,
    },
    resourceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    resourceIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    resourceInfo: { flex: 1 },
    resourceLabel: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        marginBottom: 2,
    },
    resourceValue: {
        fontSize: 14,
        fontFamily: Fonts.bold,
    },
    reportBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    reportText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: '#EF4444',
        fontFamily: Fonts.regular,
    },
});

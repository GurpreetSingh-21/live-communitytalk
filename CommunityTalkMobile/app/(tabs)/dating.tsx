
import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthContext } from '@/src/context/AuthContext';
import OnboardingWizard from '@/components/dating/onboarding/OnboardingWizard';
import SwipingDeck from '@/components/dating/SwipingDeck';
import MatchesList from '@/components/dating/MatchesList';
import SettingsModal from '@/components/dating/SettingsModal';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DatingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const auth = useContext(AuthContext) as any;
    const { user, refreshBootstrap, isLoading } = auth;
    const [view, setView] = useState<'stack' | 'matches'>('stack');
    const [settingsVisible, setSettingsVisible] = useState(false);

    const isDark = useColorScheme() === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    // Handle Loading
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    // 1. If not authenticated, prompt login
    if (!user) {
        return (
            <View style={styles.container}>
                <View style={[styles.content, { justifyContent: 'center', paddingTop: insets.top }]}>
                    <Text style={[styles.title, { color: '#FFF' }]}>Please Sign In</Text>
                    <Text style={styles.subtitle}>You must be logged in to use Dating.</Text>
                    <TouchableOpacity style={styles.button} onPress={() => router.push('/profile')}>
                        <Text style={styles.buttonText}>Go to Profile</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // 2. If NO Dating Profile -> Show Onboarding Wizard
    if (!user.hasDatingProfile) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FFF', paddingTop: insets.top }}>
                <OnboardingWizard onComplete={() => refreshBootstrap()} />
            </View>
        );
    }

    // 3. Main Dating Interface
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[theme.accent, theme.primary]} // Warm Coral -> Forest Green
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: view === 'matches' ? 0 : insets.bottom }]}>
                    {/* Custom Header with Toggle */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.navItem}
                            onPress={() => setSettingsVisible(true)}
                        >
                            <IconSymbol
                                name="gearshape.fill"
                                size={26}
                                color="#FFF"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setView('stack')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.headerTitle}>Dating</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.navItem, view === 'matches' && styles.navItemActive]}
                            onPress={() => setView('matches')}
                        >
                            <IconSymbol
                                name="bubble.left.and.bubble.right.fill"
                                size={26}
                                color={view === 'matches' ? '#FFF' : 'rgba(255,255,255,0.8)'}
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {view === 'stack' ? (
                            <SwipingDeck />
                        ) : (
                            <View style={[styles.matchesContainer, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
                                <MatchesList />
                            </View>
                        )}
                    </View>
                </View>
            </LinearGradient>

            {/* SETTINGS MODAL */}
            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background, // Default background
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center'
    },
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
        minHeight: 50
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: Fonts.bold,
        color: '#FFF',
        opacity: 0.9
    },
    navItem: {
        padding: 8
    },
    navItemActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#FFF',
        marginBottom: -2
    },
    content: {
        flex: 1,
    },
    matchesContainer: {
        flex: 1,
        backgroundColor: Colors.light.background, // Or theme.background if we access it? StyleSheet is static.
        // We will override this inline in component using theme.background
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: 10,
        overflow: 'hidden'
    },
    title: {
        fontSize: 28,
        fontFamily: Fonts.bold,
        color: Colors.light.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginBottom: 40,
        fontFamily: Fonts.regular
    },
    button: {
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        color: '#FFF',
        fontFamily: Fonts.bold,
        fontSize: 18,
    },
});


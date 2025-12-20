
import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthContext } from '@/src/context/AuthContext';
import OnboardingWizard from '@/components/dating/onboarding/OnboardingWizard';
import SwipingDeck from '@/components/dating/SwipingDeck';
import MatchesList from '@/components/dating/MatchesList';
import SettingsModal from '@/components/dating/SettingsModal';

export default function DatingScreen() {
    const router = useRouter();
    const auth = useContext(AuthContext) as any;
    const { user, refreshBootstrap, isLoading } = auth;
    const [view, setView] = useState<'stack' | 'matches'>('stack');
    const [settingsVisible, setSettingsVisible] = useState(false);

    // Handle Loading
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B6B" />
            </View>
        );
    }

    // 1. If not authenticated, prompt login
    if (!user) {
        return (
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.content, { justifyContent: 'center' }]}>
                        <Text style={[styles.title, { color: '#FFF' }]}>Please Sign In</Text>
                        <Text style={styles.subtitle}>You must be logged in to use Dating.</Text>
                        <TouchableOpacity style={styles.button} onPress={() => router.push('/profile')}>
                            <Text style={styles.buttonText}>Go to Profile</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // 2. If NO Dating Profile -> Show Onboarding Wizard
    if (!user.hasDatingProfile) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
                <OnboardingWizard onComplete={() => refreshBootstrap()} />
            </SafeAreaView>
        );
    }

    // 3. Main Dating Interface
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#FF6B6B', '#FF8E53']} // Dating Brand Colors
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>
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
                            <Text style={styles.headerTitle}>CommunityTalk</Text>
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
                            <View style={styles.matchesContainer}>
                                <MatchesList />
                            </View>
                        )}
                    </View>
                </SafeAreaView>
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
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
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
        paddingHorizontal: 30,
        paddingVertical: 10,
        height: 60
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
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
        // Remove centering for matches list which needs scrolling
        // alignItems: 'center',
        // justifyContent: 'center',
        // padding: 24, // MatchesList has its own padding
    },
    matchesContainer: {
        flex: 1,
        backgroundColor: '#F8F9FC',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: 10,
        overflow: 'hidden'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        marginBottom: 40,
    },
    button: {
        backgroundColor: '#FFFFFF',
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
        color: '#FF6B6B',
        fontWeight: 'bold',
        fontSize: 18,
    },
});


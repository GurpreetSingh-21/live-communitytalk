import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import MatchesList from '@/components/dating/MatchesList';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MatchesScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>Matches</Text>
                <View style={{ width: 28 }} />
            </View>
            <MatchesList />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA'
    },
    backButton: {
        padding: 4
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000'
    }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/api';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

type Match = {
    id: string; // DatingMatch ID
    userId: string; // Partner User ID
    firstName: string;
    avatar: string; // Main photo
    matchedAt: string;
};

export default function MatchesList() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/dating/matches');
            // data.matches is expected to be array of Objects with { matchId, partnerProfile, ... }
            // datingRoutes.js returns mapped matches.
            setMatches(data.matches || []);
        } catch (err) {
            console.error("Fetch matches error:", err);
        } finally {
            setLoading(false);
        }
    };

    const openChat = (match: Match) => {
        // Navigate to DM
        // existing DM route: /dms/[id]?name=...
        // Check `app/(tabs)/dms.tsx` or `app/dm/[id].tsx`
        // Usually it's `/dm/${match.userId}`.
        router.push({
            pathname: "/dm/[id]",
            params: { id: match.userId, name: match.firstName, type: 'dating' }
        });
    };

    const renderItem = ({ item }: { item: Match }) => (
        <TouchableOpacity style={styles.matchItem} onPress={() => openChat(item)}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.info}>
                <Text style={styles.name}>{item.firstName}</Text>
                <Text style={styles.time}>Matched {new Date(item.matchedAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.chatIcon}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#4C5FD5" />
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF6B6B" />
            </View>
        );
    }

    if (matches.length === 0) {
        return (
            <View style={styles.center}>
                <View style={styles.emptyIcon}>
                    <Ionicons name="heart-dislike-outline" size={50} color="#CCC" />
                </View>
                <Text style={styles.title}>No Matches Yet</Text>
                <Text style={styles.subtitle}>Keep swiping to find your person!</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>New Matches</Text>
            <View style={styles.newMatchesRow}>
                {matches.slice(0, 5).map(m => (
                    <TouchableOpacity key={m.id} style={styles.bubble} onPress={() => openChat(m)}>
                        <Image source={{ uri: m.avatar }} style={styles.bubbleImage} />
                        <Text style={styles.bubbleName} numberOfLines={1}>{m.firstName}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.header}>Messages</Text>
            <FlatList
                data={matches}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 10
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    header: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginLeft: 20,
        marginBottom: 10,
        marginTop: 10
    },
    newMatchesRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 10,
        flexWrap: 'wrap',
        gap: 16
    },
    bubble: {
        alignItems: 'center',
        width: 70
    },
    bubbleImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#FF6B6B',
        marginBottom: 4
    },
    bubbleName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333'
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20
    },
    matchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 16
    },
    info: {
        flex: 1
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000'
    },
    time: {
        fontSize: 12,
        color: '#999',
        marginTop: 2
    },
    chatIcon: {
        padding: 8
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    }
});

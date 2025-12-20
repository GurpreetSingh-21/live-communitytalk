import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import DatingAPI from '@/src/api/dating';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type Match = {
    matchId: string;
    partnerId: string; // Dating Profile ID
    userId: string;    // Partner User ID (for DM)
    firstName: string;
    photo: string | null;
    updatedAt?: string;
};

type Thread = {
    partnerId: string;
    partnerName: string;
    avatar?: string;
    lastMessage: string;
    lastTimestamp: string;
    unread: number;
    // ... other metadata
};

export default function MatchesList() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [matchesData, threadsData] = await Promise.all([
                DatingAPI.getMatches(),
                DatingAPI.getConversations()
            ]);

            setMatches((matchesData as any) || []);
            setThreads((threadsData as any) || []);
        } catch (err) {
            console.error("Fetch matches/threads error:", err);
        } finally {
            setLoading(false);
        }
    };

    const openChat = (userId: string, name: string) => {
        router.push({
            pathname: "/dm/[id]",
            params: { id: userId, name: name, type: 'dating' }
        });
    };

    const renderThread = ({ item }: { item: Thread }) => (
        <TouchableOpacity style={styles.matchItem} onPress={() => openChat(item.partnerId, item.partnerName)}>
            <Image source={{ uri: item.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
            <View style={styles.info}>
                <View style={styles.row}>
                    <Text style={styles.name}>{item.partnerName}</Text>
                    {item.lastTimestamp && (
                        <Text style={styles.time}>{new Date(item.lastTimestamp).toLocaleDateString()}</Text>
                    )}
                </View>
                <Text style={[styles.messagePreview, item.unread > 0 && styles.unreadText]} numberOfLines={1}>
                    {item.lastMessage || "Start a conversation"}
                </Text>
            </View>
            {item.unread > 0 && (
                <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unread}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF6B6B" />
            </View>
        );
    }

    if (matches.length === 0 && threads.length === 0) {
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
            {matches.length > 0 && (
                <>
                    <Text style={styles.header}>New Matches</Text>
                    <View style={styles.newMatchesRow}>
                        {matches.slice(0, 10).map(m => ( // Show top 10
                            <TouchableOpacity key={m.matchId} style={styles.bubble} onPress={() => openChat(m.userId, m.firstName)}>
                                <Image source={{ uri: m.photo || 'https://via.placeholder.com/150' }} style={styles.bubbleImage} />
                                <Text style={styles.bubbleName} numberOfLines={1}>{m.firstName}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <Text style={styles.header}>Messages</Text>
            {threads.length === 0 ? (
                <View style={styles.emptyMessages}>
                    <Text style={styles.emptyText}>No conversations yet. Say hi!</Text>
                </View>
            ) : (
                <FlatList
                    data={threads}
                    renderItem={renderThread}
                    keyExtractor={item => item.partnerId}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
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
        marginBottom: 20,
        // Using scrollview usually but flexWrap is okay for small rows. 
        // Logic suggests Horizontal ScrollView is better for bubbles.
        // Changing to flexWrap for simplicity or ScrollView if row is strict.
        // Assuming FlexWrap based on existing code, but let's just make it wrap.
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
        marginRight: 16,
        backgroundColor: '#EEE'
    },
    info: {
        flex: 1
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000'
    },
    time: {
        fontSize: 11,
        color: '#999'
    },
    messagePreview: {
        fontSize: 14,
        color: '#666'
    },
    unreadText: {
        color: '#000',
        fontWeight: '600'
    },
    unreadBadge: {
        backgroundColor: '#FF6B6B',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8
    },
    unreadCount: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700'
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
    },
    emptyMessages: {
        padding: 20,
        alignItems: 'center'
    },
    emptyText: {
        color: '#999',
        fontStyle: 'italic'
    }
});

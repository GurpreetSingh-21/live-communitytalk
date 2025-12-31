// CommunityTalkMobile/app/profile/activity.tsx
import React, { useContext, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

// Mock Data for Timeline
const MOCK_HISTORY = [
  {
    id: '1',
    type: 'joined_community',
    title: 'Joined Queens College',
    desc: 'You verified your .edu email and joined the main campus community.',
    date: '2 days ago',
    icon: 'school',
    color: '#3B82F6', // blue
  },
  {
    id: '2',
    type: 'role_change',
    title: 'Became a Member',
    desc: 'You are now a verified member of the Queens College community.',
    date: '2 days ago',
    icon: 'shield-checkmark',
    color: '#10B981', // green
  },
  {
    id: '3',
    type: 'joined_community',
    title: 'Joined Computer Science',
    desc: 'You joined the Computer Science major group.',
    date: 'Yesterday',
    icon: 'code-slash',
    color: '#8B5CF6', // purple
  },
  {
    id: '4',
    type: 'profile_update',
    title: 'Updated Avatar',
    desc: 'You changed your profile picture.',
    date: 'Just now',
    icon: 'image',
    color: '#F59E0B', // amber
  }
];

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const auth = useContext(AuthContext);
  const user = auth.user;
  const communities = Array.isArray(auth.communities) ? auth.communities : [];

  const bg = colors.background;
  const cardBg = colors.surface;
  const border = colors.border;
  const textPrimary = colors.text;
  const textSecondary = colors.textMuted;
  const accent = colors.primary;

  const firstName = useMemo(() => {
    const full = (user?.fullName || '').trim();
    if (!full) return 'You';
    return full.split(' ')[0];
  }, [user?.fullName]);

  const joinedCommunitiesCount = communities.length || 0;
  const roleLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'mod'
        ? 'Moderator'
        : 'Member';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <View className="flex-row items-center justify-between py-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 rounded-full px-2 py-1"
            android_ripple={{ color: isDark ? '#1F2937' : '#E5E7EB', borderless: true }}
          >
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
              size={22}
              color={textPrimary}
            />
            <Text style={{ color: textPrimary, fontSize: 16 }}>Back</Text>
          </Pressable>

          <Text
            style={{
              color: textPrimary,
              fontSize: 18,
              fontFamily: Fonts.bold,
            }}
          >
            Your Activity
          </Text>

          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Snapshot Card */}
        <LinearGradient
          colors={isDark ? ['#1e293b', '#0f172a'] : ['#F0F9FF', '#E0F2FE']}
          style={{
            borderRadius: 24,
            padding: 20,
            marginTop: 8,
            borderWidth: 1,
            borderColor: isDark ? '#334155' : '#BAE6FD',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              height: 48,
              width: 48,
              borderRadius: 24,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'white',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              borderWidth: 2,
              borderColor: accent,
            }}>
              <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: textPrimary }}>
                {firstName.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: textPrimary, marginBottom: 2 }}>
                {firstName}'s Snapshot
              </Text>
              <Text style={{ fontSize: 13, color: textSecondary }}>
                {roleLabel} • Active since 2024
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)', padding: 12, borderRadius: 16 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 24, color: textPrimary }}>{joinedCommunitiesCount}</Text>
              <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>Communities</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)', padding: 12, borderRadius: 16 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 24, color: textPrimary }}>0</Text>
              <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>Posts Created</Text>
            </View>
          </View>
        </LinearGradient>

        <Text
          style={{
            marginTop: 28,
            marginBottom: 12,
            color: textSecondary,
            fontSize: 13,
            fontFamily: Fonts.bold,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginLeft: 4,
          }}
        >
          Recent History
        </Text>

        {/* Timeline */}
        <View style={{ paddingLeft: 8 }}>
          {MOCK_HISTORY.map((item, index) => {
            const isLast = index === MOCK_HISTORY.length - 1;
            return (
              <View key={item.id} style={{ flexDirection: 'row' }}>
                {/* Line and Dot */}
                <View style={{ alignItems: 'center', marginRight: 16 }}>
                  <View style={{
                    height: 36,
                    width: 36,
                    borderRadius: 18,
                    backgroundColor: cardBg,
                    borderWidth: 2,
                    borderColor: item.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                  }}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                  </View>
                  {!isLast && (
                    <View style={{
                      width: 2,
                      flex: 1,
                      backgroundColor: border,
                      marginVertical: 4,
                    }} />
                  )}
                </View>

                {/* Content */}
                <View style={{ flex: 1, paddingBottom: 24 }}>
                  <View style={{
                    backgroundColor: cardBg,
                    borderRadius: 18,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: border,
                    shadowColor: '#000',
                    shadowOpacity: 0.02,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 }
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 15, color: textPrimary }}>{item.title}</Text>
                      <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>{item.date}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: textSecondary, lineHeight: 18 }}>
                      {item.desc}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: textSecondary }}>
            Only you can see your activity history.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
// CommunityTalkMobile/app/profile/activity.tsx
import React, { useContext, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  useColorScheme as useDeviceColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/src/context/AuthContext';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === 'dark';

  const auth = useContext(AuthContext);
  const user = auth.user;
  const communities = Array.isArray(auth.communities) ? auth.communities : [];

  const bg = isDark ? '#020617' : '#F1F5F9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const border = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(15,23,42,0.06)';
  const textPrimary = isDark ? '#F9FAFB' : '#020617';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const accent = '#6366F1';

  const firstName = useMemo(() => {
    const full = (user?.fullName || '').trim();
    if (!full) return 'You';
    return full.split(' ')[0];
  }, [user?.fullName]);

  const joinedCommunitiesCount = communities.length;
  const roleLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'mod'
      ? 'Moderator'
      : 'Member';

  // simple derived scope text
  const scopeLines: string[] = [];
  if (user?.collegeSlug) {
    scopeLines.push(
      `College community: ${String(user.collegeSlug).replace(/[-_]/g, ' ')}`,
    );
  }
  if (user?.religionKey) {
    scopeLines.push(
      `Faith community: ${String(user.religionKey).replace(/[-_]/g, ' ')}`,
    );
  }

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
              fontWeight: '700',
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
      >
        {/* Overview card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 16,
            marginTop: 8,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 4,
            }}
          >
            Overview
          </Text>
          <Text
            style={{
              color: textPrimary,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: 6,
            }}
          >
            How {firstName} is using CommunityTalk
          </Text>
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
            }}
          >
            Quick snapshot of where you’re active and how you’re connected.
            More detailed history will be added soon.
          </Text>

          {/* Stats row */}
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Joined communities */}
            <View
              style={{
                flex: 1,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: border,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 4,
                  fontWeight: '600',
                }}
              >
                Communities
              </Text>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 20,
                  fontWeight: '800',
                }}
              >
                {joinedCommunitiesCount}
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                Joined groups linked to your account.
              </Text>
            </View>

            {/* Role */}
            <View
              style={{
                flex: 1,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: border,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 4,
                  fontWeight: '600',
                }}
              >
                Role
              </Text>
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 18,
                  fontWeight: '700',
                }}
              >
                {roleLabel}
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 11,
                  marginTop: 4,
                }}
                numberOfLines={2}
              >
                Permissions and tools depend on your role in each community.
              </Text>
            </View>
          </View>

          {/* Scope summary */}
          {scopeLines.length > 0 && (
            <View
              style={{
                marginTop: 14,
                borderRadius: 16,
                padding: 10,
                backgroundColor: isDark ? '#020617' : '#EEF2FF',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons
                  name="school-outline"
                  size={16}
                  color={accent}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    color: textPrimary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  Where your account lives
                </Text>
              </View>
              {scopeLines.map((line, idx) => (
                <Text
                  key={idx}
                  style={{
                    color: textSecondary,
                    fontSize: 12,
                    marginTop: idx === 0 ? 0 : 2,
                  }}
                >
                  • {line}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Communities list */}
        <Text
          style={{
            marginTop: 24,
            marginBottom: 8,
            color: textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Communities you’re part of
        </Text>

        {joinedCommunitiesCount === 0 ? (
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <Text
              style={{
                color: textPrimary,
                fontSize: 14,
                fontWeight: '600',
                marginBottom: 4,
              }}
            >
              No communities yet
            </Text>
            <Text
              style={{
                color: textSecondary,
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              Join a college or interest-based community to see your activity
              show up here.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/communities')}
              style={{
                alignSelf: 'flex-start',
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: accent,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                Browse communities
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: border,
              paddingVertical: 4,
            }}
          >
            {communities.slice(0, 5).map((c: any, idx: number) => {
              const isLast = idx === Math.min(communities.length, 5) - 1;
              const typeLabel =
                typeof c?.type === 'string'
                  ? c.type.charAt(0).toUpperCase() + c.type.slice(1)
                  : 'Community';
              return (
                <View
                  key={c?._id || idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: border,
                  }}
                >
                  <View
                    style={{
                      height: 32,
                      width: 32,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDark ? '#020617' : '#E0F2FE',
                      marginRight: 10,
                    }}
                  >
                    <Ionicons name="people-outline" size={18} color={textPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: textPrimary,
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                      numberOfLines={1}
                    >
                      {c?.name || 'Community'}
                    </Text>
                    <Text
                      style={{
                        color: textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {typeLabel}
                    </Text>
                  </View>
                </View>
              );
            })}

            {communities.length > 5 && (
              <Pressable
                onPress={() => router.push('/(tabs)/communities')}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    color: accent,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  View all communities
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Coming soon / explanation */}
        <Text
          style={{
            marginTop: 24,
            marginBottom: 8,
            color: textSecondary,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Activity history
        </Text>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons
              name="time-outline"
              size={18}
              color={accent}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: textPrimary,
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              Detailed history coming soon
            </Text>
          </View>
          <Text
            style={{
              color: textSecondary,
              fontSize: 13,
            }}
          >
            This page will later show a timeline of messages, replies, and new
            communities you joined — all scoped to your verified .edu account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
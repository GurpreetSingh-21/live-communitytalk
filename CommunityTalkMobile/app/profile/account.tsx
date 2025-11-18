// CommunityTalkMobile/app/profile/account.tsx
import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  useColorScheme as useDeviceColorScheme,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '@/src/context/AuthContext';
import { api } from '@/src/api/api';

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === 'dark';
  const auth = useContext(AuthContext);
  const user = auth.user;
  const refreshBootstrap = auth.refreshBootstrap;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.fullName || '');
  const [savingName, setSavingName] = useState(false);

  const bg = isDark ? '#020617' : '#F1F5F9';
  const cardBg = isDark ? '#020617' : '#FFFFFF';
  const border = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(15,23,42,0.06)';
  const textPrimary = isDark ? '#F9FAFB' : '#020617';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';

  const handleEditName = () => {
    setNameValue(user?.fullName || '');
    setEditingName(true);
  };

  const handleSubmitName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a valid name.');
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert('Name too short', 'Please enter at least 2 characters.');
      return;
    }

    try {
      setSavingName(true);
      // PATCH profile on backend
      await api.patch('/api/profile', { fullName: trimmed });
      // Re-sync auth state (user + communities)
      await refreshBootstrap();
      setEditingName(false);
      Alert.alert('Saved', 'Your name has been updated.');
    } catch (e: any) {
      console.error('Failed to update name', e?.response?.data || e);
      Alert.alert(
        'Error',
        e?.response?.data?.error || 'Could not update your name. Please try again.',
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleChangeEmail = () => {
    Alert.alert(
      'College email',
      'Your account is tied to your verified .edu email. If you need to change it, please contact support or create a new account with the correct email.',
      [{ text: 'Got it', style: 'default' }],
    );
  };

  const handleGoCommunities = () => {
    router.push('/(tabs)/communities');
  };

  const initials =
    (user?.fullName || user?.email || 'CT')
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CT';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingHorizontal: 16,
          paddingBottom: 8,
          borderBottomWidth: 0,
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
            Account Settings
          </Text>
          <View style={{ width: 60 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32 + insets.bottom,
        }}
      >
        {/* Profile card */}
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
          <View className="flex-row items-center gap-4">
            <View
              style={{
                height: 56,
                width: 56,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#0F172A' : '#EEF2FF',
                borderWidth: 1,
                borderColor: isDark ? '#1F2937' : '#E5E7EB',
              }}
            >
              <Text
                style={{
                  color: isDark ? '#E5E7EB' : '#1F2937',
                  fontWeight: '800',
                  fontSize: 22,
                }}
              >
                {initials}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                style={{
                  color: textPrimary,
                  fontSize: 18,
                  fontWeight: '700',
                }}
                numberOfLines={1}
              >
                {user?.fullName || 'Student'}
              </Text>
              <Text
                style={{
                  color: textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {user?.email || 'No email'}
              </Text>
            </View>
          </View>
        </View>

        {/* Details section */}
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
          Profile
        </Text>

        {/* Name row */}
        <Pressable
          onPress={handleEditName}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
            marginBottom: 10,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#EFF6FF',
                }}
              >
                <Ionicons name="person-circle-outline" size={18} color={textPrimary} />
              </View>
              <View>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Name
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }}>
                  {user?.fullName || 'Student'}
                </Text>
              </View>
            </View>
            <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '600' }}>Edit</Text>
          </View>
        </Pressable>

        {/* Email row */}
        <Pressable
          onPress={handleChangeEmail}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#EEF2FF',
                }}
              >
                <Ionicons name="mail-unread-outline" size={18} color={textPrimary} />
              </View>
              <View style={{ maxWidth: '80%' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  College email
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {user?.email || 'example@school.edu'}
                </Text>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: isDark ? '#14532D' : '#DCFCE7',
              }}
            >
              <Text
                style={{
                  color: isDark ? '#BBF7D0' : '#166534',
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                VERIFIED
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Communities / scope */}
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
          Communities
        </Text>

        <Pressable
          onPress={handleGoCommunities}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  height: 32,
                  width: 32,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#020617' : '#E0F2FE',
                }}
              >
                <Ionicons name="people-outline" size={18} color={textPrimary} />
              </View>
              <View>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Joined communities
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }}>
                  View or leave your current communities
                </Text>
              </View>
            </View>
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-forward' : 'chevron-forward-outline'}
              size={18}
              color={textSecondary}
            />
          </View>
        </Pressable>
      </ScrollView>

      {/* Edit name overlay */}
      {editingName && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(15,23,42,0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              borderRadius: 20,
              padding: 16,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <Text
              style={{
                color: textPrimary,
                fontSize: 16,
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              Edit name
            </Text>
            <Text
              style={{
                color: textSecondary,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              This is the name shown to other students in chats and communities.
            </Text>
            <TextInput
              value={nameValue}
              onChangeText={setNameValue}
              placeholder="Full name"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                color: textPrimary,
                backgroundColor: isDark ? '#020617' : '#F9FAFB',
                marginBottom: 16,
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  if (!savingName) setEditingName(false);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: textSecondary, fontSize: 14, fontWeight: '500' }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSubmitName}
                disabled={savingName}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: savingName
                    ? '#4F46E5aa'
                    : '#4F46E5',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {savingName && (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                )}
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
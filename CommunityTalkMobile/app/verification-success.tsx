// app/verification-success.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function VerificationSuccessScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="checkmark-circle-outline" size={80} color="#10B981" />
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'white', marginTop: 20, textAlign: 'center' }}>
          Email Verified!
        </Text>
        <Text style={{ fontSize: 16, color: '#9CA3AF', marginTop: 10, textAlign: 'center' }}>
          Your account is now active. You can log in.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/modal')}
          style={{
            backgroundColor: '#6366F1',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
            marginTop: 30,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
            Go to Login
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
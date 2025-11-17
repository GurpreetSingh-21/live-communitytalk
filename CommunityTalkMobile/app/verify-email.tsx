// app/verify-email.tsx
import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/api/api';
import { AuthContext } from '@/src/context/AuthContext';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const email = String(params.email || ""); 
  const message = String(params.message || "Please check your email for a 6-digit code.");

  const auth = useContext(AuthContext);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError("Code must be 6 digits.");
      return;
    }

    if (!email) {
      setError("Email address is missing. Please go back and try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("1. Starting verification...");
      
      // Call the verify-code route
      const { data } = await api.post("/api/verify-code", {
        email: email,
        code: code,
      });

      console.log("2. Verification response:", data);

      if (!data.token) {
        throw new Error("Verification succeeded but no token was returned.");
      }

      console.log("3. Setting token...");
      
      // Set the token
      if (typeof auth.setToken === "function") {
        await auth.setToken(data.token);
        console.log("4. Token set successfully");
      }

      // DON'T AWAIT bootstrap - let it run in the background
      // This prevents push notification registration from blocking navigation
      if (typeof auth.bootstrap === "function") {
        console.log("5. Starting bootstrap (not waiting)...");
        auth.bootstrap().catch(err => {
          console.error("Bootstrap error (non-blocking):", err);
        });
      }

      console.log("6. Stopping loading and navigating...");
      
      // Stop loading immediately
      setLoading(false);
      
      // Navigate to home - bootstrap will complete in background
      router.replace("/(tabs)");
      
      console.log("7. Navigation called");

    } catch (err: any) {
      console.error("Verification error:", err);
      console.error("Error details:", err?.response?.data);
      setError(err?.response?.data?.error || "Verification failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
      >
        <Ionicons name="mail-unread-outline" size={80} color="#6366F1" />
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'white', marginTop: 20, textAlign: 'center' }}>
          Check Your Email
        </Text>
        <Text style={{ fontSize: 16, color: '#9CA3AF', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}>
          {message}
        </Text>

        <TextInput
          style={{
            backgroundColor: '#1F2937',
            color: 'white',
            fontSize: 24,
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: 10,
            borderRadius: 10,
            padding: 20,
            marginTop: 30,
            width: '80%',
          }}
          placeholder="123456"
          placeholderTextColor="#4B5563"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        {error ? (
          <Text style={{ color: '#EF4444', marginTop: 15, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: '#6366F1',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
            marginTop: 30,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              Verify Account
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
            Back
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
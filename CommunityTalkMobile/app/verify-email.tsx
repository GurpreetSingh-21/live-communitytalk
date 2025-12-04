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
      
      // Add 15 second timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out")), 15000)
      );
      
      const apiPromise = api.post("/api/verify-code", {
        email: email,
        code: code,
      });

      // Call the verify-code route with timeout
      const { data } = await Promise.race([apiPromise, timeoutPromise]) as any;

      console.log("2. Verification response:", data);

      if (!data.token) {
        throw new Error("Verification succeeded but no token was returned.");
      }

      console.log("3. Setting token...");
      
      // Set the token - this is critical
      if (typeof auth.setToken === "function") {
        await auth.setToken(data.token);
        console.log("4. Token set successfully");
      } else {
        throw new Error("setToken function not available");
      }

      // IMMEDIATELY stop loading before any async operations
      console.log("5. Clearing loading state...");
      setLoading(false);

      // Start bootstrap in background without blocking navigation
      if (typeof auth.bootstrap === "function") {
        console.log("6. Starting bootstrap (background)...");
        // Fire and forget - don't block on this
        setTimeout(() => {
          auth.bootstrap().catch(err => {
            console.error("Bootstrap error (non-blocking):", err);
          });
        }, 0);
      }

      // Force navigation immediately after a tiny delay
      console.log("7. Navigating to home...");
      setTimeout(() => {
        try {
          router.replace("/(tabs)");
          console.log("8. Navigation executed");
        } catch (navError) {
          console.error("Navigation error:", navError);
          // If replace fails, try push as fallback
          if (router.push) {
            router.push("/(tabs)");
          }
        }
      }, 50);

    } catch (err: any) {
      console.error("Verification error:", err);
      console.error("Error details:", err?.response?.data);
      
      // CRITICAL: Always clear loading state
      setLoading(false);
      
      // User-friendly error messages
      if (err.message === "Request timed out") {
        setError("Request timed out. Please check your connection and try again.");
      } else if (err?.response?.status === 400) {
        setError("Invalid or expired code. Please try again.");
      } else if (err?.response?.status === 401) {
        setError("Invalid or expired code. Please try again.");
      } else {
        setError(err?.response?.data?.error || err.message || "Verification failed. Please try again.");
      }
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
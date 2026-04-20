import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const colors = Colors[scheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity 
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.dismissAll(); } }} 
          style={{ padding: 8, marginRight: 8 }}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text }}>Terms & Policies</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 24, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8 }}>Terms and Conditions</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24 }}>Last Updated: March 26, 2026</Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8 }}>1. Acceptance of Terms</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          By creating an account or using the Campustry service, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use the service.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>2. Eligibility</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          This app is designed for the college community. By registering, you represent and warrant that:{'\n\n'}
          • You are at least 18 years of age (or the age of majority in your jurisdiction).{'\n'}
          • You are a currently enrolled student or affiliated with a recognized educational institution.{'\n'}
          • You have not been previously suspended or removed from the service.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>3. User Accounts & Security</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          You are responsible for maintaining the confidentiality of your login credentials. You agree to:{'\n\n'}
          • Provide accurate and current information during registration.{'\n'}
          • Notify us immediately of any unauthorized use of your account.{'\n'}
          • Accept full responsibility for all activities that occur under your account.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>4. Community Guidelines (Acceptable Use)</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          To maintain a safe environment, you agree not to:{'\n\n'}
          • Harass, bully, or stalk other users.{'\n'}
          • Post or share illegal, obscene, or defamatory content.{'\n'}
          • Spam users or use automated bots to scrape data.{'\n'}
          • Impersonate any person or entity, including college officials or app administrators.{'\n'}
          • Attempt to bypass network restrictions or interfere with the app's backend infrastructure.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>5. User-Generated Content</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          You retain ownership of the messages and media you post. However, by using the app, you grant Debug Dragons LLC a worldwide, royalty-free license to host, store, and display your content solely for the purpose of operating the service.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>6. Service "As-Is" & Limitation of Liability</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          The service is provided on an "as-is" and "as-available" basis.{'\n\n'}
          • We do not guarantee that the app will function on all networks (including restricted campus or guest Wi-Fi).{'\n'}
          • Debug Dragons LLC shall not be liable for any service interruptions, data loss, or the conduct of third-party users.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>7. Termination</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 }}>
          We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that violates these terms or is harmful to the community.
        </Text>

        <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 }}>8. Governing Law</Text>
        <Text style={{ fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 32 }}>
          These terms are governed by the laws of the State of New York, without regard to its conflict of law principles.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

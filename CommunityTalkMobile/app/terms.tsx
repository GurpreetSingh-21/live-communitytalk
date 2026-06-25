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

  const headingStyle = { fontSize: 18, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8, marginTop: 16 };
  const bodyStyle = { fontSize: 15, fontFamily: Fonts.sans, color: colors.text, lineHeight: 22, marginBottom: 16 };

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
        <Text style={{ fontSize: 24, fontFamily: Fonts.bold, color: colors.text, marginBottom: 8 }}>Terms of Service</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24 }}>Last Updated: June 24, 2026</Text>

        <Text style={headingStyle}>1. Acceptance of Terms</Text>
        <Text style={bodyStyle}>
          These Terms of Service ("Terms") constitute a legally binding agreement between you and Debug Dragons LLC, doing business as Campustry ("we," "us," or "our"), governing your access to and use of the Campustry mobile application and website (the "Service"). By creating an account or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
        </Text>

        <Text style={headingStyle}>2. Eligibility</Text>
        <Text style={bodyStyle}>
          By registering for the Service, you represent and warrant that:{'\n\n'}
          • You are at least 18 years of age (or the age of majority in your jurisdiction, whichever is greater).{'\n'}
          • You are a currently enrolled student or affiliated with a recognized educational institution.{'\n'}
          • You have not been previously suspended, banned, or permanently removed from the Service.{'\n'}
          • You will maintain only one account.
        </Text>

        <Text style={headingStyle}>3. User Accounts & Security</Text>
        <Text style={bodyStyle}>
          You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to:{'\n\n'}
          • Provide accurate, current, and complete information during registration.{'\n'}
          • Notify us immediately of any unauthorized access to or use of your account.{'\n'}
          • Accept full responsibility for all activities conducted through your account, whether or not you authorized them.
        </Text>

        <Text style={headingStyle}>4. User Conduct & Prohibited Activities</Text>
        <Text style={bodyStyle}>
          To maintain a safe and respectful campus environment, you agree not to:{'\n\n'}
          • Harass, bully, stalk, threaten, or intimidate other users.{'\n'}
          • Post or share content that is illegal, obscene, defamatory, or constitutes hate speech.{'\n'}
          • Impersonate any person or entity, including college officials or app administrators.{'\n'}
          • Distribute spam, solicitations, or use automated bots to scrape data.{'\n'}
          • Attempt to bypass security measures, reverse-engineer the application, or interfere with the Service's infrastructure.{'\n'}
          • Use dating features to solicit money, promote businesses, or engage in commercial activity.
        </Text>

        <Text style={headingStyle}>5. User-Generated Content</Text>
        <Text style={bodyStyle}>
          You retain ownership of the messages, media, and content you post. By using the Service, you grant Debug Dragons LLC a worldwide, non-exclusive, royalty-free, sublicensable license to use, host, store, reproduce, and display your content solely for the purpose of operating, improving, and promoting the Service. This license terminates when you delete your content or account, except where retention is required by law.
        </Text>

        <Text style={headingStyle}>6. Disclaimers</Text>
        <Text style={bodyStyle}>
          THE SERVICE IS PROVIDED ON AN "AS-IS" AND "AS-AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DO NOT GUARANTEE FUNCTIONALITY ON ALL NETWORKS, INCLUDING RESTRICTED CAMPUS OR GUEST WI-FI. WE ARE NOT RESPONSIBLE FOR THE CONDUCT OF ANY USER, WHETHER ONLINE OR OFFLINE.
        </Text>

        <Text style={headingStyle}>7. Limitation of Liability</Text>
        <Text style={bodyStyle}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEBUG DRAGONS LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE, ANY USER CONDUCT, OR UNAUTHORIZED ACCESS TO YOUR CONTENT. OUR TOTAL LIABILITY SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS ($100.00) OR THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, WHICHEVER IS GREATER.
        </Text>

        <Text style={headingStyle}>8. Indemnification</Text>
        <Text style={bodyStyle}>
          You agree to indemnify, defend, and hold harmless Debug Dragons LLC from any claims, damages, losses, liabilities, and expenses (including attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content you post through the Service.
        </Text>

        <Text style={headingStyle}>9. Moderation & Termination</Text>
        <Text style={bodyStyle}>
          We reserve the right to remove content and suspend or permanently ban users who violate these Terms, at our sole discretion and without prior notice. Minor infractions may result in warnings; repeated or serious violations result in temporary suspensions; severe safety violations, fraud, or illegal activity result in immediate permanent account termination.{'\n\n'}
          You may terminate your account at any time through your account settings or by contacting us.
        </Text>

        <Text style={headingStyle}>10. Governing Law & Dispute Resolution</Text>
        <Text style={bodyStyle}>
          These Terms are governed by the laws of the State of New York, United States, without regard to its conflict of law principles. Any dispute that cannot be resolved through good-faith negotiation within thirty (30) days may be resolved through binding arbitration in accordance with the American Arbitration Association rules, or through the courts located in New York County, New York. You waive any right to participate in a class action lawsuit or class-wide arbitration.
        </Text>

        <Text style={headingStyle}>11. Changes to These Terms</Text>
        <Text style={bodyStyle}>
          We may update these Terms from time to time. When we make material changes, we will update the "Last Updated" date and notify you through the Service or via email. Your continued use of the Service after changes constitutes acceptance of the revised Terms.
        </Text>

        <Text style={headingStyle}>12. Contact</Text>
        <Text style={{ ...bodyStyle, marginBottom: 32 }}>
          For legal inquiries or reports of violations, contact Debug Dragons LLC — Campustry Legal at debugdragons4@gmail.com.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

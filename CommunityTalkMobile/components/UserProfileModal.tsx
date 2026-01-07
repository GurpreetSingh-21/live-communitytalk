// CommunityTalkMobile/components/UserProfileModal.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { getOrCreateDMThread } from "@/src/api/dm";
import { api } from "@/src/api/api";
import { Colors } from "@/constants/theme";

// --- Component Types ---
type UserProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email?: string;
    status?: "online" | "offline";
    avatar?: string;
  } | null;
  isDark: boolean;
  colors: any;
  currentUserId?: string;
};

// --- Helper Functions ---

// Generate avatar color (HSL based on user ID/name)
const hueFrom = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 85% 55%)`;
};

// Generate initials
const initials = (name?: string, fallback?: string) => {
  const base = (name || fallback || "").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : "");
  return (s || "U").toUpperCase();
};

// --- Modal Component ---
const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  onClose,
  user,
  isDark,
  colors,
  currentUserId,
}) => {
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const isCurrentUser = String(user.id) === String(currentUserId);
  const isOnline = user.status === "online";
  const userColor = hueFrom(user.name || user.email || "U");


  const handleSendDM = async () => {
    if (isCurrentUser) return;

    setLoading(true);
    try {
      const thread = await getOrCreateDMThread(user.id);

      const partnerId =
        (thread as any)?.partnerId ||
        (thread as any)?.partner?.id ||
        (Array.isArray((thread as any)?.participants)
          ? (thread as any).participants.find((p: string) => String(p) !== String(currentUserId))
          : null) ||
        user.id;

      onClose();

      // ⭐ FIX APPLIED HERE: Use the correct dynamic route syntax
      router.push({
        pathname: `/dm/[id]`,  // Use the bracketed slug name
        params: {
          id: partnerId,     // Pass the actual ID as a param
          name: user.name,
          avatar: user.avatar
        }
      });

    } catch (error: any) {
      console.error("Failed to create DM thread:", error);
      Alert.alert(
        "Error",
        error?.response?.data?.error || "Failed to start conversation. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ⭐ Handle Report/Block Action
  const handleReport = () => {
    Alert.alert(
      `Report & Block ${user.name}?`,
      "This person will be blocked from contacting you, and an anonymous report will be sent to the admin team for review. This action cannot be undone by you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report & Block",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await api.post("/api/reports/user", {
                reportedUserId: user.id,
                reason: "Block initiated from user profile modal."
              });

              Alert.alert("Success", `${user.name} has been blocked and reported.`);
              onClose();

            } catch (error: any) {
              console.error("Failed to report user:", error);
              const msg = error?.response?.data?.error || error?.message;
              Alert.alert(
                "Error",
                msg.includes("duplicate key error") ? "You have already reported this user." : (msg || "Failed to submit report.")
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // --- Reusable Button Component for Cleanliness ---
  const ActionButton = ({
    label,
    iconName,
    onPress,
    isPrimary = false,
    isDestructive = false,
  }: {
    label: string;
    iconName: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    isPrimary?: boolean;
    isDestructive?: boolean;
  }) => {
    // Use theme-safe colors with fallbacks
    const safeTheme = isDark ? Colors.dark : Colors.light;
    const defaultTextColor = isDestructive ? (colors.danger || safeTheme.danger) : (colors.textSecondary || safeTheme.textMuted);
    const defaultBgColor = isDestructive ? (colors.dangerBg || `${safeTheme.danger}15`) : (colors.surface || safeTheme.surface);
    const defaultBorderColor = isDestructive ? (colors.dangerBorder || `${safeTheme.danger}30`) : (colors.border || safeTheme.border);
    const primaryColor = safeTheme.primary;

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        style={{
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: isPrimary ? primaryColor : defaultBgColor,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: isPrimary ? 'transparent' : defaultBorderColor,
          overflow: 'hidden',
          shadowColor: isPrimary ? primaryColor : 'transparent',
          shadowOffset: isPrimary ? { width: 0, height: 4 } : { width: 0, height: 0 },
          shadowOpacity: isPrimary ? 0.3 : 0,
          shadowRadius: isPrimary ? 8 : 0,
          elevation: isPrimary ? 8 : 0,
        }}
      >
        <Ionicons name={iconName} size={22} color={isPrimary ? '#fff' : defaultTextColor} />
        <Text
          style={{
            color: isPrimary ? '#fff' : defaultTextColor,
            fontWeight: isPrimary ? '800' : '600',
            fontSize: 16,
            flex: 1,
          }}
        >
          {label}
        </Text>
        {loading && <ActivityIndicator color={isPrimary ? '#fff' : defaultTextColor} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: "85%",
            maxWidth: 400,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <BlurView
            intensity={isDark ? 80 : 95}
            tint={isDark ? "dark" : "light"}
            style={{
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
            }}
          >
            {/* 1. DISCORD-STYLE BANNER & AVATAR BLOCK */}
            <View style={{ position: 'relative' }}>
              {/* Banner Area */}
              <View
                style={{
                  height: 70,
                  backgroundColor: userColor,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border
                }}
              />

              {/* Main Content Area (Below Banner) */}
              <View
                style={{
                  padding: 24,
                  paddingTop: 64, // Space for the floating avatar
                  backgroundColor: isDark ? colors.surface : colors.surfaceElevated,
                  minHeight: 180,
                }}
              >
                {/* Name, Email & Status */}
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 22,
                    fontWeight: "800",
                    marginBottom: 4,
                  }}
                >
                  {user.name}
                </Text>

                {user.email && (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      marginBottom: 16,
                    }}
                  >
                    {user.email}
                  </Text>
                )}

                {/* Placeholder for Profile Info (optional - can be added here) */}
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>
                  Joined: November 20, 2025
                </Text>


                {/* Action Buttons */}
                <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
                  {!isCurrentUser && (
                    <>
                      {/* Primary Action: Send Message */}
                      <ActionButton
                        label="Send Message"
                        iconName="chatbubble-outline"
                        onPress={handleSendDM}
                        isPrimary={true}
                      />

                      {/* Secondary Action: View Full Profile */}
                      <ActionButton
                        label="View Full Profile"
                        iconName="person-outline"
                        onPress={() => Alert.alert("Coming Soon", "Full profile view will be available soon!")}
                      />
                    </>
                  )}

                  {/* Tertiary Actions (Destructive/Utility) */}
                  <View style={{ marginTop: 8, gap: 10 }}>
                    {/* Report & Block Button */}
                    {!isCurrentUser && (
                      <ActionButton
                        label="Report & Block User"
                        iconName="flag-outline"
                        onPress={handleReport}
                        isDestructive={true}
                      />
                    )}

                    {/* Cancel Button */}
                    <ActionButton
                      label={isCurrentUser ? "Close" : "Cancel"}
                      iconName="close-circle-outline"
                      onPress={onClose}
                    />
                  </View>
                </View>
              </View>

              {/* Floating Avatar (positioned absolutely over the banner/content break) */}
              <View
                style={{
                  position: 'absolute',
                  top: 24,
                  left: 24,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 6,
                  borderColor: isDark ? colors.surface : colors.surfaceElevated,
                  backgroundColor: userColor,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 36 }}>
                  {initials(user.name, user.email)}
                </Text>

                {/* Status Indicator */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: isOnline ? colors.success : colors.offlineText, // Using offlineText for offline status color
                    borderWidth: 4,
                    borderColor: isDark ? colors.surface : colors.surfaceElevated,
                  }}
                />
              </View>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default UserProfileModal;
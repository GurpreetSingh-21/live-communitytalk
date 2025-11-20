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
  Platform, // Added Platform for potential styling needs
} from "react-native";
// ⭐ FIX: Corrected Ionicons import path
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { getOrCreateDMThread } from "@/src/api/dm";
import { api } from "@/src/api/api"; 

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

  // Generate avatar color (HSL based on user ID/name)
  const hueFrom = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    // Increased saturation/lightness for better contrast
    return `hsl(${h} 85% 55%)`; 
  };

  // Generate initials
  const initials = (name?: string, fallback?: string) => {
    const base = (name || fallback || "").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    const s = (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : "");
    return (s || "U").toUpperCase();
  };

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
      router.push(`/dm/${partnerId}`);
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
                        // Call the backend endpoint to create the Report document
                        await api.post("/api/reports/user", { 
                            reportedUserId: user.id,
                            reason: "Block initiated from user profile modal." // Default reason
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
          backgroundColor: "rgba(0,0,0,0.8)", // Darker backdrop
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
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: isDark ? 0.6 : 0.2,
              shadowRadius: 20,
              elevation: 15,
            }}
          >
            {/* Header with Avatar */}
            <View
              style={{
                paddingTop: 36, // Increased padding
                paddingBottom: 28, // Increased padding
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: isDark ? colors.surface : colors.surfaceElevated, // Ensure background is visible under blur
              }}
            >
              {/* Large Avatar */}
              <View
                style={{
                  position: "relative",
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: hueFrom(user.name || user.email || "U"),
                    alignItems: "center",
                    justifyContent: "center",
                    // Removed redundant shadow style here to rely on container's elevation
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 38 }}>
                    {initials(user.name, user.email)}
                  </Text>
                </View>

                {/* Online status indicator */}
                {isOnline && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.success,
                      borderWidth: 4,
                      borderColor: isDark ? colors.surface : "#FFFFFF", // Match modal surface color
                    }}
                  />
                )}
              </View>

              {/* Name */}
              <Text
                style={{
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: "800", // Bolder name
                  marginBottom: 4,
                  textAlign: 'center',
                  paddingHorizontal: 10,
                }}
              >
                {user.name}
              </Text>

              {/* Email */}
              {user.email && (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginBottom: 12,
                    textAlign: 'center',
                    paddingHorizontal: 10,
                  }}
                >
                  {user.email}
                </Text>
              )}

              {/* Status Badge */}
              <View
                style={{
                  backgroundColor: isOnline ? colors.onlineBg : colors.offlineBg,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 16, // Larger rounding
                  minWidth: 100,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: isOnline ? colors.onlineText : colors.offlineText,
                    fontSize: 13, // Slightly larger font
                    fontWeight: "800",
                    letterSpacing: 0.8,
                  }}
                >
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ padding: 20, gap: 12 }}>
              {!isCurrentUser && (
                <>
                  {/* Send Message Button (Primary) */}
                  <TouchableOpacity
                    onPress={handleSendDM}
                    disabled={loading}
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 6 }, // Stronger shadow
                      shadowOpacity: 0.4,
                      shadowRadius: 10,
                      elevation: 10,
                    }}
                  >
                    <LinearGradient
                      colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingVertical: 16, // Increased padding
                        paddingHorizontal: 24,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10, // Increased gap
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="chatbubble-outline" size={22} color="#FFFFFF" />
                          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 17 }}>
                            Send Message
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* View Profile Button (Secondary) */}
                  <TouchableOpacity
                    style={{
                      borderRadius: 14,
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      backgroundColor: colors.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    onPress={() => {
                      onClose();
                      Alert.alert("Coming Soon", "Full profile view will be available soon!");
                    }}
                  >
                    <Ionicons name="person-outline" size={22} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 17 }}>
                      View Full Profile
                    </Text>
                  </TouchableOpacity>
                  
                  {/* ⭐ Report & Block Button (Destructive) */}
                  <TouchableOpacity
                    onPress={handleReport}
                    disabled={loading}
                    style={{
                      marginTop: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="flag-outline" size={18} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>
                      Report & Block User
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Close Button (Tertiary) */}
              <TouchableOpacity
                onPress={onClose}
                disabled={loading}
                style={{
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  backgroundColor: isDark ? colors.surfaceElevated : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: isCurrentUser ? 10 : 0, // Add spacing if it's the current user
                }}
              >
                <Text
                  style={{
                    color: isDark ? colors.text : colors.textSecondary,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {isCurrentUser ? "Close" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default UserProfileModal;
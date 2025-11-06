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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { getOrCreateDMThread } from "@/src/api/dm";

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

  // Generate avatar color
  const hueFrom = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return `hsl(${h} 70% 45%)`;
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
      // 1) Create (or fetch) the DM thread
      const thread = await getOrCreateDMThread(user.id);

      // 2) Figure out the partner's id to use in the DM route
      const partnerId =
        (thread as any)?.partnerId ||
        (thread as any)?.partner?.id ||
        (Array.isArray((thread as any)?.participants)
          ? (thread as any).participants.find((p: string) => String(p) !== String(currentUserId))
          : null) ||
        user.id; // fallback

      onClose();

      // 3) Navigate to the dedicated DM screen (NOT /thread)
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
          backgroundColor: "rgba(0,0,0,0.7)",
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
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            }}
          >
            {/* Header with Avatar */}
            <View
              style={{
                paddingTop: 32,
                paddingBottom: 24,
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
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
                    shadowColor: colors.shadow,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 36 }}>
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
                      borderColor: isDark ? "#1C1C1E" : "#FFFFFF",
                    }}
                  />
                )}
              </View>

              {/* Name */}
              <Text
                style={{
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: "700",
                  marginBottom: 4,
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
                  }}
                >
                  {user.email}
                </Text>
              )}

              {/* Status Badge */}
              <View
                style={{
                  backgroundColor: isOnline ? colors.onlineBg : colors.offlineBg,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: isOnline ? colors.onlineText : colors.offlineText,
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.5,
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
                  {/* Send Message Button */}
                  <TouchableOpacity
                    onPress={handleSendDM}
                    disabled={loading}
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }}
                  >
                    <LinearGradient
                      colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 24,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>
                            Send Message
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* View Profile Button (optional - for future) */}
                  <TouchableOpacity
                    style={{
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 24,
                      backgroundColor: colors.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    onPress={() => {
                      onClose();
                      // TODO: Navigate to full profile page when implemented
                      Alert.alert("Coming Soon", "Full profile view will be available soon!");
                    }}
                  >
                    <Ionicons name="person-outline" size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>
                      View Full Profile
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Close Button */}
              <TouchableOpacity
                onPress={onClose}
                disabled={loading}
                style={{
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: "600",
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
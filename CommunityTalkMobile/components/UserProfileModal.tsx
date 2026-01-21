// CommunityTalkMobile/components/UserProfileModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { getOrCreateDMThread } from "@/src/api/dm";
import { api } from "@/src/api/api";
import { Colors, Fonts } from "@/constants/theme";
import { API_BASE_URL } from "@/src/utils/config";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [imageError, setImageError] = useState(false);

  // Reset image error when user changes - MUST be before any conditional returns
  useEffect(() => {
    if (user) {
      setImageError(false);
    }
  }, [user?.id, user?.avatar]);

  // Early return AFTER all hooks
  if (!user) return null;

  const isCurrentUser = String(user.id) === String(currentUserId);
  const isOnline = user.status === "online";
  const userColor = hueFrom(user.name || user.email || "U");
  
  // Better avatar URL handling - check for valid URLs and handle relative paths
  const getAvatarUrl = () => {
    if (!user.avatar) {
      if (__DEV__) console.log('[UserProfileModal] No avatar provided for user:', user.name);
      return null;
    }
    
    // Already a full URL
    if (user.avatar.startsWith('http://') || user.avatar.startsWith('https://') || user.avatar.startsWith('file://')) {
      if (__DEV__) console.log('[UserProfileModal] Using full URL avatar:', user.avatar.substring(0, 50));
      return user.avatar;
    }
    
    // Relative path - prepend API base URL
    if (user.avatar.startsWith('/')) {
      const baseUrl = API_BASE_URL?.replace(/\/+$/, '') || '';
      const fullUrl = `${baseUrl}${user.avatar}`;
      if (__DEV__) console.log('[UserProfileModal] Constructed avatar URL from relative path:', fullUrl.substring(0, 50));
      return fullUrl;
    }
    
    // If it doesn't start with /, it might be a Cloudinary URL or other format
    // Try prepending API base URL anyway
    if (user.avatar && user.avatar.length > 0) {
      const baseUrl = API_BASE_URL?.replace(/\/+$/, '') || '';
      const fullUrl = `${baseUrl}/${user.avatar}`;
      if (__DEV__) console.log('[UserProfileModal] Constructed avatar URL:', fullUrl.substring(0, 50));
      return fullUrl;
    }
    
    return null;
  };

  const avatarUrl = getAvatarUrl();

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

      router.push({
        pathname: `/dm/[id]`,
        params: {
          id: partnerId,
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

  // Discord-style button component
  const DiscordButton = ({
    label,
    iconName,
    onPress,
    variant = "primary", // primary, secondary, danger
    fullWidth = false,
  }: {
    label: string;
    iconName: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    variant?: "primary" | "secondary" | "danger";
    fullWidth?: boolean;
  }) => {
    const isPrimary = variant === "primary";
    const isDanger = variant === "danger";

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        style={{
          width: fullWidth ? '100%' : undefined,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 4,
          backgroundColor: isPrimary 
            ? '#5865F2' // Discord blurple
            : isDanger
            ? isDark ? 'rgba(237, 66, 69, 0.1)' : 'rgba(237, 66, 69, 0.08)'
            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderWidth: isDanger ? 1 : 0,
          borderColor: isDanger ? 'rgba(237, 66, 69, 0.3)' : 'transparent',
        }}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={iconName} 
          size={18} 
          color={
            isPrimary 
              ? '#FFFFFF' 
              : isDanger 
              ? '#ED4245' 
              : (isDark ? colors.textMuted : colors.textSecondary)
          } 
        />
        <Text
          style={{
            color: isPrimary 
              ? '#FFFFFF' 
              : isDanger 
              ? '#ED4245' 
              : (isDark ? colors.textMuted : colors.textSecondary),
            fontFamily: Fonts.medium,
            fontSize: 14,
            letterSpacing: -0.2,
          }}
        >
          {label}
        </Text>
        {loading && isPrimary && (
          <ActivityIndicator color="#FFFFFF" size="small" style={{ marginLeft: 4 }} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: SCREEN_WIDTH * 0.9,
            maxWidth: 420,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              borderRadius: 8,
              overflow: "hidden",
              backgroundColor: isDark ? '#2F3136' : '#FFFFFF',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
            }}
          >
            {/* Discord-style Banner */}
            <View 
              style={{
                height: 100,
                backgroundColor: userColor,
                position: 'relative',
              }}
            >
              {/* Subtle overlay for depth */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.2)',
                }}
              />
            </View>

            {/* Content Area - Discord Style */}
            <View
              style={{
                paddingTop: 72, // Space for floating avatar
                paddingBottom: 20,
                paddingHorizontal: 16,
                backgroundColor: 'transparent',
              }}
            >
              {/* Floating Avatar - Discord Style */}
              <View
                style={{
                  position: 'absolute',
                  top: -44, // Half overlaps banner
                  left: 16,
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 6,
                  borderColor: isDark ? '#2F3136' : '#FFFFFF',
                  backgroundColor: isDark ? '#2F3136' : '#FFFFFF',
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: 'hidden',
                }}
              >
                {avatarUrl && !imageError ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: userColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text 
                      style={{ 
                        color: "#fff", 
                        fontFamily: Fonts.bold, 
                        fontSize: 36,
                        letterSpacing: -1,
                      }}
                    >
                      {initials(user.name, user.email)}
                    </Text>
                  </View>
                )}

                {/* Online Status Ring - Discord Style */}
                {isOnline && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 2,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: isDark ? '#2F3136' : '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "#23A55A", // Discord green
                        borderWidth: 3,
                        borderColor: isDark ? '#2F3136' : '#FFFFFF',
                      }}
                    />
                  </View>
                )}
              </View>

              {/* Username - Discord Style */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    color: isDark ? '#FFFFFF' : '#000000',
                    fontSize: 20,
                    fontFamily: Fonts.bold,
                    letterSpacing: -0.3,
                    marginBottom: 4,
                  }}
                >
                  {user.name}
                </Text>

                {/* Status Badge - Discord Style */}
                {isOnline && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#23A55A",
                      }}
                    />
                    <Text
                      style={{
                        color: isDark ? '#B9BBBE' : '#4F5660',
                        fontSize: 14,
                        fontFamily: Fonts.regular,
                      }}
                    >
                      Online
                    </Text>
                  </View>
                )}
              </View>

              {/* Divider - Discord Style */}
              <View
                style={{
                  height: 1,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  marginBottom: 20,
                }}
              />

              {/* Action Buttons - Discord Style */}
              <View style={{ gap: 12 }}>
                {!isCurrentUser && (
                  <>
                    {/* Primary CTA - Discord Blurple */}
                    <DiscordButton
                      label="Send Message"
                      iconName="chatbubble-ellipses"
                      onPress={handleSendDM}
                      variant="primary"
                      fullWidth
                    />

                    {/* Secondary Actions Row */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <DiscordButton
                          label="Profile"
                          iconName="person"
                          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: user.id } } as never)}
                          variant="secondary"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <DiscordButton
                          label="Block"
                          iconName="ban"
                          onPress={handleReport}
                          variant="danger"
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Close Button */}
                <DiscordButton
                  label="Close"
                  iconName="close"
                  onPress={onClose}
                  variant="secondary"
                  fullWidth
                />
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default UserProfileModal;

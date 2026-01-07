// CommunityTalkMobile/components/dm/DMHeader.tsx
import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  name: string;
  avatar?: string;
  status?: string;
  onPressBack?: () => void;
  onPressProfile?: () => void;
  onPressMore?: () => void;
  dark?: boolean;
};

function initialsFrom(name?: string) {
  if (!name) return "DM";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

// Generate consistent color from name
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 50%)`;
}

export default function DMHeader({
  name,
  avatar,
  status,
  onPressBack,
  onPressProfile,
  onPressMore,
  dark = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const initials = useMemo(() => initialsFrom(name), [name]);
  const avatarColor = useMemo(() => colorFromName(name || "User"), [name]);
  const isOnline = status?.toLowerCase?.() === "online";
  const theme = dark ? Colors.dark : Colors.light;

  // Check if avatar is a valid URL
  const isAvatarUrl = avatar && (avatar.startsWith("http") || avatar.startsWith("file"));

  // WhatsApp-style header background - distinct from chat background
  const headerBg = dark ? '#1A1A1A' : '#FAFAFA';
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View
      style={{
        backgroundColor: headerBg,
        // Edge-to-edge: extends behind Dynamic Island
        paddingTop: insets.top,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: borderColor,
      }}
    >
      {/* Main Content Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 10,
          height: 56,
        }}
      >
        {/* Back Button - WhatsApp Style */}
        {onPressBack && (
          <TouchableOpacity
            onPress={onPressBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={theme.primary}
            />
          </TouchableOpacity>
        )}

        {/* Avatar - Larger, Rounded Square like WhatsApp */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPressProfile}
          style={{
            marginLeft: 4,
            marginRight: 12,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10, // Rounded square like WhatsApp
              overflow: "hidden",
              backgroundColor: theme.muted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isAvatarUrl ? (
              <Image
                source={{ uri: avatar }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : avatar && avatar.length <= 4 ? (
              <Text style={{ fontSize: 20 }}>{avatar}</Text>
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: avatarColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: Fonts.bold,
                    color: "#FFFFFF",
                  }}
                >
                  {initials}
                </Text>
              </View>
            )}
          </View>

          {/* Online Indicator */}
          {isOnline && (
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#22C55E",
                borderWidth: 2.5,
                borderColor: headerBg,
              }}
            />
          )}
        </TouchableOpacity>

        {/* Name & Status */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPressProfile}
          style={{ flex: 1 }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 17,
              fontFamily: Fonts.bold,
              color: theme.text,
              letterSpacing: -0.3,
            }}
          >
            {name || "Direct Message"}
          </Text>

          {status ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                fontFamily: Fonts.regular,
                color: isOnline ? "#22C55E" : theme.textMuted,
                marginTop: 1,
              }}
            >
              {status}
            </Text>
          ) : null}
        </TouchableOpacity>

        {/* Right Actions */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {onPressMore && (
            <TouchableOpacity
              onPress={onPressMore}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
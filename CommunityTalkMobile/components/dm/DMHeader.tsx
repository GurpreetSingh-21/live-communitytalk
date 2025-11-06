// components/dm/DMHeader.tsx
import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity, Platform } from "react-native";

type Props = {
  name: string;
  avatar?: string;
  status?: string;              // "online" | "last seen 5:23 PM"
  onPressBack?: () => void;
  onPressProfile?: () => void;
  onPressMore?: () => void;

  // theme hints so the sticky header blends with screen bg/border in dark/light
  themeBg?: string;
  themeBorder?: string;
  dark?: boolean;
};

function initialsFrom(name?: string) {
  if (!name) return "DM";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export default function DMHeader({
  name,
  avatar,
  status,
  onPressBack,
  onPressProfile,
  onPressMore,
  themeBg = "#fff",
  themeBorder = "#E5E7EB",
  dark = false,
}: Props) {
  const initials = useMemo(() => initialsFrom(name), [name]);
  const isOnline = status?.toLowerCase?.() === "online";

  return (
    <View
      style={{
        paddingTop: Platform.select({ ios: 0, android: 0 }),
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: themeBg,
        borderBottomWidth: 0.5,
        borderBottomColor: themeBorder,
      }}
    >
      {/* Top row — back + avatar + name + actions */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {onPressBack ? (
          <TouchableOpacity
            onPress={onPressBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 8 }}
          >
            <Text style={{ fontSize: 22, lineHeight: 22, color: dark ? "#fff" : "#111827" }}>
              ‹
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPressProfile}
          style={{ marginRight: 12 }}
        >
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: dark ? "#27272A" : "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: dark ? "#F5F5F5" : "#111827" }}>
                {initials}
              </Text>
            </View>
          )}

          {isOnline && (
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: "#10B981",
                borderWidth: 2,
                borderColor: themeBg,
              }}
            />
          )}
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 18, fontWeight: "700", color: dark ? "#fff" : "#111827" }}
          >
            {name || "Direct Message"}
          </Text>
          {!!status && (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: dark ? "#A1A1AA" : "#6B7280", marginTop: 2 }}
            >
              {status}
            </Text>
          )}
        </View>

        {onPressMore ? (
          <TouchableOpacity
            onPress={onPressMore}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingHorizontal: 4, paddingVertical: 6 }}
          >
            <Text style={{ fontSize: 20, color: dark ? "#A1A1AA" : "#6B7280" }}>⋯</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
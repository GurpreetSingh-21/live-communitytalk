// Fallback for using Ionicons on Android and web.
// This file MUST NOT import anything from 'expo-symbols'
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

// Get the type for Ionicons names
type IoniconName = ComponentProps<typeof Ionicons>["name"];

/**
 * Add your SF Symbols to Ionicons mappings here.
 * The key is the SF Symbol name (from _layout.tsx).
 * The value is the Ionicons name (from icons.expo.fyi).
 */
const MAPPING = {
  // --- Tab Bar Icons (from _layout.tsx) ---
  "plus": "add",
  "sparkles": "sparkles-outline",
  "building.2": "business-outline",
  "building.2.fill": "business",
  "paperplane": "paper-plane-outline",
  "paperplane.fill": "paper-plane",
  "person": "person-outline",
  "person.fill": "person",

  // --- Dating Tab ---
  "heart": "heart-outline",
  "heart.fill": "heart",

  // --- Settings & Profile ---
  "gearshape": "settings-outline",
  "gearshape.fill": "settings",
  "chevron.right": "chevron-forward",
  "chevron.left": "chevron-back",
  "chevron.back": "chevron-back",
  "chevron.forward": "chevron-forward",
  "xmark": "close",
  "xmark.circle": "close-circle",
  "xmark.circle.fill": "close-circle",

  // --- Messages & Chat ---
  "bubble.left.and.bubble.right": "chatbubbles-outline",
  "bubble.left.and.bubble.right.fill": "chatbubbles",
  "message": "chatbubble-outline",
  "message.fill": "chatbubble",
  "ellipsis.horizontal": "ellipsis-horizontal",
  "ellipsis": "ellipsis-horizontal",

  // --- Common Actions ---
  "magnifyingglass": "search-outline",
  "camera": "camera-outline",
  "camera.fill": "camera",
  "photo": "image-outline",
  "photo.fill": "image",
  "trash": "trash-outline",
  "trash.fill": "trash",
  "pencil": "pencil-outline",
  "square.and.pencil": "create-outline",
  "arrow.up": "arrow-up",
  "arrow.down": "arrow-down",
  "arrow.left": "arrow-back",
  "arrow.right": "arrow-forward",
  "arrow.up.circle.fill": "arrow-up-circle",

  // --- Safety & Security ---
  "shield": "shield-outline",
  "shield.fill": "shield",
  "shield.checkmark": "shield-checkmark-outline",
  "shield.checkmark.fill": "shield-checkmark",
  "lock": "lock-closed-outline",
  "lock.fill": "lock-closed",
  "exclamationmark.triangle": "warning-outline",
  "exclamationmark.triangle.fill": "warning",

  // --- Status & Info ---
  "checkmark": "checkmark",
  "checkmark.circle": "checkmark-circle-outline",
  "checkmark.circle.fill": "checkmark-circle",
  "info.circle": "information-circle-outline",
  "info.circle.fill": "information-circle",
  "questionmark.circle": "help-circle-outline",
  "bell": "notifications-outline",
  "bell.fill": "notifications",

  // --- Media ---
  "play.fill": "play",
  "pause.fill": "pause",
  "mic": "mic-outline",
  "mic.fill": "mic",
  "speaker.wave.2": "volume-medium-outline",
  "speaker.wave.2.fill": "volume-medium",

  // --- Social ---
  "person.2": "people-outline",
  "person.2.fill": "people",
  "star": "star-outline",
  "star.fill": "star",
  "hand.thumbsup": "thumbs-up-outline",
  "hand.thumbsup.fill": "thumbs-up",

  // --- Location & Events ---
  "location": "location-outline",
  "location.fill": "location",
  "calendar": "calendar-outline",
  "calendar.fill": "calendar",
  "clock": "time-outline",
  "clock.fill": "time",

  // --- Misc ---
  "doc": "document-outline",
  "doc.fill": "document",
  "link": "link-outline",
  "globe": "globe-outline",
  "flag": "flag-outline",
  "flag.fill": "flag",
} as Record<string, IoniconName>;

/**
 * Get the type of our icon names from the MAPPING object's keys.
 */
type IconSymbolName = string;

/**
 * An icon component that uses native SF Symbols on iOS,
 * and Ionicons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  // The 'weight' prop is ignored on Android
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: any; // We remove the 'SymbolWeight' type dependency
}) {
  // Look up the icon name
  const iconName = MAPPING[name];

  // If an icon name is missing from the MAPPING,
  // this will render a question mark icon to help debug.
  if (!iconName) {
    return (
      <Ionicons
        color={color as string}
        size={size}
        name="help-outline"
        style={style}
      />
    );
  }

  return (
    <Ionicons
      color={color as string}
      size={size}
      name={iconName}
      style={style}
    />
  );
}
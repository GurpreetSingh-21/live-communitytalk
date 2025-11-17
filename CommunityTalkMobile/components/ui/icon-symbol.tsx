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

  // --- Other Icons (from communities.tsx) ---
  "magnifyingglass": "search-outline",
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
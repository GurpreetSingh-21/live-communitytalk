// components/themed-view.tsx
import * as React from "react";
import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useColorScheme } from "react-native";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
  /**
   * Optional intent to automatically style the background.
   * - background (default): full screen or page bg
   * - surface: soft section bg (cards, containers)
   * - muted: subtle gray background for secondary blocks
   * - elevated: same as surface but with shadow
   * - brand: use your app's primary color
   */
  intent?: "background" | "surface" | "muted" | "elevated" | "brand";
  rounded?: boolean;
  shadow?: boolean;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  className,
  intent = "background",
  rounded,
  shadow,
  ...otherProps
}: ThemedViewProps) {
  const scheme = useColorScheme();
  const hasBgClass = typeof className === "string" && /\bbg-/.test(className);
  const baseColor = !hasBgClass
    ? useThemeColor({ light: lightColor, dark: darkColor }, "background")
    : undefined;

  const isDark = scheme === "dark";

  const intents = {
    background: baseColor,
    surface: isDark ? "#1F2937" : "#FFFFFF",
    muted: isDark ? "#111827" : "#F9FAFB",
    elevated: isDark ? "#1E293B" : "#FFFFFF",
    brand: "#6D5EF9", // your primary brand color
  } as const;

  const bg = intents[intent] ?? baseColor;

  const extra: StyleProp<ViewStyle> = {
    backgroundColor: bg,
    borderRadius: rounded ? 16 : undefined,
    shadowColor: shadow ? "#000" : undefined,
    shadowOpacity: shadow ? 0.1 : undefined,
    shadowRadius: shadow ? 8 : undefined,
    shadowOffset: shadow ? { width: 0, height: 2 } : undefined,
    elevation: shadow ? 2 : undefined,
  };

  return <View className={className} style={[extra, style]} {...otherProps} />;
}
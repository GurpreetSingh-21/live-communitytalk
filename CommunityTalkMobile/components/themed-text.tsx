// components/themed-text.tsx
import * as React from "react";
import { Text, type TextProps, type StyleProp, type TextStyle } from "react-native";
import { useColorScheme } from "react-native";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
  /**
   * Backward-compatible types + new ones:
   * - title, subtitle, default, defaultSemiBold, link
   * - caption (12), overline (11, uppercased), label (13, semi)
   */
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link" | "caption" | "overline" | "label";
  /**
   * Optional color intent. "muted" is great for timestamps, hints, etc.
   */
  intent?: "default" | "muted" | "primary" | "danger" | "success";
};

const typeStyle = (type: ThemedTextProps["type"]): StyleProp<TextStyle> => {
  switch (type) {
    case "title":           return { fontSize: 28, lineHeight: 34, fontWeight: "700" };
    case "subtitle":        return { fontSize: 20, lineHeight: 26, fontWeight: "700" };
    case "defaultSemiBold": return { fontSize: 16, lineHeight: 24, fontWeight: "600" };
    case "link":            return { fontSize: 16, lineHeight: 24, textDecorationLine: "underline", fontWeight: "600" };
    case "label":           return { fontSize: 13, lineHeight: 18, fontWeight: "600" };
    case "caption":         return { fontSize: 12, lineHeight: 16 };
    case "overline":        return { fontSize: 11, lineHeight: 14, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: "700" };
    default:                return { fontSize: 16, lineHeight: 24 };
  }
};

export const ThemedText = React.forwardRef<Text, ThemedTextProps>(
  ({ style, lightColor, darkColor, className, type = "default", intent = "default", ...rest }, ref) => {
    const schemeIsDark = useColorScheme() === "dark";

    // If a Tailwind text-* class is provided, don't override with our color logic.
    const hasTextClass = typeof className === "string" && /\btext-/.test(className);

    // Base text color from your hook (respects app theme tokens)
    const baseColor = useThemeColor({ light: lightColor, dark: darkColor }, "text");

    // Intent colors (near-black in dark mode, subtle greys in light)
    const intents = {
      default: baseColor,
      muted: schemeIsDark ? "rgba(249,250,251,0.65)" : "rgba(17,24,39,0.65)",
      primary: "#6D5EF9",
      danger:  "#EF4444",
      success: "#10B981",
    } as const;

    const color = hasTextClass ? undefined : intents[intent];

    return (
      <Text
        ref={ref}
        className={className}
        style={[
          typeStyle(type),
          // If you set a custom font globally, this will pick it up automatically.
          // You can also force it here with { fontFamily: "Inter" }
          color ? { color } : null,
          style,
        ]}
        {...rest}
      />
    );
  }
);
ThemedText.displayName = "ThemedText";
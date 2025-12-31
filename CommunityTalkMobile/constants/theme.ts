// CommunityTalkMobile/constants/theme.ts

/**
 * Global design tokens for CommunityTalk Mobile
 * --------------------------------------------------
 * These define the app's light/dark palettes and font stacks.
 * You can use them across components, Tailwind, and custom styles.
 */

import { Platform } from "react-native";

/* ─────────────── Brand + Semantic Colors ─────────────── */
// Campus Warmth Palette
const brandPrimary = "#2D5A47"; // Forest Green (Professional, collegiate)
const brandPrimaryDark = "#86EFAC"; // Light Green for Dark Mode (High contrast)
const brandAccent = "#FF7F6E"; // Warm Coral (Energetic, friendly)

const success = "#22C55E";
const danger = "#EF4444";
const warning = "#F59E0B";
const info = "#3B82F6";

/* ─────────────── Theme Palette ─────────────── */
export const Colors = {
  light: {
    // Core surfaces
    background: "#FAF9F7", // Warm Off-white
    surface: "#FFFFFF",     // Pure white for cards
    muted: "#F5F4F2",       // Warm gray for inputs/backgrounds
    border: "#E5E5E5",
    
    // Text
    text: "#1A1A1A",        // Soft Black
    textMuted: "#6B6B6B",   // Warm Dark Gray
    
    // Icons
    icon: "#6B6B6B",
    
    // Brand / semantic
    primary: brandPrimary,
    accent: brandAccent,
    success,
    danger,
    warning,
    info,
    
    // Navigation
    tabIconDefault: "#A3A3A3",
    tabIconSelected: brandPrimary,
    tint: brandPrimary,
  },

  dark: {
    // Core surfaces
    background: "#111110",  // Warm Black
    surface: "#1A1917",     // Dark Warm Gray
    muted: "#252422",       // Lighter Warm Gray
    border: "#2C2C2C",
    
    // Text
    text: "#F5F4F2",        // Off-white
    textMuted: "#A3A3A3",   // Light Gray
    
    // Icons
    icon: "#A1A1AA",
    
    // Brand / semantic
    primary: brandPrimaryDark, // Lighter green for dark mode visibility
    accent: brandAccent,
    success,
    danger,
    warning,
    info,
    
    // Navigation
    tabIconDefault: "#525252",
    tabIconSelected: brandPrimaryDark,
    tint: brandPrimaryDark,
  },
};

/* ─────────────── Font Stack ─────────────── */
// Premium Font: Plus Jakarta Sans
export const Fonts = Platform.select({
  ios: {
    sans: "PlusJakartaSans_500Medium",
    bold: "PlusJakartaSans_700Bold",
    regular: "PlusJakartaSans_400Regular",
    light: "PlusJakartaSans_300Light",
    serif: "Georgia",
    mono: "Menlo",
  },
  android: {
    sans: "PlusJakartaSans_500Medium",
    bold: "PlusJakartaSans_700Bold",
    regular: "PlusJakartaSans_400Regular",
    light: "PlusJakartaSans_300Light",
    serif: "serif",
    mono: "monospace",
  },
  web: {
    sans: "'Plus Jakarta Sans', system-ui, sans-serif",
    bold: "'Plus Jakarta Sans', system-ui, sans-serif",
    regular: "'Plus Jakarta Sans', system-ui, sans-serif",
    light: "'Plus Jakarta Sans', system-ui, sans-serif",
    serif: "Georgia, serif",
    mono: "monospace",
  },
  default: {
    sans: "System",
    bold: "System",
    regular: "System",
    light: "System",
    serif: "serif",
    mono: "monospace",
  },
});
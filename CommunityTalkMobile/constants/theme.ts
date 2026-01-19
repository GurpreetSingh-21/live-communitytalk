// CommunityTalkMobile/constants/theme.ts

/**
 * Global design tokens for Campustry Mobile
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
    background: "#FAFAFA",     // Soft white
    surface: "#FFFFFF",        // Pure white
    muted: "#F5F5F5",          // Light gray cards
    border: "rgba(0,0,0,0.06)", // Subtle border
    
    // Text
    text: "#0A0A0A",           // Deep black
    textMuted: "#525252",      // Medium gray
    textSecondary: "#A3A3A3",  // Light gray
    
    // Icons
    icon: "#6B6B6B",
    
    // Brand / semantic - Darker emerald for light mode contrast
    primary: "#16A34A",        // Darker emerald
    accent: "#22C55E",         // Bright emerald
    success:  "#16A34A",
    danger,
    warning,
    info,
    
    // Navigation
    tabIconDefault: "#A3A3A3",
    tabIconSelected: "#16A34A",
    tint: "#16A34A",
  },

  dark: {
    // Core surfaces
    background: "#0A0A0A",  // Deep charcoal
    surface: "#111111",     //Elevated surfaces
    muted: "#1A1A1A",       // Card backgrounds
    border: "rgba(255,255,255,0.08)", // Glass border
    
    // Text
    text: "#FAFAFA",        // Off-white
    textMuted: "#A0A0A0",   // Medium gray
    textSecondary: "#707070",   // Light gray
    
    // Icons
    icon: "#A1A1AA",
    
    // Brand / semantic - Single emerald accent
    primary: "#22C55E",     // Modern emerald
    accent: "#22C55E",      // Match primary for consistency
    success: "#22C55E",     // Use same emerald
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
    
    // Navigation
    tabIconDefault: "#525252",
    tabIconSelected: "#22C55E",
    tint: "#22C55E",
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
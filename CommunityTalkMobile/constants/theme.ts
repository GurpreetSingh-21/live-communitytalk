// CommunityTalkMobile/constants/theme.ts

/**
 * Global design tokens for CommunityTalk Mobile
 * --------------------------------------------------
 * These define the app's light/dark palettes and font stacks.
 * You can use them across components, Tailwind, and custom styles.
 */

import { Platform } from "react-native";

/* ─────────────── Brand + Semantic Colors ─────────────── */
const brandPrimary = "#6366F1"; // Modern indigo-violet
const brandPrimaryDark = "#818CF8";
const success = "#10B981";
const danger = "#EF4444";
const warning = "#F59E0B";

/* ─────────────── Theme Palette ─────────────── */
export const Colors = {
  light: {
    // Core surfaces
    background: "#F9FAFB", // App background (soft gray-white)
    surface: "#FFFFFF", // Cards, modals, etc.
    muted: "#F3F4F6", // For subtle blocks and input backgrounds
    // Text
    text: "#111827",
    textMuted: "rgba(17,24,39,0.65)",
    // Icons
    icon: "#6B7280",
    // Brand / semantic
    primary: brandPrimary,
    success,
    danger,
    warning,
    // Navigation
    tabIconDefault: "#9CA3AF",
    tabIconSelected: brandPrimary,
    tint: brandPrimary,
  },

  dark: {
    // Core surfaces
    background: "#0A0A0A", // true dark
    surface: "#111111", // slightly lighter for cards
    muted: "#1C1C1C", // input backgrounds
    // Text
    text: "#F3F4F6",
    textMuted: "rgba(243,244,246,0.6)",
    // Icons
    icon: "#A1A1AA",
    // Brand / semantic
    primary: brandPrimaryDark,
    success,
    danger,
    warning,
    // Navigation
    tabIconDefault: "#6B7280",
    tabIconSelected: brandPrimaryDark,
    tint: brandPrimaryDark,
  },
};

/* ─────────────── Font Stack ─────────────── */
export const Fonts = Platform.select({
  ios: {
    sans: "Inter", // Modern, clean sans-serif (Google Fonts)
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  android: {
    sans: "Inter",
    serif: "serif",
    rounded: "sans-serif-rounded",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  default: {
    sans: "system-ui",
    serif: "serif",
    rounded: "system-ui",
    mono: "monospace",
  },
});
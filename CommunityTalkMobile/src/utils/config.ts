// CommunityTalkMobile/src/utils/config.ts
import Constants from "expo-constants";

/**
 * Priority (highest → lowest):
 *  1) process.env.EXPO_PUBLIC_API_BASE_URL
 *  2) expo.extra.EXPO_PUBLIC_API_BASE_URL
 *  3) expo.extra.API_URL_DEV / API_URL_PROD (legacy)
 *  4) Fallbacks (localhost for dev, ngrok placeholder for prod)
 *
 * This file MUST remain extremely stable because:
 *  - API layer depends on this URL for early-401 & tokenLoaded handling
 *  - Socket layer depends on this URL for WebSocket path
 */

/* ────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────── */
type Extra = {
  EXPO_PUBLIC_API_BASE_URL?: string;
  API_URL_DEV?: string;
  API_URL_PROD?: string;
};

const extra: Extra = (Constants.expoConfig?.extra || {}) as Extra;

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */

/** Pick only the first URL if multiple comma-separated */
function pickFirstUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(",")[0]?.trim();
  return first || undefined;
}

/** Strip trailing slashes to avoid accidental "//api/login" */
function normalizeBase(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/+$/, "");
}

/** Check if URL looks valid (http/https) */
function isValidHttp(url?: string): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

/* ────────────────────────────────────────────────────────────
   RESOLVE BASE URL
   ──────────────────────────────────────────────────────────── */
function resolveBaseUrl(): string {
  const fromEnv    = pickFirstUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  const fromExtra  = pickFirstUrl(extra.EXPO_PUBLIC_API_BASE_URL);
  const fromLegacy = __DEV__
    ? pickFirstUrl(extra.API_URL_DEV)
    : pickFirstUrl(extra.API_URL_PROD);

  // Prefer in this order:
  // env → extra → legacy → fallbacks
  let chosen =
    normalizeBase(fromEnv) ??
    normalizeBase(fromExtra) ??
    normalizeBase(fromLegacy) ??
    (__DEV__
      ? "http://localhost:3000"
      : "https://distrustfully-conglomeratic-adrienne.ngrok-free.dev");

  // Final validation fallback
  if (!isValidHttp(chosen)) {
    console.warn(
      `[config] ❌ Invalid API base URL resolved ('${chosen}'). Falling back to production fallback.`
    );
    chosen = "https://distrustfully-conglomeratic-adrienne.ngrok-free.dev";
  }

  if (__DEV__) {
    console.log("[config:debug] fromEnv   =", fromEnv || "<undefined>");
    console.log("[config:debug] fromExtra =", fromExtra || "<undefined>");
    console.log("[config:debug] fromLegacy=", fromLegacy || "<undefined>");
    console.log("[config:debug] chosen    =", chosen);
  }

  return chosen;
}

/* ────────────────────────────────────────────────────────────
   EXPORT VALUE
   ──────────────────────────────────────────────────────────── */

export const API_BASE_URL = resolveBaseUrl();

/* ────────────────────────────────────────────────────────────
   DEV-TIME DIAGNOSTICS
   ──────────────────────────────────────────────────────────── */
if (__DEV__) {
  if (!API_BASE_URL) {
    console.warn(
      "[config] ❌ API_BASE_URL is empty. Set EXPO_PUBLIC_API_BASE_URL or expo.extra.EXPO_PUBLIC_API_BASE_URL."
    );
  } else if (
    API_BASE_URL.includes("localhost") ||
    API_BASE_URL.includes("127.0.0.1")
  ) {
    console.warn(
      `[config] ⚠️ Using '${API_BASE_URL}' → this will NOT work on device/emulator.\n` +
      "Use your LAN IP or ngrok instead (e.g. http://192.168.x.x:3000 or https://<sub>.ngrok-free.dev)."
    );
  } else {
    console.log("[config] ✅ Using API_BASE_URL →", API_BASE_URL);
  }
}
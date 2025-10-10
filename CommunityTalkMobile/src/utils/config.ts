// CommunityTalkMobile/src/utils/config.ts
import Constants from "expo-constants";

/**
 * Load environment variables from app.config.js / app.json under "extra".
 *
 * Example (in app.config.js):
 * extra: {
 *   API_URL_DEV: "http://192.168.1.151:3000",
 *   API_URL_PROD: "https://api.communitytalk.app"
 * }
 */

type Extra = {
  API_URL_DEV?: string;
  API_URL_PROD?: string;
};

const extra: Extra = (Constants.expoConfig?.extra || {}) as Extra;

/** Utility to pick only the first valid URL if multiple are comma-separated. */
function pickFirstUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(",")[0].trim();
  return first || undefined;
}

/**
 * Decide which base URL to use:
 *  - Dev build → API_URL_DEV or fallback LAN IP
 *  - Prod build → API_URL_PROD or hosted API
 *  - Logs warnings for localhost usage (which fails on devices/simulators)
 */
const devUrl = pickFirstUrl(extra.API_URL_DEV);
const prodUrl = pickFirstUrl(extra.API_URL_PROD);

export const API_BASE_URL =
  (__DEV__ ? devUrl : prodUrl) ||
  (__DEV__
    ? "http://192.168.1.151:3000" // ✅ replace with your LAN IP for Expo dev
    : "https://your-production-api.example.com");

// Helpful dev-time diagnostics
if (__DEV__) {
  if (!API_BASE_URL) {
    console.warn(
      "[config] ❌ Missing API_BASE_URL. Check app.config.js → extra.API_URL_DEV."
    );
  } else if (
    API_BASE_URL.includes("localhost") ||
    API_BASE_URL.includes("127.0.0.1")
  ) {
    console.warn(
      `[config] ⚠️ Using '${API_BASE_URL}' — this will NOT work on iOS/Android simulators or physical devices.\n` +
        "Please set your LAN IP in app.config.js (e.g., 'http://192.168.x.x:PORT')."
    );
  } else {
    console.log("[config] ✅ Using API_BASE_URL →", API_BASE_URL);
  }
}
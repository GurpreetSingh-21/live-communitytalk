// CommunityTalkMobile/src/utils/config.ts
import Constants from "expo-constants";

/**
 * Sources we support (in priority order):
 *  1) process.env.EXPO_PUBLIC_API_BASE_URL           ← best for dev; set in your shell
 *  2) Constants.expoConfig.extra.EXPO_PUBLIC_API_BASE_URL
 *  3) Constants.expoConfig.extra.API_URL_DEV / API_URL_PROD (legacy keys)
 *  4) Fallbacks (localhost for dev, placeholder for prod)
 */

type Extra = {
  EXPO_PUBLIC_API_BASE_URL?: string;
  API_URL_DEV?: string;
  API_URL_PROD?: string;
};

const extra: Extra = (Constants.expoConfig?.extra || {}) as Extra;

/** Keep only the first URL if multiple are comma-separated. */
function pickFirstUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(",")[0]?.trim();
  return first || undefined;
}

/** Remove any trailing slashes so we don’t end up with // in requests. */
function normalizeBase(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/+$/, "");
}

/** Decide the base URL with clear precedence. */
function resolveBaseUrl(): string {
  const fromEnv     = pickFirstUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  const fromExtra   = pickFirstUrl(extra.EXPO_PUBLIC_API_BASE_URL);
  const fromLegacy  = __DEV__ ? pickFirstUrl(extra.API_URL_DEV) : pickFirstUrl(extra.API_URL_PROD);

  const chosen =
    normalizeBase(fromEnv) ??
    normalizeBase(fromExtra) ??
    normalizeBase(fromLegacy) ??
    (__DEV__ ? "http://localhost:3000" : "https://your-production-api.example.com");

  if (__DEV__) {
    // Helpful diagnostics so you know exactly what got used
    // (These logs show once at app start.)
    // eslint-disable-next-line no-console
    console.log("[config:debug] fromEnv   =", fromEnv || "<undefined>");
    // eslint-disable-next-line no-console
    console.log("[config:debug] fromExtra =", fromExtra || "<undefined>");
    // eslint-disable-next-line no-console
    console.log("[config:debug] fromLegacy=", fromLegacy || "<undefined>");
  }

  return chosen;
}

export const API_BASE_URL = resolveBaseUrl();

// Dev-time guidance + confirmation
if (__DEV__) {
  if (!API_BASE_URL) {
    // eslint-disable-next-line no-console
    console.warn("[config] ❌ Missing API_BASE_URL. Set EXPO_PUBLIC_API_BASE_URL or extra.EXPO_PUBLIC_API_BASE_URL.");
  } else if (API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1")) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] ⚠️ Using '${API_BASE_URL}' — this usually won't work from iOS/Android devices or emulators.\n` +
      "Set your LAN IP or ngrok URL in EXPO_PUBLIC_API_BASE_URL (e.g. 'http://192.168.x.x:3000' or 'https://<subdomain>.ngrok-free.dev')."
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[config] ✅ Using API_BASE_URL →", API_BASE_URL);
  }
}
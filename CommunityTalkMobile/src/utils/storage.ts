// CommunityTalkMobile/src/utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ───────────────────────────────────────────
   Storage Keys (namespaced, future-safe)
   ─────────────────────────────────────────── */
const PREFIX = "ct"; // CommunityTalk namespace
const ACCESS_KEY = `${PREFIX}.access.token`;

/* ───────────────────────────────────────────
   TOKEN FUNCTIONS
   ─────────────────────────────────────────── */
export async function setAccessToken(token: string): Promise<void> {
  try {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      console.warn("[storage] setAccessToken called with empty/invalid token");
      return;
    }

    await AsyncStorage.setItem(ACCESS_KEY, token.trim());
    console.log("[storage] Token stored.");
  } catch (err) {
    console.error("[storage] Failed to store access token:", err);
    throw err;
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(ACCESS_KEY);

    if (typeof token === "string" && token.trim().length > 0) {
      return token.trim();
    }

    return null;
  } catch (err) {
    console.error("[storage] Failed to read access token:", err);
    return null;
  }
}

export async function removeAccessToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACCESS_KEY);
    console.log("[storage] Token removed.");
  } catch (err) {
    console.error("[storage] Failed to remove access token:", err);
    throw err;
  }
}

/* ───────────────────────────────────────────
   FULL CLEAR (used on logout/reset)
   ─────────────────────────────────────────── */
export async function clearAll(): Promise<void> {
  try {
    await AsyncStorage.clear();
    console.log("[storage] AsyncStorage cleared.");
  } catch (err) {
    console.error("[storage] Failed to clear storage:", err);
    throw err;
  }
}

/* ───────────────────────────────────────────
   JSON HELPERS (safe, typed)
   ─────────────────────────────────────────── */
export async function setJSON<T>(key: string, value: T): Promise<void> {
  try {
    const namespacedKey = `${PREFIX}.${key}`;
    await AsyncStorage.setItem(namespacedKey, JSON.stringify(value));
  } catch (err) {
    console.error(`[storage] Failed to store key '${key}':`, err);
    throw err;
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const namespacedKey = `${PREFIX}.${key}`;
    const raw = await AsyncStorage.getItem(namespacedKey);

    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch (parseErr) {
      console.error(`[storage] Corrupt JSON for key '${key}', clearing…`);
      await AsyncStorage.removeItem(namespacedKey);
      return null;
    }
  } catch (err) {
    console.error(`[storage] Failed to read key '${key}':`, err);
    return null;
  }
}
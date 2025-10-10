// CommunityTalkMobile/src/utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_KEY = "ct.access.token";

export async function setAccessToken(token: string): Promise<void> {
  try {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      console.warn("[storage] setAccessToken called with empty/invalid token");
      return;
    }
    await AsyncStorage.setItem(ACCESS_KEY, token.trim());
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
  } catch (err) {
    console.error("[storage] Failed to remove access token:", err);
    throw err;
  }
}

export async function clearAll(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (err) {
    console.error("[storage] Failed to clear storage:", err);
    throw err;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[storage] Failed to store key '${key}':`, err);
    throw err;
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.error(`[storage] Failed to read key '${key}':`, err);
    return null;
  }
}
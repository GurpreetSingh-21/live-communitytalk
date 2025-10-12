// CommunityTalkMobile/src/api/api.ts
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../utils/config";
import { getAccessToken, removeAccessToken } from "../utils/storage";

function normalizeBase(url?: string) {
  if (!url) return "";
  return url.replace(/\/+$/, ""); // strip trailing slashes
}

const BASE = normalizeBase(API_BASE_URL);

if (__DEV__) {
  if (!BASE || !/^https?:\/\//.test(BASE)) {
    console.warn(
      "[api] API_BASE_URL is missing or invalid. Set a full URL like 'http://192.168.x.x:PORT'. Current:",
      API_BASE_URL
    );
  } else {
    console.log("[config] ✅ Using API_BASE_URL →", BASE);
  }
}

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Single-flight guard so we don't spam clear/logouts on a burst of 401s
let handling401 = false;

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// Inject Bearer token when present
api.interceptors.request.use(
  async (cfg) => {
    const token = await getAccessToken();

    const method = (cfg.method || "GET").toUpperCase();
    const fullUrl = `${cfg.baseURL || ""}${cfg.url || ""}`;
    const urlPath = (cfg.url || "").toLowerCase();

    // Do not attach auth to auth endpoints
    const isAuthRoute =
      urlPath.startsWith("/login") ||
      urlPath.startsWith("/register");

    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any)["Cache-Control"] = "no-cache";

    if (token && !isAuthRoute) {
      (cfg.headers as any).Authorization = `Bearer ${token}`;
      console.log(
        "[api:req]",
        method,
        fullUrl,
        "→ auth? true",
        `(tokenLen=${token.length})`
      );
    } else {
      console.log(
        "[api:req]",
        method,
        fullUrl,
        "→ auth? false",
        token ? "(skipped for auth route)" : "(no token)"
      );
    }

    return cfg;
  },
  (error) => Promise.reject(error)
);

// Centralized error/logging + robust 401 handling
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    const status = error.response?.status;
    const triedUrl = `${error.config?.baseURL ?? ""}${error.config?.url ?? ""}`;

    if (__DEV__) {
      console.log(
        "[api:err]",
        error.code ?? "ERR_UNKNOWN",
        status ?? "NO_STATUS",
        error.message ?? "No message",
        "→",
        triedUrl
      );
    }

    // Handle 401 exactly once per burst
    if (status === 401 && !handling401) {
      handling401 = true;
      try {
        await removeAccessToken();
      } catch (e) {
        console.error("[api] Failed to remove token:", e);
      } finally {
        try {
          onUnauthorized?.();
        } finally {
          // small delay to prevent immediate re-entrancy when multiple requests fail together
          setTimeout(() => {
            handling401 = false;
          }, 50);
        }
      }
    }

    // Nicer error messages for common network cases
    if (error.code === "ECONNABORTED") {
      error.message = `Request timed out (${triedUrl}). Check API_BASE_URL or server availability.`;
    } else if (!error.response) {
      error.message = `Network error (${triedUrl}). Is your device on the same network as the server?`;
    }

    return Promise.reject(error);
  }
);
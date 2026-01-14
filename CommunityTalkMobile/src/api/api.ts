// CommunityTalkMobile/src/api/api.ts
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../utils/config";
import { getAccessToken, removeAccessToken } from "../utils/storage";
import { logger, logPerformance } from "../utils/logger";

function normalizeBase(url?: string) {
  if (!url) return "";
  return url.replace(/\/+$/, "");
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
  timeout: 300000, // 5 minutes (via Cloudinary, huge files)
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "ngrok-skip-browser-warning": "true",
  },
});

// Prevent repeated logout bursts
let handling401 = false;

// Called by AuthContext
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// ⭐ FIX — Track when token has actually loaded
let tokenLoaded = false;
export function markTokenLoaded() {
  tokenLoaded = true;
}

// ────────────────────────────────────────────
// Inject Authorization Token
// ────────────────────────────────────────────
api.interceptors.request.use(
  async (cfg) => {
    const token = await getAccessToken();
    const method = (cfg.method || "GET").toUpperCase();
    const fullUrl = `${cfg.baseURL || ""}${cfg.url || ""}`;
    const urlPath = (cfg.url || "").toLowerCase();

    const isAuthRoute =
      urlPath.startsWith("/login") ||
      urlPath.startsWith("/register");

    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any)["Cache-Control"] = "no-cache";

    // 📊 PERFORMANCE: Track request start time
    (cfg as any)._requestStart = Date.now();

    if (token && !isAuthRoute) {
      (cfg.headers as any).Authorization = `Bearer ${token}`;
      logger.debug(
        "[api:req]",
        method,
        fullUrl,
        "→ auth? true",
        `(tokenLen=${token.length})`
      );
    } else {
      // Reduced verbosity for public endpoints
      if (__DEV__ && !fullUrl.includes('/public/')) {
        logger.debug(
          "[api:req]",
          method,
          fullUrl,
          "→ auth? false",
          token ? "(skipped for auth route)" : "(no token)"
        );
      }
    }

    return cfg;
  },
  (error) => Promise.reject(error)
);

// ────────────────────────────────────────────
// Unified Error Handler + Silent 401 Fix + Performance Logging
// ────────────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    // 📊 PERFORMANCE: Log successful request timing
    const requestStart = (res.config as any)._requestStart;
    if (requestStart) {
      const duration = Date.now() - requestStart;
      const url = `${res.config.baseURL || ""}${res.config.url || ""}`;
      const size = JSON.stringify(res.data).length;

      console.log(
        `⚡ [API] ${res.config.method?.toUpperCase()} ${url} → ${res.status} (${duration}ms, ${(size / 1024).toFixed(1)}KB)`
      );

      // Warn on slow requests
      if (duration > 1000) {
        console.warn(`🐌 [API SLOW] Request took ${duration}ms: ${url}`);
      }
    }
    return res;
  },
  async (error: AxiosError<any>) => {
    const status = error.response?.status;
    const triedUrl = `${error.config?.baseURL ?? ""}${error.config?.url ?? ""}`;
    const urlPath = (error.config?.url || "").toLowerCase(); // New variable for URL path check

    // ⭐ FIX 1: Silent ignore of 401 BEFORE token loads
    if (status === 401 && !tokenLoaded) {
      if (__DEV__) {
        logger.debug("[api:note] Ignoring early 401 while token not loaded:", triedUrl);
      }
      return Promise.resolve({ data: null, _early401: true });
    }

    // ⭐ FIX 2: Explicitly resolve (silence) the expected 401 on /api/bootstrap 
    // This prevents the error toast from the unauthenticated bootstrap call.
    const isBootstrap = urlPath.includes("/bootstrap");
    if (isBootstrap && status === 401) {
      logger.debug("[api:note] Silencing expected 401 error for /api/bootstrap.");
      // Resolve the promise to prevent the error from propagating to the global handler
      return Promise.resolve({ data: null, _silenced401: true });
    }

    // 📊 PERFORMANCE: Log failed request timing
    const requestStart = (error.config as any)?._requestStart;
    if (requestStart) {
      const duration = Date.now() - requestStart;
      console.log(`❌ [API ERROR] Request failed after ${duration}ms: ${triedUrl}`);
    }

    // Keep your existing logging (dev only)
    if (__DEV__) {
      logger.debug(
        "[api:err]",
        error.code ?? "ERR_UNKNOWN",
        status ?? "NO_STATUS",
        error.message ?? "No message",
        "→",
        triedUrl
      );
    }

    // ⭐ FIX — Prevent 401 logout loops but still logout once
    if (status === 401 && !handling401) {
      handling401 = true;

      try {
        await removeAccessToken();
      } catch (e) {
        logger.error("[api] Failed to remove token:", e);
      }

      try {
        onUnauthorized?.();
      } finally {
        setTimeout(() => {
          handling401 = false;
        }, 50);
      }
    }

    // Friendly error messages
    if (error.code === "ECONNABORTED") {
      error.message = `Request timed out (${triedUrl}). Check API_BASE_URL or server availability.`;
    } else if (!error.response) {
      error.message = `Network error (${triedUrl}). Is your device on the same network as the server?`;
    }

    // Reject the promise for all other errors
    return Promise.reject(error);
  }
);
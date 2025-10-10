// CommunityTalkMobile/src/api/api.ts
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "../utils/config";
import { getAccessToken, removeAccessToken } from "../utils/storage";

if (__DEV__) {
  if (!API_BASE_URL || !/^https?:\/\//.test(API_BASE_URL)) {
    console.warn(
      "[api] API_BASE_URL is missing or invalid. Set a full URL like 'http://192.168.x.x:PORT'. Current:",
      API_BASE_URL
    );
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.request.use(
  async (cfg) => {
    const token = await getAccessToken();
    if (token) {
      cfg.headers = cfg.headers ?? {};
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    (cfg.headers as any)["Cache-Control"] = "no-cache";
    return cfg;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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

    if (status === 401) {
      try {
        await removeAccessToken();
      } catch (e) {
        console.error("[api] Failed to remove token:", e);
      } finally {
        onUnauthorized?.();
      }
    }

    if (error.code === "ECONNABORTED") {
      error.message = `Request timed out (${triedUrl}). Check API_BASE_URL or server availability.`;
    } else if (!error.response) {
      error.message = `Network error (${triedUrl}). Is your device on the same network as the server?`;
    }

    return Promise.reject(error);
  }
);
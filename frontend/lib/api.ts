// frontend/lib/api.ts

"use client";

import axios from "axios";

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

if (!BASE) {
  console.warn(
    "[admin-api] NEXT_PUBLIC_API_BASE_URL is missing. Set it in .env.local"
  );
} else {
  console.log("[admin-api] Using base URL →", BASE);
}

export const adminApi = axios.create({
  baseURL: BASE,
  headers: {
    "Content-Type": "application/json",
    // 🔧 Bypass ngrok's browser warning interstitial page
    "ngrok-skip-browser-warning": "true",
  },
});

// Attach admin JWT from localStorage
adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("adminToken");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
      console.log(
        "[admin-api][request] Using adminToken for",
        config.method?.toUpperCase(),
        config.url
      );
    } else {
      console.log(
        "[admin-api][request] NO adminToken in localStorage (public / unauth request)"
      );
    }
  }
  return config;
});

// Auto-redirect to /admin/login on 401 **except** for the login endpoint itself
adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url: string | undefined = error?.config?.url;

    console.error(
      "[admin-api][response:error]",
      status,
      error?.config?.method?.toUpperCase(),
      error?.config?.baseURL + (url || "")
    );
    if (error?.response?.data) {
      console.error("[admin-api][response:error] response.data:", error.response.data);
    }

    // Don't redirect for login endpoints – we want to show the error toast instead
    const isLoginEndpoint =
      url?.includes("/api/login") || url?.includes("/api/admin/login");

    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !isLoginEndpoint
    ) {
      console.warn("[admin-api] 401 on", url, "→ clearing adminToken and redirecting to /admin/login");
      window.localStorage.removeItem("adminToken");
      window.location.href = "/admin/login";
    }

    return Promise.reject(error);
  }
);
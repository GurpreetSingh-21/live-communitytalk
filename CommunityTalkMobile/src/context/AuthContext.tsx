// CommunityTalkMobile/src/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SplashScreen from "expo-splash-screen";
import {
  login as apiLogin,
  register as apiRegister,
  RegisterResponse,
  bootstrap as apiBootstrap, // ⭐ Imported safe bootstrap function
} from "../api/auth";
import { api, setUnauthorizedHandler, markTokenLoaded } from "../api/api";
import {
  setAccessToken,
  removeAccessToken,
  getAccessToken,
} from "../utils/storage";
import { refreshSocketAuth, disconnectSocket } from "../api/socket";
import { registerForPushNotificationsAsync } from "../utils/notifications";

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */
type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  collegeId: string;
  religionId: string;
};

type AuthState = {
  isLoading: boolean;
  isAuthed: boolean;
  user: any | null;
  communities: any[];

  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResponse>;
  signOut: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  setToken?: (token: string) => Promise<void>;
  bootstrap?: () => Promise<void>;
  updateAvatar?: (newUrl: string) => void;
};

export const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthed: false,
  user: null,
  communities: [],
  signIn: async () => { },
  register: async () => ({ message: "" }),
  signOut: async () => { },
  refreshBootstrap: async () => { },
  setToken: async () => { },
  bootstrap: async () => { },
  updateAvatar: () => { },
});

SplashScreen.preventAutoHideAsync().catch(() => { });

/* ───────────────────────────────────────────
   Normalize user scope (fills missing collegeSlug / religionKey)
   ─────────────────────────────────────────── */
function deriveScope(user: any | null, communities: any[]) {
  if (!user) return user;

  const hasCollege = !!user.collegeSlug;
  const hasReligion = !!user.religionKey;
  if (hasCollege && hasReligion) return user;

  let collegeSlug = user.collegeSlug ?? null;
  let religionKey = user.religionKey ?? null;

  if (!collegeSlug) {
    const c =
      communities.find((x) => x?.type === "college" && x?.key) ||
      communities.find((x) => /college/i.test(String(x?.type || "")) && x?.key);
    if (c?.key) collegeSlug = c.key;
  }

  if (!religionKey) {
    const r =
      communities.find(
        (x) => (x?.type === "religion" || x?.type === "faith") && x?.key
      ) ||
      communities.find((x) =>
        /(religion|faith)/i.test(String(x?.type || "")) && x?.key
      );
    if (r?.key) religionKey = r.key;
  }

  return { ...user, collegeSlug, religionKey };
}

/* ───────────────────────────────────────────
   Provider
   ─────────────────────────────────────────── */
export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [communities, setCommunities] = useState<any[]>([]);
  const clearingRef = useRef(false);

  /* --------------------- Apply auth --------------------- */
  const applyAuthState = useCallback((u: any | null, cs: any[]) => {
    if (!mountedRef.current) return;

    const safeCommunities = Array.isArray(cs) ? cs : [];
    const augmentedUser = deriveScope(u, safeCommunities);

    // Essential: Inject communityIds so screens can check isMember easily
    if (augmentedUser) {
      augmentedUser.communityIds = safeCommunities.map((c) => c._id || c.id);
    }

    setUser(augmentedUser);
    setCommunities(safeCommunities);
  }, []);

  /* --------------------- Clear auth --------------------- */
  const clearAuthState = useCallback(async () => {
    if (clearingRef.current) return;
    clearingRef.current = true;

    try {
      await removeAccessToken();
    } catch { }

    disconnectSocket();
    applyAuthState(null, []);

    if (mountedRef.current) setIsLoading(false);
    clearingRef.current = false;
  }, [applyAuthState]);

  const triedLegacyOnce = useRef(false);

  // CommunityTalkMobile/src/context/AuthContext.tsx (inside AuthProvider)

  /* --------------------- Bootstrap --------------------- */
  const refreshBootstrap = useCallback(
    async () => {
      // ⭐ ULTIMATE DEFENSE: Check token AGAIN here before proceeding.
      const currentToken = await getAccessToken();
      if (!currentToken) {
        // If we get here, it means the initialLoad failed to catch something.
        console.warn("[AuthContext] Aborting refreshBootstrap: No token found.");
        return;
      }

      // NOTE: The request helper is still needed for the 404 fallback logic.
      const request = async (path: string) => {
        const { data } = await api.get(path);
        return data;
      };

      try {
        // 1. Try the safe, current API endpoint.
        const data = await apiBootstrap(); // This will also check the token internally
        applyAuthState(data?.user || null, data?.communities || []);
        return;
      } catch (err: any) {
        if (err?._early401) return;

        // Handle the custom error thrown when no token is found in auth.ts
        if (err.message?.includes("No access token found")) {
          console.log("[AuthContext] Bootstrap skipped due to missing token.");
          return;
        }

        const status = err?.response?.status;

        // 2. Fallback legacy endpoint (only for 404 errors)
        if (status === 404 && !triedLegacyOnce.current) {
          console.warn("[AuthContext] Bootstrap 404. Trying legacy endpoint...");
          triedLegacyOnce.current = true;

          try {
            const data = await request("/bootstrap");
            applyAuthState(data?.user || null, data?.communities || []);
            console.log("[AuthContext] Legacy bootstrap succeeded.");
            return;
          } catch (e) {
            console.error("[AuthContext] Legacy bootstrap failed.");
          }
        }

        // 3. Token invalid (e.g., 401 from expired token) — force logout
        if (status === 401) {
          console.error("[AuthContext] 401 Unauthorized during bootstrap. Forcing logout.");
          await clearAuthState();
          return;
        }

        throw err;
      }
    },
    [applyAuthState, clearAuthState]
  );

  // CommunityTalkMobile/src/context/AuthContext.tsx (around line 290, the initialLoad function)

  /* --------------------- Initial Load --------------------- */
  const initialLoad = useCallback(async () => {
    try {
      const token = await getAccessToken();

      // Let API layer stop early-401 spam
      markTokenLoaded();

      if (token) {
        // --- AUTHENTICATED PATH ---
        console.log("[AuthContext] Token found, initiating bootstrap...");
        await refreshSocketAuth(token);
        await refreshBootstrap();
        await registerForPushNotificationsAsync();
      } else {
        // --- UNAUTHENTICATED PATH (FIXED) ---
        console.log("[AuthContext] No token found, setting state to unauthed.");
        applyAuthState(null, []);
      }
    } catch (e: any) { // ⭐ ENSURE CATCH BLOCK IS ROBUST

      // ⭐ NEW: Filter out the expected error caused by unauthenticated bootstrap
      if (e.message?.includes("No access token found")) {
        console.warn("[AuthContext] Load Error: Ignored expected 'No token' error.");
        // This block intentionally skips clearing state, as it implies the flow is correct.
        // We must still finish loading.
      } else if (e?.response?.status === 401) {
        // This catches genuine 401 on expired tokens
        console.error("[AuthContext] Initial load failed with 401, clearing state.");
        await clearAuthState();
      } else {
        // Catch all other network/logic errors
        console.error("[AuthContext] Initial load failed with unexpected error:", e);
        await clearAuthState();
      }

    } finally {
      if (mountedRef.current) setIsLoading(false);
      try {
        await SplashScreen.hideAsync();
      } catch { }
    }
  }, [applyAuthState, clearAuthState, refreshBootstrap]);

  /* --------------------- Unauthorized → Logout --------------------- */
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await clearAuthState();
    });
  }, [clearAuthState]);

  /* --------------------- Run initial load once --------------------- */
  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  /* --------------------- Login flow --------------------- */
  const completeLoginFromToken = useCallback(
    async (token: string) => {
      await setAccessToken(token);
      await refreshSocketAuth(token);
      await refreshBootstrap();
      await registerForPushNotificationsAsync(); // SAFE
    },
    [refreshBootstrap]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      if (!res?.token) throw new Error("No token received from server");
      await completeLoginFromToken(res.token);
    },
    [completeLoginFromToken]
  );

  /* --------------------- Register --------------------- */
  const doRegister = useCallback(
    async (input: RegisterInput): Promise<RegisterResponse> => {
      const res = await apiRegister(input);
      return res;
    },
    []
  );

  /* --------------------- Sign Out --------------------- */
  const signOut = useCallback(async () => {
    await clearAuthState();
  }, [clearAuthState]);

  /* --------------------- Compatibility wrappers --------------------- */
  const setTokenCompat = useCallback(
    async (token: string) => {
      // CRITICAL: Only await the bare minimum for email verification
      // to avoid blocking the UI
      await setAccessToken(token);
      await refreshSocketAuth(token);

      // Run bootstrap and push notifications in background
      // These should not block the verify-email screen navigation
      setTimeout(() => {
        refreshBootstrap().catch(err => {
          console.error("[AuthContext] Background bootstrap failed:", err);
        });
        registerForPushNotificationsAsync().catch(err => {
          console.error("[AuthContext] Background push registration failed:", err);
        });
      }, 0);
    },
    [refreshBootstrap]
  );

  const bootstrapCompat = useCallback(async () => {
    await refreshBootstrap();
  }, [refreshBootstrap]);

  const registerCompat = useCallback(
    async (input: RegisterInput) => doRegister(input),
    [doRegister]
  );

  /* --------------------- Avatar updates --------------------- */
  const updateAvatar = useCallback((newUrl: string) => {
    setUser((prev: any | null) => {
      if (!prev) return null;
      return { ...prev, avatar: newUrl };
    });
  }, []);

  /* --------------------- Memo Context Value --------------------- */
  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthed: !!user,
      user,
      communities,
      signIn,
      register: registerCompat,
      signOut,
      refreshBootstrap,
      setToken: setTokenCompat,
      bootstrap: bootstrapCompat,
      updateAvatar,
    }),
    [
      isLoading,
      user,
      communities,
      signIn,
      registerCompat,
      signOut,
      refreshBootstrap,
      setTokenCompat,
      bootstrapCompat,
      updateAvatar,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
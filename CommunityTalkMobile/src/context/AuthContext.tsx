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
// *** We MUST import the new 'RegisterResponse' type ***
import {
  login as apiLogin,
  register as apiRegister,
  RegisterResponse, // <-- IMPORT THIS
} from "../api/auth";
import { api } from "../api/api";
import {
  setAccessToken,
  removeAccessToken,
  getAccessToken,
} from "../utils/storage";
import { setUnauthorizedHandler } from "../api/api";
import { refreshSocketAuth, disconnectSocket } from "../api/socket";
import { registerForPushNotificationsAsync } from "../utils/notifications";

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
  // *** This function will now return the server message ***
  register: (input: RegisterInput) => Promise<RegisterResponse>; // <-- UPDATED TYPE
  signOut: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  /** Back-compat shims used by your UI in a few places */
  setToken?: (token: string) => Promise<void>;
  bootstrap?: () => Promise<void>;
};

export const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthed: false,
  user: null,
  communities: [],
  signIn: async () => {},
  register: async () => ({ message: "" }), // <-- UPDATED DEFAULT
  signOut: async () => {},
  refreshBootstrap: async () => {},
  setToken: async () => {},
  bootstrap: async () => {},
});

// Keep the splash until we hydrate once
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Derive collegeSlug / religionKey from communities when missing on user */
function deriveScope(user: any | null, communities: any[]) {
  // ... (This function is correct, no changes needed)
  if (!user) return user;

  const hasCollege = !!user.collegeSlug;
  const hasReligion = !!user.religionKey;
  if (hasCollege && hasReligion) return user;

  let collegeSlug: string | null | undefined = user.collegeSlug ?? null;
  let religionKey: string | null | undefined = user.religionKey ?? null;

  if (!collegeSlug) {
    const c =
      communities.find((x: any) => x?.type === "college" && x?.key) ||
      communities.find((x: any) => /college/i.test(String(x?.type || "")) && x?.key);
    if (c?.key) collegeSlug = c.key;
  }

  if (!religionKey) {
    const r =
      communities.find(
        (x: any) => (x?.type === "religion" || x?.type === "faith") && x?.key
      ) || communities.find((x: any) =>
        /(religion|faith)/i.test(String(x?.type || "")) && x?.key
      );
    if (r?.key) religionKey = r.key;
  }

  return {
    ...user,
    collegeSlug: collegeSlug ?? null,
    religionKey: religionKey ?? null,
  };
}

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

  const applyAuthState = useCallback((u: any | null, cs: any[]) => {
    // ... (This function is correct, no changes needed)
    if (!mountedRef.current) return;
    const safeCommunities = Array.isArray(cs) ? cs : [];
    const augmentedUser = deriveScope(u, safeCommunities);
    setUser(augmentedUser);
    setCommunities(safeCommunities);

    if (__DEV__) {
      console.log("[Auth] applyAuthState", {
        userHasScope: !!augmentedUser?.collegeSlug && !!augmentedUser?.religionKey,
        collegeSlug: augmentedUser?.collegeSlug ?? null,
        religionKey: augmentedUser?.religionKey ?? null,
        communities: safeCommunities.map((c: any) => ({
          id: c?._id,
          type: c?.type,
          key: c?.key,
        })),
      });
    }
  }, []);

  const clearAuthState = useCallback(async () => {
    // ... (This function is correct, no changes needed)
    if (clearingRef.current) return;
    clearingRef.current = true;
    try {
      await removeAccessToken();
    } catch {}
    disconnectSocket();
    applyAuthState(null, []);
    if (mountedRef.current) setIsLoading(false);
    clearingRef.current = false;
  }, [applyAuthState]);

  const triedLegacyOnce = useRef(false);
  const refreshBootstrap = useCallback(async () => {
    // ... (This function is correct, no changes needed)
    const tryPath = async (path: string) => {
      const { data } = await api.get(path);
      return data;
    };

    try {
      // Preferred modern path
      const data = await tryPath("/api/bootstrap");
      applyAuthState(data?.user || null, data?.communities || []);
    } catch (err: any) {
      // If server is older and only has /bootstrap without /api prefix, do a one-time fallback
      const status = err?.response?.status;
      if (status === 404 && !triedLegacyOnce.current) {
        triedLegacyOnce.current = true;
        const data = await tryPath("/bootstrap");
        applyAuthState(data?.user || null, data?.communities || []);
        return;
      }

      // Token problems → clear and stop
      if (err?.response?.status === 401) {
        await clearAuthState();
        return;
      }
      throw err;
    }
  }, [applyAuthState, clearAuthState]);

  const initialLoad = useCallback(async () => {
    // ... (This function is correct, no changes needed)
    try {
      const token = await getAccessToken();
      if (token) {
        console.log('[AuthContext] Found token, attempting bootstrap and push registration...');
        await refreshSocketAuth(token);
        await refreshBootstrap();
        await registerForPushNotificationsAsync();
        console.log('[AuthContext] Initial push registration attempt finished.');
      } else {
        applyAuthState(null, []);
      }
    } catch {
      await clearAuthState();
    } finally {
      if (mountedRef.current) setIsLoading(false);
      try {
        await SplashScreen.hideAsync();
      } catch {}
    }
  }, [applyAuthState, clearAuthState, refreshBootstrap]);

  useEffect(() => {
    // ... (This function is correct, no changes needed)
    setUnauthorizedHandler(async () => {
      await clearAuthState();
    });
  }, [clearAuthState]);

  useEffect(() => {
    // ... (This function is correct, no changes needed)
    initialLoad();
  }, [initialLoad]);

  const completeLoginFromToken = useCallback(
    async (token: string) => {
      // ... (This function is correct, no changes needed)
      await setAccessToken(token);
      await refreshSocketAuth(token);
      await refreshBootstrap();
      console.log('[AuthContext] Bootstrap complete, now registering for push notifications...');
      await registerForPushNotificationsAsync();
      console.log('[AuthContext] Push notification registration attempt finished.');
    },
    [refreshBootstrap]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      // ... (This function is correct, no changes needed)
      const res = await apiLogin(email, password);
      if (!res?.token) throw new Error("No token received from server");
      await completeLoginFromToken(res.token);
    },
    [completeLoginFromToken]
  );

  // --- THIS IS THE FIX (PART 1) ---
  const doRegister = useCallback(
    async (input: RegisterInput): Promise<RegisterResponse> => {
      // This function now just calls apiRegister and returns the response.
      // It DOES NOT log the user in.
      const res = await apiRegister(input);
      return res; // Returns { message: "..." }
    },
    [] // No dependencies
  );
  // --- END OF FIX (PART 1) ---

  const signOut = useCallback(async () => {
    // ... (This function is correct, no changes needed)
    await clearAuthState();
  }, [clearAuthState]);

  // Back-compat shims
  const setTokenCompat = useCallback(async (token: string) => {
      await completeLoginFromToken(token);
    }, [completeLoginFromToken]);
  
  const bootstrapCompat = useCallback(async () => {
      await refreshBootstrap();
    }, [refreshBootstrap]);
  
  // --- THIS IS THE FIX (PART 2) ---
  // We update this adapter to return the response from doRegister
  const registerCompat = useCallback(
    async (input: RegisterInput): Promise<RegisterResponse> => {
      return doRegister(input); // <-- It now returns the response
    },
    [doRegister]
  );
  // --- END OF FIX (PART 2) ---

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthed: !!user,
      user,
      communities,
      signIn,
      register: registerCompat, // <-- This now correctly returns { message: "..." }
      signOut,
      refreshBootstrap,
      setToken: setTokenCompat,
      bootstrap: bootstrapCompat,
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
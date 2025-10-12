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
  bootstrap as apiBootstrap,
} from "../api/auth";
import {
  setAccessToken,
  removeAccessToken,
  getAccessToken,
} from "../utils/storage";
import { setUnauthorizedHandler } from "../api/api";
import { refreshSocketAuth, disconnectSocket } from "../api/socket";

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
  register: (input: RegisterInput) => Promise<void>;
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
  register: async () => {},
  signOut: async () => {},
  refreshBootstrap: async () => {},
  setToken: async () => {},
  bootstrap: async () => {},
});

// keep the splash until we hydrate once
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Derive collegeSlug / religionKey from communities when missing on user */
function deriveScope(user: any | null, communities: any[]) {
  if (!user) return user;

  const hasCollege = !!user.collegeSlug;
  const hasReligion = !!user.religionKey;

  if (hasCollege && hasReligion) return user;

  let collegeSlug: string | null | undefined = user.collegeSlug ?? null;
  let religionKey: string | null | undefined = user.religionKey ?? null;

  if (!collegeSlug) {
    // look for community typed/marked as college
    const c =
      communities.find((x: any) => x?.type === "college" && x?.key) ||
      communities.find((x: any) => /college/i.test(String(x?.type || "")) && x?.key);
    if (c?.key) collegeSlug = c.key;
  }

  if (!religionKey) {
    // look for community typed/marked as religion/faith
    const r =
      communities.find((x: any) => (x?.type === "religion" || x?.type === "faith") && x?.key) ||
      communities.find((x: any) => /(religion|faith)/i.test(String(x?.type || "")) && x?.key);
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
    if (!mountedRef.current) return;

    const safeCommunities = Array.isArray(cs) ? cs : [];

    // ⬇️ Normalize/augment user with derived scope (collegeSlug, religionKey)
    const augmentedUser = deriveScope(u, safeCommunities);

    setUser(augmentedUser);
    setCommunities(safeCommunities);

    if (__DEV__) {
      console.log("[Auth] applyAuthState", {
        userHasScope: !!augmentedUser?.collegeSlug && !!augmentedUser?.religionKey,
        collegeSlug: augmentedUser?.collegeSlug ?? null,
        religionKey: augmentedUser?.religionKey ?? null,
        communities: safeCommunities.map((c: any) => ({ id: c?._id, type: c?.type, key: c?.key })),
      });
    }
  }, []);

  const clearAuthState = useCallback(async () => {
    if (clearingRef.current) return; // guard
    clearingRef.current = true;
    try {
      await removeAccessToken();
    } catch {}
    disconnectSocket();
    applyAuthState(null, []);
    if (mountedRef.current) setIsLoading(false);
    clearingRef.current = false; // release
  }, [applyAuthState]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiBootstrap();
      applyAuthState(data?.user || null, data?.communities || []);
    } catch (error: any) {
      // If the token is bad/expired, clear local state + token and STOP here.
      if (error?.response?.status === 401) {
        await clearAuthState();
        return; // prevents retry loops
      }
      throw error; // other errors still bubble
    }
  }, [applyAuthState, clearAuthState]);

  // Initial hydration
  const initialLoad = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        await refreshSocketAuth(token);
        await refreshBootstrap();
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
    // One global 401 hook: clears auth and socket, UI reacts naturally.
    setUnauthorizedHandler(async () => {
      await clearAuthState();
    });
  }, [clearAuthState]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  // Centralized token→state transition (+ socket auth)
  const completeLoginFromToken = useCallback(
    async (token: string) => {
      // Persist token first so interceptors & socket can use it
      await setAccessToken(token);
      await refreshSocketAuth(token);
      await refreshBootstrap();
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

  const doRegister = useCallback(
    async (input: RegisterInput) => {
      const res = await apiRegister(input);
      if (!res?.token) throw new Error("No token received from server");
      await completeLoginFromToken(res.token);
    },
    [completeLoginFromToken]
  );

  const signOut = useCallback(async () => {
    await clearAuthState();
  }, [clearAuthState]);

  // Back-compat shims your UI references in some places
  const setTokenCompat = useCallback(
    async (token: string) => {
      await completeLoginFromToken(token);
    },
    [completeLoginFromToken]
  );

  const bootstrapCompat = useCallback(async () => {
    await refreshBootstrap();
  }, [refreshBootstrap]);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthed: !!user,
      user,
      communities,
      signIn,
      register: doRegister,
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
      doRegister,
      signOut,
      refreshBootstrap,
      setTokenCompat,
      bootstrapCompat,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
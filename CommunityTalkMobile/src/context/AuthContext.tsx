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
  register: (input: RegisterInput) => Promise<RegisterResponse>;
  signOut: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  setToken?: (token: string) => Promise<void>;
  bootstrap?: () => Promise<void>;
  updateAvatar?: (newUrl: string) => void; // Add to type definition
};

export const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthed: false,
  user: null,
  communities: [],
  signIn: async () => {},
  register: async () => ({ message: "" }),
  signOut: async () => {},
  refreshBootstrap: async () => {},
  setToken: async () => {},
  bootstrap: async () => {},
  updateAvatar: () => {}, // Default no-op
});

SplashScreen.preventAutoHideAsync().catch(() => {});

function deriveScope(user: any | null, communities: any[]) {
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
    if (!mountedRef.current) return;
    const safeCommunities = Array.isArray(cs) ? cs : [];
    const augmentedUser = deriveScope(u, safeCommunities);
    setUser(augmentedUser);
    setCommunities(safeCommunities);
  }, []);

  const clearAuthState = useCallback(async () => {
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
    const tryPath = async (path: string) => {
      const { data } = await api.get(path);
      return data;
    };

    try {
      const data = await tryPath("/api/bootstrap");
      applyAuthState(data?.user || null, data?.communities || []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 && !triedLegacyOnce.current) {
        triedLegacyOnce.current = true;
        const data = await tryPath("/bootstrap");
        applyAuthState(data?.user || null, data?.communities || []);
        return;
      }
      if (err?.response?.status === 401) {
        await clearAuthState();
        return;
      }
      throw err;
    }
  }, [applyAuthState, clearAuthState]);

  const initialLoad = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        await refreshSocketAuth(token);
        await refreshBootstrap();
        await registerForPushNotificationsAsync();
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
    setUnauthorizedHandler(async () => {
      await clearAuthState();
    });
  }, [clearAuthState]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const completeLoginFromToken = useCallback(
    async (token: string) => {
      await setAccessToken(token);
      await refreshSocketAuth(token);
      await refreshBootstrap();
      await registerForPushNotificationsAsync();
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
    async (input: RegisterInput): Promise<RegisterResponse> => {
      const res = await apiRegister(input);
      return res;
    },
    []
  );

  const signOut = useCallback(async () => {
    await clearAuthState();
  }, [clearAuthState]);

  const setTokenCompat = useCallback(async (token: string) => {
      await completeLoginFromToken(token);
    }, [completeLoginFromToken]);
  
  const bootstrapCompat = useCallback(async () => {
      await refreshBootstrap();
    }, [refreshBootstrap]);
  
  const registerCompat = useCallback(
    async (input: RegisterInput): Promise<RegisterResponse> => {
      return doRegister(input);
    },
    [doRegister]
  );

  // ✅ FIXED: Ensure deep clone of user object to trigger re-render
  const updateAvatar = useCallback((newAvatarUrl: string) => {
    setUser((prev: any) => {
      if (!prev) return null;
      // Return a brand new object reference
      return { ...prev, avatar: newAvatarUrl };
    });
  }, []);

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
      updateAvatar, // ✅ Now included correctly
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
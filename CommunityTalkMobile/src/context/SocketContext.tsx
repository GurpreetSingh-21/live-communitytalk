// CommunityTalkMobile/src/context/SocketContext.tsx
import React, {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { connectSocket, disconnectSocket, getSocket } from "../api/socket";
import { AuthContext } from "./AuthContext";
import { api } from "../api/api";

type SocketRef = ReturnType<typeof getSocket> | null;

type SocketContextValue = {
  socket: SocketRef;
  socketConnected: boolean;
  unreadThreads: Record<string, number>;
  unreadDMs: number;
  unreadCommunities: number;
  refreshUnread: () => Promise<void>;
  markThreadRead: (partnerId: string) => Promise<void>;
};

const defaultValue: SocketContextValue = {
  socket: null,
  socketConnected: false,
  unreadThreads: {},
  unreadDMs: 0,
  unreadCommunities: 0,
  refreshUnread: async () => { },
  markThreadRead: async () => { },
};

export const SocketContext = createContext(defaultValue);

export const useSocket = () => React.useContext(SocketContext);

/* -------------------------------------------------------------------------- */
/*                          MAIN PROVIDER (PATCHED)                           */
/* -------------------------------------------------------------------------- */

export const SocketProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { isAuthed, user, communities } =
    React.useContext(AuthContext) as any;

  const [ready, setReady] = useState(false);
  const [unreadThreads, setUnreadThreads] =
    useState<Record<string, number>>({});
  const [communityUnreads, setCommunityUnreads] =
    useState<Record<string, number>>({});

  const userIdRef = useRef<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  userIdRef.current = user?._id ? String(user._id) : null;

  /* ------------------------- Build Community ID Set ------------------------ */
  const myCommunityIds = useMemo(() => {
    if (Array.isArray(communities)) {
      return new Set(
        communities
          .map((c: any) => String(c?._id || c?.id || ""))
          .filter(Boolean)
      );
    }

    if (Array.isArray(user?.communityIds)) {
      return new Set(user.communityIds.map((id: any) => String(id)));
    }

    return new Set<string>();
  }, [communities, user?.communityIds]);

  /* --------------------------- Derived counts ------------------------------ */

  const unreadDMs = useMemo(() => {
    return Object.entries(unreadThreads).reduce((acc, [threadId, count]) => {
      if (!myCommunityIds.has(threadId)) {
        return acc + (Number.isFinite(count) ? count : 0);
      }
      return acc;
    }, 0);
  }, [unreadThreads, myCommunityIds]);

  const unreadCommunities = useMemo(() => {
    return Object.values(communityUnreads).reduce(
      (a, b) => a + (Number.isFinite(b) ? b : 0),
      0
    );
  }, [communityUnreads]);

  /* -------------------------------------------------------------------------- */
  /*                              API: UNREAD FETCHES                           */
  /* -------------------------------------------------------------------------- */

  const refreshDMUnread = React.useCallback(async () => {
    if (!isAuthed) {
      setUnreadThreads({});
      return;
    }

    try {
      const { data } = await api.get("/api/direct-messages");
      const list =
        Array.isArray(data) || Array.isArray(data?.items)
          ? data?.items || data
          : [];

      const next: Record<string, number> = {};
      for (const t of list) {
        const partnerId = String(t.partnerId || "");
        const count = Number(t.unread || 0);
        if (partnerId) next[partnerId] = count;
      }

      setUnreadThreads(next);
    } catch (err) {
      setUnreadThreads({});
    }
  }, [isAuthed]);

  const refreshCommunityUnread = React.useCallback(async () => {
    if (!isAuthed || !myCommunityIds.size) {
      setCommunityUnreads({});
      return;
    }

    try {
      // Optimized: Fetch all in one batch instead of N calls
      // We can use the same /my-threads endpoint since it includes 'unread'
      const { data } = await api.get('/api/communities/my-threads');

      const out: Record<string, number> = {};
      const items = data?.items || [];

      for (const item of items) {
        if (item.id) {
          out[String(item.id)] = Number(item.unread || 0);
        }
      }

      setCommunityUnreads(out);
    } catch {
      setCommunityUnreads({});
    }
  }, [isAuthed, myCommunityIds]);

  const refreshUnread = React.useCallback(async () => {
    if (!isAuthed) return;
    await Promise.all([refreshDMUnread(), refreshCommunityUnread()]);
  }, [isAuthed, refreshDMUnread, refreshCommunityUnread]);

  /* -------------------------------------------------------------------------- */
  /*                         MARK THREAD AS READ (DM or Community)             */
  /* -------------------------------------------------------------------------- */

  const markThreadRead = React.useCallback(
    async (partnerId: string) => {
      if (!isAuthed || !partnerId) return;

      const isCommunity = myCommunityIds.has(partnerId);

      try {
        if (isCommunity) {
          await api.patch(`/api/communities/${partnerId}/read`);
          setCommunityUnreads((prev) => ({
            ...prev,
            [partnerId]: 0,
          }));
        } else {
          await api.patch(`/api/direct-messages/${partnerId}/read`);
          setUnreadThreads((prev) => ({
            ...prev,
            [partnerId]: 0,
          }));
        }
      } catch (err) {
        console.warn("[socket] failed to mark read:", err);
      }
    },
    [isAuthed, myCommunityIds]
  );

  /* -------------------------------------------------------------------------- */
  /*                          SOCKET CONNECTION LIFECYCLE                       */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;
    let socket: SocketRef = null;

    const start = async () => {
      /* ---------- Logout or not ready ---------- */
      if (!isAuthed || !user || !communities) {
        setReady(false);
        setUnreadThreads({});
        setCommunityUnreads({});
        disconnectSocket();
        return;
      }

      /* ---------- Establish socket ---------- */
      await connectSocket();
      if (!mounted) return;

      socket = getSocket();
      if (!socket) return;

      /* ------------------ ROOM LOGIC ------------------ */
      const college = user?.collegeSlug ?? user?.collegeId ?? null;
      const faith = user?.religionKey ?? user?.faithId ?? null;

      const eventsRoom =
        typeof college === "string" && typeof faith === "string"
          ? `college:${college}:faith:${faith}`
          : null;

      const bindRooms = () => {
        if (!socket) return;

        if (eventsRoom) {
          socket.emit?.("events:join", { room: eventsRoom });
        }

        const ids = Array.from(myCommunityIds);
        if (ids.length > 0) {
          socket.emit?.("subscribe:communities", { ids });
          console.log("🟣 Subscribed to communities:", ids.length);
        }

        if (eventsRoom) {
          console.log("🟢 Joined events room:", eventsRoom);
        }
      };

      /* ------------------ EVENT HANDLERS ------------------ */

      const onConnect = () => {
        console.log("🔌 Socket connected:", socket?.id);
        bindRooms();
        refreshUnread();
      };

      const onDisconnect = () => {
        console.log("⚠️ Socket disconnected");
      };

      const onDM = (payload: any) => {
        const myId = userIdRef.current;
        const to = String(payload?.to || "");
        const from = String(payload?.from || "");

        if (myId && to === myId) {
          setUnreadThreads((prev) => ({
            ...prev,
            [from]: (prev[from] || 0) + 1,
          }));
        }
      };

      const onCommunityMessage = (payload: any) => {
        const communityId = String(payload?.communityId || "");
        const senderId = String(payload?.senderId || payload?.sender?._id || "");
        const myId = userIdRef.current;

        if (communityId && senderId !== myId && myCommunityIds.has(communityId)) {
          setCommunityUnreads((prev) => ({
            ...prev,
            [communityId]: (prev[communityId] || 0) + 1,
          }));
        }
      };

      /* ------------------ BIND LISTENERS ------------------ */

      socket.on?.("connect", onConnect);
      socket.on?.("disconnect", onDisconnect);
      socket.on?.("receive_direct_message", onDM);
      socket.on?.("dm:message", onDM);
      socket.on?.("receive_message", onCommunityMessage);
      socket.on?.("message:new", onCommunityMessage);

      /* ------------------ INITIAL UNREADS ------------------ */
      await refreshUnread();

      setReady(true);

      /* ------------------ CLEANUP ------------------ */
      return () => {
        socket?.off?.("connect", onConnect);
        socket?.off?.("disconnect", onDisconnect);
        socket?.off?.("receive_direct_message", onDM);
        socket?.off?.("dm:message", onDM);
        socket?.off?.("receive_message", onCommunityMessage);
        socket?.off?.("message:new", onCommunityMessage);
      };
    };

    start();

    return () => {
      mounted = false;
      socket?.removeAllListeners?.();
      disconnectSocket();
    };
  }, [
    isAuthed,
    user,
    communities,
    refreshUnread,
    user?.collegeSlug,
    user?.religionKey,
    myCommunityIds,
  ]);

  /* -------------------------------------------------------------------------- */
  /*                         APPSTATE → REFRESH UNREAD ON RESUME               */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === "active" &&
        isAuthed
      ) {
        console.log("📱 App resumed → refresh unread");
        refreshUnread();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [isAuthed, refreshUnread]);

  /* -------------------------------------------------------------------------- */
  /*                                CONTEXT VALUE                               */
  /* -------------------------------------------------------------------------- */

  const value = useMemo(
    () => ({
      socket: ready ? getSocket() : null,
      socketConnected: ready,
      unreadThreads,
      unreadDMs,
      unreadCommunities,
      refreshUnread,
      markThreadRead,
    }),
    [
      ready,
      unreadThreads,
      unreadDMs,
      unreadCommunities,
      refreshUnread,
      markThreadRead,
    ]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
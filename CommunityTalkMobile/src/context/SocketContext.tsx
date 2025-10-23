// CommunityTalkMobile/src/context/SocketContext.tsx
import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
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
  refreshUnread: async () => {},
  markThreadRead: async () => {},
};

export const SocketContext = createContext<SocketContextValue>(defaultValue);
export const useSocket = () => React.useContext(SocketContext);

export const SocketProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthed, user, communities } = React.useContext(AuthContext) as any;

  const [ready, setReady] = useState(false);
  const [unreadThreads, setUnreadThreads] = useState<Record<string, number>>({});
  const [communityUnreads, setCommunityUnreads] = useState<Record<string, number>>({});
  const userIdRef = useRef<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  userIdRef.current = user?._id ? String(user._id) : null;

  // Get user's community IDs as a Set for fast lookup
  const myCommunityIds = useMemo(() => {
    const ids = Array.isArray(communities) 
      ? communities.map((c: any) => String(c?._id || c?.id || ''))
      : Array.isArray(user?.communityIds)
      ? user.communityIds.map((id: any) => String(id))
      : [];
    return new Set(ids.filter(Boolean));
  }, [communities, user?.communityIds]);

  /* ----------------------- Derived counts ----------------------- */
  // DMs: count unread from threads that are NOT in community IDs
  const unreadDMs = useMemo(() => {
    return Object.entries(unreadThreads).reduce((acc, [threadId, count]) => {
      if (!myCommunityIds.has(threadId)) {
        return acc + (Number.isFinite(count) ? count : 0);
      }
      return acc;
    }, 0);
  }, [unreadThreads, myCommunityIds]);

  // Communities: sum all community unreads
  const unreadCommunities = useMemo(() => {
    return Object.values(communityUnreads).reduce(
      (a, b) => a + (Number.isFinite(b) ? b : 0),
      0
    );
  }, [communityUnreads]);

  /* ----------------------- API Helpers ----------------------- */
  
  // Refresh DM unreads
  const refreshDMUnread = React.useCallback(async () => {
    if (!isAuthed) {
      setUnreadThreads({});
      return;
    }
    try {
      const { data } = await api.get("/api/direct-messages");
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const next: Record<string, number> = {};
      for (const t of list) {
        const pid = String(t.partnerId || "");
        const cnt = Number(t.unread || 0);
        if (pid) next[pid] = cnt;
      }
      setUnreadThreads(next);
    } catch {
      setUnreadThreads({});
    }
  }, [isAuthed]);

  // Refresh community unreads
  const refreshCommunityUnread = React.useCallback(async () => {
    if (!isAuthed || !myCommunityIds.size) {
      setCommunityUnreads({});
      return;
    }
    try {
      // Fetch unread count for each community
      const communityIds = Array.from(myCommunityIds);
      const results = await Promise.all(
        communityIds.map(async (cId) => {
          try {
            const { data } = await api.get(`/api/communities/${cId}/unread`);
            return { id: cId, count: Number(data?.unread || data?.count || 0) };
          } catch {
            return { id: cId, count: 0 };
          }
        })
      );
      
      const next: Record<string, number> = {};
      results.forEach(({ id, count }) => {
        const idStr = String(id);
        if (idStr) next[idStr] = count;
      });
      setCommunityUnreads(next);
    } catch {
      setCommunityUnreads({});
    }
  }, [isAuthed, myCommunityIds]);

  // Combined refresh function
  const refreshUnread = React.useCallback(async () => {
    await Promise.all([
      refreshDMUnread(),
      refreshCommunityUnread(),
    ]);
  }, [refreshDMUnread, refreshCommunityUnread]);

  const markThreadRead = React.useCallback(
    async (partnerId: string) => {
      if (!isAuthed || !partnerId) return;
      
      // Check if it's a community or DM
      const isCommunity = myCommunityIds.has(partnerId);
      
      try {
        if (isCommunity) {
          // Mark community as read
          await api.patch(`/api/communities/${partnerId}/read`);
          setCommunityUnreads((prev) => {
            if (!prev[partnerId]) return prev;
            const next = { ...prev };
            next[partnerId] = 0;
            return next;
          });
        } else {
          // Mark DM as read
          await api.patch(`/api/direct-messages/${partnerId}/read`);
          setUnreadThreads((prev) => {
            if (!prev[partnerId]) return prev;
            const next = { ...prev };
            next[partnerId] = 0;
            return next;
          });
        }
      } catch (error) {
        console.error("[Socket] Failed to mark thread as read:", error);
      }
    },
    [isAuthed, myCommunityIds]
  );

  /* ----------------------- Socket Lifecycle ----------------------- */
  useEffect(() => {
    let mounted = true;
    let socketRef: SocketRef = null;

    const attach = async () => {
      if (!isAuthed) {
        setReady(false);
        setUnreadThreads({});
        setCommunityUnreads({});
        disconnectSocket();
        return;
      }

      await connectSocket();
      if (!mounted) return;
      
      socketRef = getSocket();
      if (!socketRef) return;

      const college = user?.collegeSlug ?? user?.collegeId ?? null;
      const faith = user?.religionKey ?? user?.faithId ?? null;
      const eventsRoom =
        typeof college === "string" && typeof faith === "string"
          ? `college:${college}:faith:${faith}`
          : null;

      const joinRooms = () => {
        if (!socketRef) return;
        
        if (eventsRoom) {
          socketRef.emit?.("events:join", { room: eventsRoom });
        }
        
        // Subscribe to all user's communities
        const communityIds = Array.from(myCommunityIds);
        if (communityIds.length > 0) {
          socketRef.emit?.("subscribe:communities", { ids: communityIds });
          console.log("🏛️ Subscribed to communities:", communityIds.length);
        }
        
        console.log("🏫 Joined room:", eventsRoom);
      };

      socketRef.on?.("connect", () => {
        console.log("🔌 Socket connected:", socketRef?.id);
        joinRooms();
        refreshUnread();
      });

      socketRef.on?.("disconnect", () => console.log("⚠️ Socket disconnected"));

      /* -------------------- Event Handlers -------------------- */
      
      // Handle incoming DM
      const onReceiveDM = (payload: any) => {
        console.log("📩 [SocketContext] DM:", payload);
        const myId = userIdRef.current;
        const to = String(payload?.to || "");
        const from = String(payload?.from || "");
        if (myId && to && from && myId === to) {
          setUnreadThreads((prev) => ({
            ...prev,
            [from]: (prev[from] || 0) + 1,
          }));
        }
      };

      // Handle incoming community message
      const onCommunityMessage = (payload: any) => {
        console.log("💬 [SocketContext] receive_message:", payload);
        const communityId = String(payload?.communityId || "");
        const senderId = String(payload?.senderId || payload?.sender?._id || "");
        const myId = userIdRef.current;
        
        // Only increment unread if message is from someone else and it's a community we're in
        if (communityId && senderId !== myId && myCommunityIds.has(communityId)) {
          setCommunityUnreads((prev) => ({
            ...prev,
            [communityId]: (prev[communityId] || 0) + 1,
          }));
        }
      };

      const onCommunityNew = (data: any) => {
        console.log("🆕 [SocketContext] message:new:", data);
        // Same logic as onCommunityMessage
        const communityId = String(data?.communityId || "");
        const senderId = String(data?.senderId || data?.sender?._id || "");
        const myId = userIdRef.current;
        
        if (communityId && senderId !== myId && myCommunityIds.has(communityId)) {
          setCommunityUnreads((prev) => ({
            ...prev,
            [communityId]: (prev[communityId] || 0) + 1,
          }));
        }
      };

      /* Register Events */
      if (socketRef) {
        socketRef.on?.("receive_direct_message", onReceiveDM);
        socketRef.on?.("dm:message", onReceiveDM);
        socketRef.on?.("receive_message", onCommunityMessage);
        socketRef.on?.("message:new", onCommunityNew);
      }

      await refreshUnread();
      if (socketRef) {
        joinRooms();
      }
      setReady(true);

      return () => {
        if (!socketRef) return;
        socketRef.off?.("receive_direct_message", onReceiveDM);
        socketRef.off?.("dm:message", onReceiveDM);
        socketRef.off?.("receive_message", onCommunityMessage);
        socketRef.off?.("message:new", onCommunityNew);
      };
    };

    attach();

    return () => {
      mounted = false;
      socketRef?.removeAllListeners?.();
      disconnectSocket();
    };
  }, [isAuthed, refreshUnread, user?.collegeSlug, user?.religionKey, user?.collegeId, user?.faithId, myCommunityIds]);

  /* ----------------------- AppState Resume ----------------------- */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        console.log("📱 App resumed, refreshing unread...");
        refreshUnread();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refreshUnread]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: ready ? getSocket() : null,
      socketConnected: ready,
      unreadThreads,
      unreadDMs,
      unreadCommunities,
      refreshUnread,
      markThreadRead,
    }),
    [ready, unreadThreads, unreadDMs, unreadCommunities, refreshUnread, markThreadRead]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { connectSocket, disconnectSocket, getSocket } from "../api/socket";
import { AuthContext } from "./AuthContext";
import { api } from "../api/api";

type SocketRef = ReturnType<typeof getSocket> | null;

type SocketContextValue = {
  socket: SocketRef;
  unreadThreads: Record<string, number>;
  unreadDMs: number;
  refreshUnread: () => Promise<void>;
  markThreadRead: (partnerId: string) => Promise<void>;
};

const defaultValue: SocketContextValue = {
  socket: null,
  unreadThreads: {},
  unreadDMs: 0,
  refreshUnread: async () => {},
  markThreadRead: async () => {},
};

export const SocketContext = createContext<SocketContextValue>(defaultValue);
export const useSocket = () => React.useContext(SocketContext);

export const SocketProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthed, user } = React.useContext(AuthContext) as any;

  const [ready, setReady] = useState(false);
  const [unreadThreads, setUnreadThreads] = useState<Record<string, number>>({});
  const userIdRef = useRef<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  userIdRef.current = user?._id ? String(user._id) : null;

  /* ----------------------- Derived count ----------------------- */
  const unreadDMs = useMemo(
    () => Object.values(unreadThreads).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [unreadThreads]
  );

  /* ----------------------- API Helpers ----------------------- */
  const refreshUnread = React.useCallback(async () => {
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

  const markThreadRead = React.useCallback(
    async (partnerId: string) => {
      if (!isAuthed || !partnerId) return;
      try {
        await api.patch(`/api/direct-messages/${partnerId}/read`);
        setUnreadThreads((prev) => {
          if (!prev[partnerId]) return prev;
          const next = { ...prev };
          next[partnerId] = 0;
          return next;
        });
      } catch (error) {
        console.error("[Socket] Failed to mark thread as read:", error);
      }
    },
    [isAuthed]
  );

  /* ----------------------- Socket Lifecycle ----------------------- */
  useEffect(() => {
    let mounted = true;
    let s: SocketRef = null;

    const attach = async () => {
      if (!isAuthed) {
        setReady(false);
        setUnreadThreads({});
        disconnectSocket();
        return;
      }

      await connectSocket();
      if (!mounted) return;
      s = getSocket();
      if (!s) return;

      const college = user?.collegeSlug ?? user?.collegeId ?? null;
      const faith = user?.religionKey ?? user?.faithId ?? null;
      const eventsRoom =
        typeof college === "string" && typeof faith === "string"
          ? `college:${college}:faith:${faith}`
          : null;

      const joinRooms = () => {
        if (eventsRoom) s.emit?.("events:join", { room: eventsRoom });
        console.log("🏫 Joined room:", eventsRoom);
      };

      s.on?.("connect", () => {
        console.log("🔌 Socket connected:", s?.id);
        joinRooms();
        refreshUnread();
      });

      s.on?.("disconnect", () => console.log("⚠️ Socket disconnected"));

      /* -------------------- Event Handlers -------------------- */
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

      const onCommunityMessage = (payload: any) => {
        console.log("💬 [SocketContext] receive_message:", payload);
      };

      const onCommunityNew = (data: any) => {
        console.log("🆕 [SocketContext] message:new:", data);
      };

      /* Register Events */
      s.on?.("receive_direct_message", onReceiveDM);
      s.on?.("dm:message", onReceiveDM);
      s.on?.("receive_message", onCommunityMessage);
      s.on?.("message:new", onCommunityNew);

      await refreshUnread();
      joinRooms();
      setReady(true);

      return () => {
        s.off?.("receive_direct_message", onReceiveDM);
        s.off?.("dm:message", onReceiveDM);
        s.off?.("receive_message", onCommunityMessage);
        s.off?.("message:new", onCommunityNew);
      };
    };

    attach();

    return () => {
      mounted = false;
      s?.removeAllListeners?.();
      disconnectSocket();
    };
  }, [isAuthed, refreshUnread, user?.collegeSlug, user?.religionKey, user?.collegeId, user?.faithId]);

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
      unreadThreads,
      unreadDMs,
      refreshUnread,
      markThreadRead,
    }),
    [ready, unreadThreads, unreadDMs, refreshUnread, markThreadRead]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
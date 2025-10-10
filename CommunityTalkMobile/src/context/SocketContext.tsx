// CommunityTalkMobile/src/context/SocketContext.tsx
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
  userIdRef.current = user?._id ? String(user._id) : null;

  const appState = useRef<AppStateStatus>(AppState.currentState);

  const unreadDMs = useMemo(
    () => Object.values(unreadThreads).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [unreadThreads]
  );

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
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setUnreadThreads({});
      }
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

  useEffect(() => {
    let mounted = true;
    let s: SocketRef = null;
    let cleanup: (() => void) | undefined;

    const attach = async () => {
      try {
        if (!isAuthed) {
          setReady(false);
          setUnreadThreads({});
          disconnectSocket();
          return;
        }

        await connectSocket();
        if (!mounted) return;

        s = getSocket();

        await refreshUnread();

        const onRoomsInit = () => refreshUnread();

        const onReceiveDM = (payload: any) => {
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

        s?.on?.("rooms:init", onRoomsInit);
        s?.on?.("receive_direct_message", onReceiveDM);
        s?.on?.("receive_message", () => {});
        s?.on?.("message:ack", () => {});
        s?.on?.("message:updated", () => {});
        s?.on?.("message:deleted", () => {});
        s?.on?.("dm_read", () => {});
        s?.on?.("direct_message:edited", () => {});
        s?.on?.("direct_message:deleted", () => {});

        setReady(true);

        cleanup = () => {
          s?.off?.("rooms:init", onRoomsInit);
          s?.off?.("receive_direct_message", onReceiveDM);
        };
      } catch (error) {
        console.error("[Socket] Connection failed:", error);
        if (mounted) {
          setReady(false);
          disconnectSocket();
        }
      }
    };

    attach();

    return () => {
      mounted = false;
      cleanup?.();
      s?.off?.("rooms:init");
      s?.off?.("receive_direct_message");
      s?.off?.("receive_message");
      s?.off?.("message:ack");
      s?.off?.("message:updated");
      s?.off?.("message:deleted");
      s?.off?.("dm_read");
      s?.off?.("direct_message:edited");
      s?.off?.("direct_message:deleted");
      disconnectSocket();
    };
  }, [isAuthed, refreshUnread]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
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
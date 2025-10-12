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
      // On 401 or network errors, just clear local state and do NOT rethrow
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

        // 1) connect socket (token must already be in storage)
        await connectSocket();
        if (!mounted) return;

        s = getSocket();

        // 2) join the events room based on user scope
        const college = user?.collegeSlug ?? user?.collegeId ?? null;
        const faith = user?.religionKey ?? user?.faithId ?? null;
        const eventsRoom =
          typeof college === "string" && typeof faith === "string"
            ? `college:${college}:faith:${faith}`
            : null;

        if (eventsRoom) {
          // centralize the join here so any screen benefits from realtime events
          s?.emit?.("events:join", { room: eventsRoom });
        }

        // 3) hydrate unread counts and hook basic socket events
        await refreshUnread();

        const onRoomsInit = () => {
          // Re-hydrate unread on room init
          refreshUnread();
          // Re-join events room on server-driven rejoin scenarios
          if (eventsRoom) s?.emit?.("events:join", { room: eventsRoom });
        };

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

        // (Optional) you can listen to event notifications here if you want global toasts:
        // s?.on?.("events:created", () => {});
        // s?.on?.("events:updated", () => {});
        // s?.on?.("events:deleted", () => {});
        // s?.on?.("events:rsvpCount", () => {});

        setReady(true);

        cleanup = () => {
          if (eventsRoom) s?.emit?.("events:leave", { room: eventsRoom });
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
  }, [isAuthed, refreshUnread, user?.collegeSlug, user?.religionKey, user?.collegeId, user?.faithId]);

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
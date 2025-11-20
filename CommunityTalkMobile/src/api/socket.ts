// CommunityTalkMobile/src/api/socket.ts
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../utils/config";
import { getAccessToken } from "../utils/storage";

/* ============================================================
   INTERNAL STATE
   ============================================================ */
let socket: Socket | null = null;
let tokenLoaded = false;

/** Called by AuthContext when token finished loading */
export function markSocketTokenLoaded() {
  tokenLoaded = true;
}

/* ============================================================
   HELPERS
   ============================================================ */
function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function getSocketBase(): string {
  return normalizeBase(API_BASE_URL);
}

/* ============================================================
   CREATE + CONNECT SOCKET
   ============================================================ */
export async function connectSocket(providedToken?: string): Promise<Socket> {
  const token = providedToken ?? (await getAccessToken());

  if (!token) {
    throw new Error("No token available for socket connection");
  }

  // Clean up existing socket
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {}
    socket = null;
  }

  const base = getSocketBase();
  if (__DEV__) {
    console.log("[socket] Connecting to:", base);
  }

  socket = io(base, {
    transports: ["websocket"],
    path: "/socket.io",
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },

    // Reconnect settings
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    timeout: 20000,

    // A fresh Manager instance every time → avoids stale state across logins
    forceNew: true,
    autoConnect: true,
  });

  // Return a promise for initial connection
  return new Promise<Socket>((resolve, reject) => {
    const cleanup = () => {
      socket?.off("connect", onConnect);
      socket?.off("connect_error", onError);
      socket?.off("error", onError);
    };

    const onConnect = () => {
      cleanup();
      if (__DEV__) console.log("[socket] Connected.");
      resolve(socket!);
    };

    const onError = (err: any) => {
      cleanup();
      console.error("[socket] Initial connect error:", err?.message || err);
      reject(err);
    };

    socket?.once("connect", onConnect);
    socket?.once("connect_error", onError);
    socket?.once("error", onError);
  });
}

/* ============================================================
   REFRESH TOKEN (called after login or token refresh)
   ============================================================ */
export async function refreshSocketAuth(newToken?: string): Promise<void> {
  const token = newToken ?? (await getAccessToken());
  if (!token) return;

  // If no socket yet, create new one
  if (!socket) {
    await connectSocket(token);
    return;
  }

  // Update auth for reconnect
  socket.auth = { token };

  try {
    (socket.io.opts as any).extraHeaders = {
      Authorization: `Bearer ${token}`,
    };
  } catch {}

  if (__DEV__) {
    console.log("[socket] Auth refreshed.");
  }

  // Reconnect if not connected
  if (!socket.connected) {
    try {
      socket.connect();
    } catch {}
  }
}

/* ============================================================
   SAFE GETTERS
   ============================================================ */
export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return !!socket && socket.connected;
}

/* ============================================================
   DISCONNECT CLEANLY
   ============================================================ */
export function disconnectSocket(): void {
  if (__DEV__) console.log("[socket] Disconnecting…");

  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } catch {}

  socket = null;
}

/* ============================================================
   WAIT FOR CONNECTION
   ============================================================ */
export async function waitForConnection(ms = 10000): Promise<Socket> {
  if (socket?.connected) return socket;

  return new Promise<Socket>((resolve, reject) => {
    const s = socket;
    if (!s) {
      return reject(new Error("Socket not created"));
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Socket connect wait timed out"));
    }, ms);

    const onConnect = () => {
      cleanup();
      resolve(s);
    };

    const onError = (err: any) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      s.off("connect", onConnect);
      s.off("connect_error", onError);
      s.off("error", onError);
    };

    s.once("connect", onConnect);
    s.once("connect_error", onError);
    s.once("error", onError);

    if (!s.connected) {
      try {
        s.connect();
      } catch {}
    }
  });
}
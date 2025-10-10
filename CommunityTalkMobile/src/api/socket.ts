// CommunityTalkMobile/src/api/socket.ts
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../utils/config";
import { getAccessToken } from "../utils/storage";

let socket: Socket | null = null;

/** Normalize base URL (strip trailing slashes) */
function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Build the Socket.IO endpoint from API_BASE_URL */
function getSocketBase(): string {
  
  return normalizeBase(API_BASE_URL);
}

/**
 * Create (or re-create) a connected socket.
 * Will resolve when "connect" fires, or reject on initial connect_error.
 */
export async function connectSocket(providedToken?: string): Promise<Socket> {
  const token = providedToken ?? (await getAccessToken());
  if (!token) throw new Error("No token for socket connection");

  // If an old socket exists, clean it up first
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {}
    socket = null;
  }

  socket = io(getSocketBase(), {
    // IMPORTANT for React Native
    transports: ["websocket"],
    path: "/socket.io",
    // Auth header for server handshake
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },

    // Reconnect policy
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,       // start backoff at 0.5s
    reconnectionDelayMax: 8000,   // cap backoff
    timeout: 20000,               // 20s connect timeout

    // Create a fresh Manager for this socket (avoids stale state across logouts)
    forceNew: true,
    autoConnect: true,
  });

  // Return a promise that settles on first connect or error
  return new Promise<Socket>((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve(socket!);
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      socket?.off("connect", onConnect);
      socket?.off("connect_error", onError);
      socket?.off("error", onError);
    };

    socket?.once("connect", onConnect);
    socket?.once("connect_error", onError);
    socket?.once("error", onError);
  });
}

/** Update the auth token and (re)connect without rebuilding listeners. */
export async function refreshSocketAuth(newToken?: string): Promise<void> {
  const token = newToken ?? (await getAccessToken());
  if (!token) return;

  // If socket exists, set new auth and reconnect
  if (socket) {

    socket.auth = { token };
    try {
      // Also update extraHeaders for RN environments

      socket.io.opts.extraHeaders = { Authorization: `Bearer ${token}` };
    } catch {}
    if (!socket.connected) socket.connect();
  } else {
    // If no socket yet, just connect fresh
    await connectSocket(token);
  }
}

/** Safe getter: returns the current socket instance or null. */
export function getSocket(): Socket | null {
  return socket;
}

/** Quick boolean for guards/UI. */
export function isSocketConnected(): boolean {
  return !!socket && socket.connected === true;
}

/** Disconnect and drop the singleton. */
export function disconnectSocket(): void {
  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } finally {
    socket = null;
  }
}

/**
 * Small helper if you need to await a connected socket in a screen:
 * - waits up to `ms` (default 10s)
 * - resolves immediately if already connected
 */
export async function waitForConnection(ms = 10000): Promise<Socket> {
  if (socket?.connected) return socket;

  return new Promise<Socket>((resolve, reject) => {
    const s = socket;
    if (!s) return reject(new Error("Socket not created"));

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
    if (!s.connected) s.connect();
  });
}
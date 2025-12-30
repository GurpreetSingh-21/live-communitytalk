// CommunityTalkMobile/src/api/dm.ts
import { api } from "./api";

/* ---------- Types aligned to backend ---------- */

export type DMConversation = {
  partnerId: string;           // Person._id of the other user
  fullName: string;
  avatar?: string;
  lastMessage?: string;
  hasAttachment?: boolean;
  lastStatus?: "sent" | "edited" | "deleted" | "read";
  lastId?: string;
  lastTimestamp?: string | Date;
  unread?: number;
};

export type DMMessage = {
  _id: string;
  from: string;                // sender Person._id
  to: string;                  // recipient Person._id
  content: string;
  attachments?: Array<{ url: string; type?: string; name?: string; size?: number }>;
  timestamp: string | Date;    // createdAt
  status: "sent" | "read" | "edited" | "deleted";
  readAt?: string | Date;
  editedAt?: string | Date;
  deletedAt?: string | Date;
  isDeleted?: boolean;
};

type CommonOpts = { signal?: AbortSignal };

/* ---------- Small utils ---------- */

// Validate Prisma CUID format (starts with 'c', ~25 alphanumeric chars)
const isValidUserId = (s?: string) => !!s && /^c[a-z0-9]{20,30}$/i.test(s);

/* ---------------------------------------------------------------------- */
/*                          CONVERSATION LIST (INBOX)                     */
/*   GET /api/direct-messages  -> returns array of conversations          */
/* ---------------------------------------------------------------------- */

export async function listDMThreads(opts?: CommonOpts): Promise<DMConversation[]> {
  const { data } = await api.get<DMConversation[]>("/api/direct-messages", {
    signal: opts?.signal,
  });
  return Array.isArray(data) ? data : [];
}

/* ---------------------------------------------------------------------- */
/*                       FETCH MESSAGES WITH A USER                       */
/*   GET /api/direct-messages/:memberId?limit=50                          */
/*   Server returns { items: DMMessage[] } (already oldest→newest)        */
/* ---------------------------------------------------------------------- */

export async function getDMMessages(
  threadIdOrUserId: string,
  opts?: { limit?: number } & CommonOpts
): Promise<DMMessage[]> {
  const memberId = threadIdOrUserId;
  if (!isValidUserId(memberId)) throw new Error("Invalid memberId");

  const params: any = {};
  if (opts?.limit) params.limit = opts.limit;

  const { data } = await api.get<{ items: DMMessage[] }>(`/api/direct-messages/${memberId}`, {
    params,
    signal: opts?.signal,
  });

  const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
  // Normalize field name for timestamp consistency
  return items.map((m: any) => ({
    ...m,
    timestamp: m.timestamp ?? m.createdAt,
  }));
}

/* ---------------------------------------------------------------------- */
/*                         SEND A DIRECT MESSAGE                          */
/*   POST /api/direct-messages  { to, content, attachments? }             */
/*   Returns the created message payload                                  */
/* ---------------------------------------------------------------------- */

export async function sendDMMessage(
  input:
    & (
      | { toUserId: string; content: string; attachments?: DMMessage["attachments"] }
      | { threadId: string; content: string; attachments?: DMMessage["attachments"] } // compat: threadId === partner's userId
    )
    & CommonOpts
): Promise<DMMessage> {
  const { signal, ...rest } = input as any;
  const toUserId: string = rest.toUserId ?? rest.threadId;

  if (!isValidUserId(toUserId)) throw new Error("toUserId (partner id) must be a valid user ID");
  if (!rest.content?.trim() && !Array.isArray(rest.attachments)) {
    throw new Error("content or attachments required");
  }

  const body = {
    to: toUserId,
    content: (rest.content || "").trim(),
    attachments: Array.isArray(rest.attachments) ? rest.attachments : [],
  };

  const { data } = await api.post<DMMessage>("/api/direct-messages", body, { signal });
  return { ...data, timestamp: (data as any).timestamp ?? (data as any).createdAt };
}

/* ---------------------------------------------------------------------- */
/*             MARK CONVERSATION WITH USER AS READ ON SERVER              */
/*   PATCH /api/direct-messages/:memberId/read                            */
/* ---------------------------------------------------------------------- */

export async function markDMRead(memberId: string, opts?: CommonOpts): Promise<number> {
  if (!isValidUserId(memberId)) throw new Error("Invalid memberId");
  const { data } = await api.patch<{ updated: number }>(
    `/api/direct-messages/${memberId}/read`,
    {},
    { signal: opts?.signal }
  );
  return data?.updated ?? 0;
}

/* ---------------------------------------------------------------------- */
/*          COMPAT HELPERS (to avoid refactors elsewhere right now)       */
/* ---------------------------------------------------------------------- */

/**
 * getOrCreateDMThread(otherUserId)
 * Your backend has no "thread" entity; the partner's Person._id *is* the key.
 * We emulate "get-or-create" by verifying the id and returning a synthetic thread object.
 */
export type DMThread = { _id: string; participants: string[]; lastMessage?: { content: string; timestamp: string | Date; senderId: string } };

export async function getOrCreateDMThread(otherUserId: string, opts?: CommonOpts): Promise<DMThread> {
  if (!isValidUserId(otherUserId)) throw new Error("otherUserId must be a valid user ID");

  // Best-effort: fetch inbox to see if we already have history (optional)
  let lastMessage: DMThread["lastMessage"] | undefined;
  try {
    const msgs = await getDMMessages(otherUserId, { limit: 1, signal: opts?.signal });
    if (msgs.length) {
      const m = msgs[msgs.length - 1];
      lastMessage = { content: m.content, timestamp: m.timestamp, senderId: m.from };
    }
  } catch {
    // ignore; we can still DM without history
  }

  // Return a synthetic "thread" describing the 1-1 DM mapping
  return {
    _id: otherUserId, // treat partner's id as the thread id
    participants: [otherUserId],
    lastMessage,
  };
}
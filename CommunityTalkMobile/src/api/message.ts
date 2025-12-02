// CommunityTalkMobile/src/api/message.ts
import { api } from "./api";

/* ---------- Types ---------- */

export type ChatMessageStatus = "sent" | "delivered" | "read" | "edited" | "deleted";

export type ChatMessage = {
  _id: string;
  sender: string;           // display name (if your API returns it)
  senderId: string;
  avatar?: string;
  content: string;
  timestamp: string | Date; // server may send string; we normalize below (optional)
  communityId: string;
  status: ChatMessageStatus;
  editedAt?: string | Date;
  isDeleted?: boolean;
  deletedAt?: string | Date;
  deliveredAt?: string | Date;
  readAt?: string | Date;
  /** client-generated id to dedupe optimistic sends */
  clientMessageId?: string;
};

/** Optional flags for helpers below */
type CommonOpts = {
  /** Abort long requests when navigating away */
  signal?: AbortSignal;
  /** Convert timestamp/editedAt/deletedAt to Date objects (default: false) */
  mapDatesToJS?: boolean;
};

/* ---------- Internal helpers ---------- */

function toISO(val: Date | string): string {
  return val instanceof Date ? val.toISOString() : new Date(val).toISOString();
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `? ${s} ` : "";
}

function mapDates<T extends ChatMessage | Partial<ChatMessage>>(m: T, enable = false): T {
  if (!enable || !m) return m;
  const next: any = { ...m };
  if (next.timestamp) next.timestamp = new Date(next.timestamp);
  if (next.editedAt) next.editedAt = new Date(next.editedAt);
  if (next.deletedAt) next.deletedAt = new Date(next.deletedAt);
  return next;
}

/* ---------- API calls ---------- */

/**
 * Fetch messages for a community, optionally before a cursor and with a limit.
 * Returns an array (backwards-compatible). Use `mapDatesToJS` if you want Date objects.
 */
export async function getMessages(
  communityId: string,
  opts?: { before?: Date | string; limit?: number } & CommonOpts
): Promise<ChatMessage[]> {
  if (!communityId) throw new Error("communityId is required");

  const query = buildQuery({
    before: opts?.before ? toISO(opts.before) : undefined,
    limit: opts?.limit !== undefined ? String(opts.limit) : undefined,
  });

  const { data } = await api.get<ChatMessage[]>(
    `/ api / messages / ${encodeURIComponent(communityId)}${query} `,
    { signal: opts?.signal }
  );

  // Some backends wrap as {items: [...]}; handle both shapes
  const list: ChatMessage[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.items)
      ? (data as any).items
      : [];

  if (opts?.mapDatesToJS) {
    return list.map((m) => mapDates(m, true));
  }
  return list;
}

/** Fetch the single latest message for a community. */
export async function getLatestMessage(
  communityId: string,
  opts?: CommonOpts
): Promise<ChatMessage | null> {
  if (!communityId) throw new Error("communityId is required");

  const { data } = await api.get<ChatMessage | null>(
    `/ api / messages / ${encodeURIComponent(communityId)}/latest`,
    { signal: opts?.signal }
  );

  if (!data) return null;
  return opts?.mapDatesToJS ? mapDates(data, true) : data;
}

/**
 * Send a message. You can pass a `clientMessageId` for optimistic UI + de-dupe.
 * The server response is returned (normalized if requested).
 */
export async function sendMessage(
  input: {
    communityId: string;
    content: string;
    attachments?: any[];
    clientMessageId?: string;
  } & CommonOpts
): Promise<ChatMessage> {
  const { signal, mapDatesToJS, ...body } = input;
  if (!body.communityId) throw new Error("communityId is required");
  if (!body.content?.trim()) throw new Error("content is required");

  const { data } = await api.post<ChatMessage>(`/api/messages`, body, { signal });
  return mapDatesToJS ? mapDates(data, true) : data;
}

/** Edit a message’s content. */
export async function editMessage(
  messageId: string,
  content: string,
  opts?: CommonOpts
): Promise<Partial<ChatMessage>> {
  if (!messageId) throw new Error("messageId is required");
  const { data } = await api.patch<Partial<ChatMessage>>(
    `/api/messages/${encodeURIComponent(messageId)}`,
    { content },
    { signal: opts?.signal }
  );
  return opts?.mapDatesToJS ? mapDates(data, true) : data;
}

/** Delete a message (soft delete typical). */
export async function deleteMessage(
  messageId: string,
  opts?: CommonOpts
): Promise<{
  _id: string;
  communityId: string;
  isDeleted: true;
  deletedAt: string | Date;
  status: "deleted";
  senderId: string;
}> {
  if (!messageId) throw new Error("messageId is required");
  const { data } = await api.delete<{
    _id: string;
    communityId: string;
    isDeleted: true;
    deletedAt: string | Date;
    status: "deleted";
    senderId: string;
  }>(`/api/messages/${encodeURIComponent(messageId)}`, { signal: opts?.signal });

  return opts?.mapDatesToJS ? mapDates(data, true) : data;
}
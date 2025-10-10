// CommunityTalkMobile/src/api/community.ts
import { api } from "./api";
import type { Community } from "./auth";

/* ---------- Types ---------- */

export type MemberStatus = "online" | "offline";

export type Member = {
  _id: string;
  person: string | null;
  community: string;
  fullName: string;
  email?: string;
  avatar?: string;
  status: MemberStatus;
  isYou: boolean;
};

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ListPage<T> = {
  items: T[];
} & PageMeta;

type CommonOpts = {
  /** Cancel long requests when navigating away */
  signal?: AbortSignal;
};

/* ---------- Helpers ---------- */

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    // Avoid empty strings
    const s = String(v);
    if (s.length === 0) return;
    qs.set(k, s);
  });
  const str = qs.toString();
  return str ? `?${str}` : "";
}

/** Accepts either array or {items,...} and returns a normalized array + meta (if present). */
function normalizePage<T>(data: any):
  | { type: "array"; items: T[] }
  | { type: "paged"; page: ListPage<T> } {
  if (Array.isArray(data)) return { type: "array", items: data as T[] };
  if (Array.isArray(data?.items) && typeof data?.page === "number") {
    return { type: "paged", page: data as ListPage<T> };
  }
  // Fallback: try items without meta
  if (Array.isArray(data?.items)) return { type: "array", items: data.items as T[] };
  return { type: "array", items: [] };
}

/* ---------- API calls ---------- */

/**
 * Public communities directory.
 * Returns either an array of communities or a paginated object, depending on API response.
 */
export async function listPublicCommunities(
  params?: {
    q?: string;
    type?: "college" | "religion" | "custom";
    paginated?: boolean | string;
    page?: number;
    limit?: number;
  } & CommonOpts
): Promise<ListPage<Community> | Community[]> {
  const { signal, ...rest } = params ?? {};
  const query = buildQuery({
    q: rest.q,
    type: rest.type,
    paginated: rest.paginated !== undefined ? String(rest.paginated) : undefined,
    page: rest.page,
    limit: rest.limit,
  });

  const { data } = await api.get(`/api/public/communities${query}`, { signal });
  const norm = normalizePage<Community>(data);
  return norm.type === "paged" ? norm.page : norm.items;
}

/**
 * Authed communities list (user’s communities).
 * Supports both array and paginated shapes.
 */
export async function listCommunities(
  params?: { q?: string; paginated?: boolean; page?: number; limit?: number } & CommonOpts
): Promise<ListPage<Community> | Community[]> {
  const { signal, ...rest } = params ?? {};
  const query = buildQuery({
    q: rest.q,
    paginated: rest.paginated ? "true" : undefined,
    page: rest.page,
    limit: rest.limit,
  });

  const { data } = await api.get(`/api/communities${query}`, { signal });
  const norm = normalizePage<Community>(data);
  return norm.type === "paged" ? norm.page : norm.items;
}

/** Fetch a single community by id. */
export async function getCommunity(id: string, opts?: CommonOpts): Promise<Community> {
  if (!id) throw new Error("community id is required");
  const { data } = await api.get<Community>(`/api/communities/${encodeURIComponent(id)}`, {
    signal: opts?.signal,
  });
  return data;
}

/** Join a community. Server shape is app-specific; we return what it sends. */
export async function joinCommunity(id: string, opts?: CommonOpts) {
  if (!id) throw new Error("community id is required");
  const { data } = await api.post(`/api/communities/${encodeURIComponent(id)}/join`, null, {
    signal: opts?.signal,
  });
  return data;
}

/** Leave a community. Server shape is app-specific; we return what it sends. */
export async function leaveCommunity(id: string, opts?: CommonOpts) {
  if (!id) throw new Error("community id is required");
  const { data } = await api.post(`/api/communities/${encodeURIComponent(id)}/leave`, null, {
    signal: opts?.signal,
  });
  return data;
}

/**
 * List members for a community.
 * Cursor paging supported: { items, nextCursor, hasMore }
 */
export async function listMembers(
  communityId: string,
  opts?: {
    q?: string;
    status?: MemberStatus;
    limit?: number;
    cursor?: string;
  } & CommonOpts
): Promise<CursorPage<Member>> {
  if (!communityId) throw new Error("communityId is required");

  const { signal, ...rest } = opts ?? {};
  const query = buildQuery({
    q: rest.q,
    status: rest.status,
    limit: rest.limit,
    cursor: rest.cursor,
  });

  const { data } = await api.get<CursorPage<Member>>(
    `/api/members/${encodeURIComponent(communityId)}${query}`,
    { signal }
  );

  // Tolerate incomplete shapes by normalizing
  return {
    items: Array.isArray((data as any)?.items) ? (data as any).items : [],
    nextCursor: (data as any)?.nextCursor ?? null,
    hasMore: Boolean((data as any)?.hasMore),
  };
}
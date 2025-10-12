// CommunityTalkMobile/src/api/events.ts
import { api } from "./api";

export type EventDoc = {
  _id: string;
  title: string;
  description?: string;
  startsAt: string; // ISO, matches backend
  endsAt?: string;  // ISO
  collegeId: string;
  faithId: string;
  communityId?: string | null;
  location?: { kind: "in-person" | "online"; address?: string; url?: string };
  tags?: string[];
  cover?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse = {
  items: EventDoc[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

type ListOpts = {
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
};

/** GET /api/events (scoped by JWT on the server) */
export async function listEvents(opts?: ListOpts): Promise<ListResponse> {
  try {
    console.log("[events.ts] listEvents() called with:", opts);

    const url = "/api/events";
    console.log("[events.ts] GET", url, "params:", opts);

    const { data, status, headers } = await api.get(url, {
      params: opts,
      signal: opts?.signal,
    });

    console.log("[events.ts] ✅ Response received", {
      status,
      itemCount: Array.isArray(data?.items) ? data.items.length : "N/A",
      nextCursor: data?.nextCursor ?? null,
      hasMore: data?.hasMore ?? false,
      tokenExp: headers?.["x-token-exp"],
    });

    return data;
  } catch (error: any) {
    console.log("[events.ts] ❌ Error fetching /api/events:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      data: error?.response?.data,
      url: error?.config?.url,
      headers: error?.config?.headers,
    });
    throw error;
  }
}
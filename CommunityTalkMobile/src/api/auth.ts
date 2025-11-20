// src/api/auth.ts
import { api } from "./api";
// ⭐ NEW: Import for token check
import { getAccessToken } from "../utils/storage"; 

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */

export type UserRole = "user" | "mod" | "admin";

export type User = {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  communityIds?: string[];
  collegeSlug?: string | null;
  religionKey?: string | null;
};

export type CommunityType = "college" | "religion" | "custom";

export type Community = {
  _id: string;
  name: string;
  type?: CommunityType;
  key?: string;
  createdAt?: string;
  updatedAt?: string;

  // NEW: /bootstrap returns this
  lastMessage?: {
    content?: string;
    timestamp?: string | Date;
  };
};

export type AuthBundle = {
  message: string;
  token: string;
  user: User;
  communities: Community[];
};

export type RegisterResponse = {
  message: string;
};

export type BootstrapBundle = {
  user: User;
  communities: Community[];
};

export type ProfileBundle = {
  message: string;
  user: User;
  communities: Community[];
  iat?: number;
  exp?: number;
};

type CommonOpts = { signal?: AbortSignal };

/* ───────────────────────────────────────────
   Utils
   ─────────────────────────────────────────── */

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertNonEmpty(name: string, v: string) {
  if (!v || v.trim() === "") {
    throw new Error(`${name} is required`);
  }
}

/* ───────────────────────────────────────────
   API Calls
   ─────────────────────────────────────────── */

/** LOGIN → returns { token, user, communities } */
export async function login(
  email: string,
  password: string,
  opts?: CommonOpts
): Promise<AuthBundle> {
  assertNonEmpty("email", email);
  assertNonEmpty("password", password);

  const { data } = await api.post<AuthBundle>(
    "/api/login",
    { email: normalizeEmail(email), password },
    { signal: opts?.signal }
  );

  if (!data?.token) throw new Error("No token received from server");
  return data;
}

/**
 * REGISTER → UPDATED
 * Server now returns ONLY `{ message }`
 */
export async function register(
  input: {
    fullName: string;
    email: string;
    password: string;
    collegeId: string;
    religionId: string;
  },
  opts?: CommonOpts
): Promise<RegisterResponse> {
  assertNonEmpty("fullName", input.fullName);
  assertNonEmpty("email", input.email);
  assertNonEmpty("password", input.password);
  assertNonEmpty("collegeId", input.collegeId);
  assertNonEmpty("religionId", input.religionId);

  const payload = {
    ...input,
    email: normalizeEmail(input.email),
  };

  const { data } = await api.post<RegisterResponse>(
    "/api/register",
    payload,
    { signal: opts?.signal }
  );

  if (!data?.message) {
    throw new Error("Invalid register response from server");
  }

  return data;
}

/* ───────────────────────────────────────────
   BOOTSTRAP
   Fetches { user, communities }
   Uses in-flight guard in dev mode
   ─────────────────────────────────────────── */

let bootstrapInflight: Promise<BootstrapBundle> | null = null;

export async function bootstrap(
  opts?: CommonOpts
): Promise<BootstrapBundle> {
  // ⭐ FIX: Check for token first. If not found, throw an error
  // that AuthContext can handle without hitting the network for a 401.
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Bootstrap failed: No access token found in storage.");
  }
  
  // Avoid duplication in development only
  if (__DEV__ && bootstrapInflight) return bootstrapInflight;

  const p = api
    .get<BootstrapBundle>("/api/bootstrap", { signal: opts?.signal })
    .then((res) => {
      if (!res.data?.user) {
        throw new Error("Invalid bootstrap response");
      }
      return res.data;
    })
    .finally(() => {
      bootstrapInflight = null;
    });

  if (__DEV__) bootstrapInflight = p;
  return p;
}

/* ───────────────────────────────────────────
   PROFILE
   Returns extended user + communities
   ─────────────────────────────────────────── */

export async function profile(
  opts?: CommonOpts
): Promise<ProfileBundle> {
  const { data } = await api.get<ProfileBundle>("/api/profile", {
    signal: opts?.signal,
  });
  return data;
}
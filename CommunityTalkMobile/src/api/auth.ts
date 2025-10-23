// CommunityTalkMobile/src/api/auth.ts
import { api } from "./api";

/** ===== Types ===== */

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
};

export type AuthBundle = {
  message: string;
  token: string;
  user: User;
  communities: Community[];
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

/** ===== Utils ===== */

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertNonEmpty(name: string, v: string) {
  if (!v || v.trim() === "") {
    throw new Error(`${name} is required`);
  }
}

/** ===== API Calls ===== */

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

export async function register(
  input: {
    fullName: string;
    email: string;
    password: string;
    collegeId: string;
    religionId: string;
  },
  opts?: CommonOpts
): Promise<AuthBundle> {
  assertNonEmpty("fullName", input.fullName);
  assertNonEmpty("email", input.email);
  assertNonEmpty("password", input.password);
  assertNonEmpty("collegeId", input.collegeId);
  assertNonEmpty("religionId", input.religionId);

  const payload = { ...input, email: normalizeEmail(input.email) };

  const { data } = await api.post<AuthBundle>("/api/register", payload, {
    signal: opts?.signal,
  });

  if (!data?.token) throw new Error("No token received from server");
  return data;
}

/**
 * Fetch user + communities using the current Bearer token.
 * Memoized while an identical request is in flight to avoid duplicate calls
 * (helpful in React 18 Strict Mode).
 */
let bootstrapInflight: Promise<BootstrapBundle> | null = null;

export async function bootstrap(opts?: CommonOpts): Promise<BootstrapBundle> {
  if (__DEV__ && bootstrapInflight) return bootstrapInflight;

  const p = api
    .get<BootstrapBundle>("/api/bootstrap", { signal: opts?.signal })
    .then((r) => {
      if (!r.data?.user) throw new Error("Invalid bootstrap response");
      return r.data;
    })
    .finally(() => {
      bootstrapInflight = null;
    });

  if (__DEV__) bootstrapInflight = p;
  return p;
}

export async function profile(opts?: CommonOpts): Promise<ProfileBundle> {
  const { data } = await api.get<ProfileBundle>("/api/profile", {
    signal: opts?.signal,
  });
  return data;
}
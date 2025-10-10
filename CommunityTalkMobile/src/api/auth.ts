// CommunityTalkMobile/src/api/auth.ts
import { api } from "./api";

export type UserRole = "user" | "mod" | "admin";

export type User = {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  communityIds?: string[];
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertNonEmpty(name: string, v: string) {
  if (!v || v.trim() === "") {
    throw new Error(`${name} is required`);
  }
}

export async function login(
  email: string,
  password: string,
  opts?: CommonOpts
): Promise<AuthBundle> {
  assertNonEmpty("email", email);
  assertNonEmpty("password", password);

  const { data } = await api.post<AuthBundle>(
    "/login",
    { email: normalizeEmail(email), password },
    { signal: opts?.signal }
  );
  
  if (!data?.token) {
    throw new Error("No token received from server");
  }
  
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

  const payload = {
    ...input,
    email: normalizeEmail(input.email),
  };

  const { data } = await api.post<AuthBundle>("/register", payload, {
    signal: opts?.signal,
  });
  
  if (!data?.token) {
    throw new Error("No token received from server");
  }
  
  return data;
}

export async function bootstrap(opts?: CommonOpts): Promise<BootstrapBundle> {
  const { data } = await api.get<BootstrapBundle>("/bootstrap", {
    signal: opts?.signal,
  });
  
  if (!data?.user) {
    throw new Error("Invalid bootstrap response");
  }
  
  return data;
}

export async function profile(opts?: CommonOpts): Promise<ProfileBundle> {
  const { data } = await api.get<ProfileBundle>("/profile", {
    signal: opts?.signal,
  });
  return data;
}
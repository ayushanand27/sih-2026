import { API_BASE_URL } from "./api";

export interface AuthUserPayload {
  id: string;
  name: string;
  identifier: string;
  email?: string | null;
  mobile?: string | null;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: AuthUserPayload;
}

async function parseAuthError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    /* ignore */
  }
  return res.statusText || "Authentication failed.";
}

export async function authLogin(input: {
  identifier: string;
  password: string;
  rememberMe: boolean;
}): Promise<AuthSession> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: input.identifier,
      password: input.password,
      remember_me: input.rememberMe,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseAuthError(res));
  }
  const body = await res.json();
  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in,
    user: body.user,
  };
}

export async function authRegister(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
}): Promise<AuthSession> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseAuthError(res));
  }
  const body = await res.json();
  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in,
    user: body.user,
  };
}

export async function authMe(token: string): Promise<AuthUserPayload> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseAuthError(res));
  }
  return (await res.json()) as AuthUserPayload;
}

export async function authForgotPassword(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await parseAuthError(res));
  }
  return (await res.json()) as { message: string };
}

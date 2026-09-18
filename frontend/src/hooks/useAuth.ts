"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ipsakti:auth";

export interface AuthUser {
  name: string;
  /** The email or mobile number this session was authenticated with — shown
   * under the name in the account rail. */
  identifier: string;
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Placeholder client-side "session" for the login/signup UI shell — there's
 * no backend auth yet (the API only serves the RAG chatbot), so this just
 * persists a display name/identifier locally until a real auth backend
 * exists. */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readStoredUser());
  }, []);

  const login = useCallback((next: AuthUser) => {
    setUser(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode, etc.) — session still applies for this tab.
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable — nothing to clear.
    }
  }, []);

  return { user, login, logout };
}

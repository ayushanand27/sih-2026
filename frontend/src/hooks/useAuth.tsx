"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authForgotPassword,
  authLogin,
  authMe,
  authRegister,
  type AuthSession,
} from "@/lib/authApi";

export interface AuthUser {
  id: string;
  name: string;
  identifier: string;
}

const USER_KEY = "ipsakti:auth";
const TOKEN_KEY = "ipsakti:auth_token";
const REMEMBER_KEY = "ipsakti:auth_remember";

function readRememberPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "0";
}

function storageForToken(remember: boolean): Storage {
  return remember ? window.localStorage : window.sessionStorage;
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY)
  );
}

function persistSession(session: AuthSession, remember: boolean) {
  const store = storageForToken(remember);
  const other = remember ? window.sessionStorage : window.localStorage;
  store.setItem(TOKEN_KEY, session.accessToken);
  store.setItem(
    USER_KEY,
    JSON.stringify({
      id: session.user.id,
      name: session.user.name,
      identifier: session.user.identifier,
    } satisfies AuthUser)
  );
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

function clearStoredSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
}

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginWithPassword: (
    identifier: string,
    password: string,
    rememberMe: boolean
  ) => Promise<void>;
  registerAccount: (input: {
    name: string;
    email: string;
    mobile: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  requestPasswordReset: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const token = readStoredToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await authMe(token);
        if (!cancelled) {
          setUser({ id: me.id, name: me.name, identifier: me.identifier });
        }
      } catch {
        clearStoredSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithPassword = useCallback(
    async (identifier: string, password: string, rememberMe: boolean) => {
      const session = await authLogin({ identifier, password, rememberMe });
      persistSession(session, rememberMe);
      setUser({
        id: session.user.id,
        name: session.user.name,
        identifier: session.user.identifier,
      });
    },
    []
  );

  const registerAccount = useCallback(
    async (input: { name: string; email: string; mobile: string; password: string }) => {
      const session = await authRegister(input);
      persistSession(session, true);
      setUser({
        id: session.user.id,
        name: session.user.name,
        identifier: session.user.identifier,
      });
    },
    []
  );

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async () => {
    const res = await authForgotPassword();
    return res.message;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginWithPassword,
      registerAccount,
      logout,
      requestPasswordReset,
    }),
    [user, loading, loginWithPassword, registerAccount, logout, requestPasswordReset]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Session state shared across the marketing page, chat shell, and modals. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export { readRememberPreference };

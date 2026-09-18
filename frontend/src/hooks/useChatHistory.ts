"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConversationMessage, Jurisdiction } from "@/lib/types";

export interface ChatSession {
  id: string;
  jurisdiction: Jurisdiction;
  category: string | null;
  title: string;
  messages: ConversationMessage[];
  updatedAt: number;
}

const STORAGE_KEY = "ipsakti:chatHistory";
const MAX_SESSIONS = 30;

function readSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Omit<ChatSession, "jurisdiction"> & { jurisdiction: string }>) : [];
    return parsed.map((s) => ({
      ...s,
      jurisdiction: (s.jurisdiction === "national" ? "india" : s.jurisdiction) as Jurisdiction,
    }));
  } catch {
    return [];
  }
}

function writeSessions(sessions: ChatSession[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage unavailable (private mode, etc.) — history just won't persist.
  }
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Local-only chat history — there's no backend session storage yet, so each
 * conversation is saved to localStorage keyed by a session id, newest first.
 * This backs the chat page's "New chat" (starts a fresh id) and "Chat
 * history" (lists and resumes past sessions from here) controls. */
export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSessions(readSessions());
    setLoaded(true);
  }, []);

  const saveSession = useCallback((session: ChatSession) => {
    setSessions((prev) => {
      const next = [session, ...prev.filter((s) => s.id !== session.id)]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_SESSIONS);
      writeSessions(next);
      return next;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeSessions(next);
      return next;
    });
  }, []);

  return { sessions, loaded, saveSession, deleteSession };
}

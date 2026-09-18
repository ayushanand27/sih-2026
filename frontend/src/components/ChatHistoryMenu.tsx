"use client";

import { useState } from "react";
import type { ChatSession } from "@/hooks/useChatHistory";
import { SidePanel } from "./SidePanel";

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-neu-text">
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4.5 9A8 8 0 1 1 4 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M2.5 6v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
      <path
        d="M5 7h14M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4L17 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

/** Dropdown listing locally-saved chat sessions (see `useChatHistory`) —
 * clicking one resumes it, the trash icon removes it from history only
 * (the active conversation, if it's the one open, is unaffected). */
export function ChatHistoryMenu({
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
}: {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-neu-text shadow-neuSm transition hover:bg-neu-bg"
      >
        <IconHistory />
        History
        {sessions.length > 0 && (
          <span className="rounded-full bg-neu-bg px-1.5 text-[10px] font-bold text-neu-sub">
            {sessions.length}
          </span>
        )}
      </button>

      <SidePanel open={open} onClose={() => setOpen(false)} widthClassName="w-80 max-w-[85vw]">
        <p className="px-1 pb-2 text-sm font-bold text-neu-text">Chat history</p>
        {sessions.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-neu-sub">
            No saved conversations yet — ask a question to start one.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-xl px-1 transition-colors ${
                s.id === currentSessionId ? "bg-neu-bg" : "hover:bg-neu-bg/60"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left"
              >
                <p className="truncate text-xs font-semibold text-neu-text">{s.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-neu-sub">
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 font-medium">
                    {s.jurisdiction === "india" ? "India" : "International"}
                  </span>
                  {relativeTime(s.updatedAt)}
                </p>
              </button>
              <button
                type="button"
                title="Delete from history"
                onClick={() => onDelete(s.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neu-sub opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
              >
                <IconTrash />
              </button>
            </div>
          ))
        )}
      </SidePanel>
    </div>
  );
}

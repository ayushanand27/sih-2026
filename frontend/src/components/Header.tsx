"use client";

import type { Jurisdiction } from "@/lib/types";
import type { LANGUAGES, LanguageCode } from "@/hooks/useLanguage";
import type { ChatSession } from "@/hooks/useChatHistory";
import { DISCLAIMER_LONG } from "@/lib/disclaimer";
import { LogoBadge } from "@/components/brand/LogoBadge";
import { FontSizeControl } from "@/components/brand/FontSizeControl";
import { LanguageSwitcher } from "@/components/brand/LanguageSwitcher";
import { JurisdictionCompare } from "./JurisdictionCompare";
import { NewChatButton } from "./NewChatButton";
import { ChatHistoryMenu } from "./ChatHistoryMenu";
import { HelpMenu } from "./help/HelpMenu";

export function Header({
  jurisdiction,
  category,
  lastQuestion,
  onChangeContext,
  language,
  onLanguageChange,
  onNewChat,
  chatSessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
}: {
  jurisdiction: Jurisdiction;
  category: string | null;
  lastQuestion: string | null;
  onChangeContext: () => void;
  language: (typeof LANGUAGES)[number];
  onLanguageChange: (code: LanguageCode) => void;
  onNewChat: () => void;
  chatSessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
}) {
  return (
    <div className="m-3 mb-0 shrink-0 overflow-hidden rounded-3xl bg-neu-surface shadow-neu sm:m-4 sm:mb-0">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onChangeContext}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-neu-text shadow-neuSm transition hover:bg-neu-bg"
          >
            <span aria-hidden>←</span> Back to setup
          </button>
          <LogoBadge className="h-10 w-10" />

          <div className="min-w-0 border-l border-neu-bg pl-3">
            <p className="truncate text-base font-bold text-neu-text">
              IP-SAKTI Sahayak{" "}
              <span className="text-xs font-semibold text-neu-sub">
                — An Initiative under Ministry of AYUSH
              </span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neu-sub">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-600">
                {jurisdiction === "india" ? "India" : "International"}
              </span>
              {category && (
                <span className="rounded-full bg-[#EDF2E2] px-2 py-0.5 font-medium text-[#5B6F45]">
                  {category}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <NewChatButton onClick={onNewChat} />
          <ChatHistoryMenu
            sessions={chatSessions}
            currentSessionId={currentSessionId}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
          />
          <FontSizeControl />
          <LanguageSwitcher language={language} onChange={onLanguageChange} />
          <JurisdictionCompare
            jurisdiction={jurisdiction}
            category={category}
            lastQuestion={lastQuestion}
          />
          <HelpMenu jurisdiction={jurisdiction} category={category} lastQuestion={lastQuestion} />
        </div>
      </header>

      <div className="bg-rose-50/70 px-4 py-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-rose-600">
          You are proceeding with{" "}
          {jurisdiction === "india" ? "National" : "International"} rules
          and regulations
        </p>
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-amber-100 bg-amber-50/70 px-4 py-1.5 text-center">
        <span aria-hidden className="text-amber-600">
          ⓘ
        </span>
        <p className="text-[11px] font-medium leading-snug text-amber-800">{DISCLAIMER_LONG}</p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { LANGUAGES, useLanguage, type LanguageCode } from "@/hooks/useLanguage";

function IconTranslate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-neu-text">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 12h16M12 4c2.2 2.2 2.2 13.8 0 16M12 4c-2.2 2.2-2.2 13.8 0 16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Site-wide language picker. Uncontrolled by default (reads/writes the
 * shared `useLanguage` hook directly, persisted to localStorage) — pass
 * `language`/`onChange` to make it a controlled mirror of a language value
 * already owned by an ancestor, so every instance on a page stays in sync
 * instantly instead of only after a remount. */
export function LanguageSwitcher({
  language: controlledLanguage,
  onChange,
}: {
  language?: (typeof LANGUAGES)[number];
  onChange?: (code: LanguageCode) => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const uncontrolled = useLanguage();
  const language = controlledLanguage ?? uncontrolled.language;
  const setLanguage = onChange ?? uncontrolled.setLanguage;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-neu-text shadow-neuSm"
      >
        <IconTranslate />
        {language.code.toUpperCase()}
        <span className={`text-[10px] text-neu-sub transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close language menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-44 max-h-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl bg-neu-surface p-1.5 shadow-neu">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                  language.code === l.code ? "bg-neu-bg text-neu-text" : "text-neu-sub hover:bg-neu-bg/60"
                }`}
              >
                {l.label}
                {language.code === l.code && <span>✓</span>}
              </button>
            ))}
            <p className="mt-1 border-t border-neu-bg px-3 pt-2 text-[10px] leading-snug text-neu-sub">
              Translation: Bhashini (MeitY) first, Sarvam fallback. English
              uses the faster streaming path unless voice mode requests Bulbul
              TTS (then blocking /query).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

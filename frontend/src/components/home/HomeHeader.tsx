"use client";

import { useState } from "react";
import { LANGUAGES, useLanguage } from "@/hooks/useLanguage";
import { LogoBadge } from "@/components/brand/LogoBadge";
import { FontSizeControl } from "@/components/brand/FontSizeControl";

const NAV_LINKS = [
  { label: "Features", href: "#faq" },
  { label: "Reviews", href: "#reviews" },
  { label: "About", href: "#footer-cta" },
] as const;

function IconChevron({ open }: { open: boolean }) {
  return (
    <span className={`text-[10px] text-neu-sub transition-transform ${open ? "rotate-180" : ""}`}>
      ▾
    </span>
  );
}

/** Language picker for the home page nav — same shared `useLanguage` state
 * as the rest of the app (so a choice made here carries into intake/chat),
 * rendered with a flag glyph per the storyboard reference. Every language
 * here is an official language of India (all BCP-47 tags are "-IN"
 * variants), so the Indian tricolour is used for all of them rather than
 * guessing a single other country per language. */
function LanguageDropdown() {
  const [open, setOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm ring-1 ring-black/5"
      >
        <span aria-hidden>🇮🇳</span>
        {language.label}
        <IconChevron open={open} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close language menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-2xl bg-white p-1.5 shadow-panel ring-1 ring-black/5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                  language.code === l.code ? "bg-forest-50 text-forest-700" : "text-ink/70 hover:bg-clay-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>🇮🇳</span>
                  {l.label}
                </span>
                {language.code === l.code && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function HomeHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="sticky top-3 z-30 mx-3 sm:mx-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper/95 px-4 py-3 shadow-panel ring-1 ring-black/5 backdrop-blur sm:px-6">
        <a href="#" className="flex min-w-0 shrink-0 items-center gap-3">
          <LogoBadge className="h-12 w-12 sm:h-14 sm:w-14" />
          <span className="truncate text-lg font-bold text-ink sm:text-xl">
            IP-SAKTI Sahayak
          </span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-ink/70 transition-colors hover:text-forest-600"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <FontSizeControl />
          <LanguageDropdown />
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-clay-50 md:hidden"
          >
            {mobileNavOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="mt-2 flex flex-col gap-1 rounded-2xl bg-paper/95 p-3 shadow-panel ring-1 ring-black/5 backdrop-blur md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileNavOpen(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-clay-50"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-1 flex items-center justify-center border-t border-clay-200 pt-3">
            <FontSizeControl />
          </div>
        </div>
      )}
    </header>
  );
}

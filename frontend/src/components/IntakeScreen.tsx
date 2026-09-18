"use client";

import { useState } from "react";
import { FORMULATION_CATEGORIES, type Jurisdiction } from "@/lib/types";
import { THEME, type ThemeName, PAGE_BG } from "@/lib/theme";
import { LeafField } from "@/components/brand/LeafField";
import { LogoBadge } from "@/components/brand/LogoBadge";
import { AyushBadge } from "@/components/brand/AyushBadge";
import { FontSizeControl } from "@/components/brand/FontSizeControl";
import { LanguageSwitcher } from "@/components/brand/LanguageSwitcher";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { AccountRail } from "@/components/brand/AccountRail";

function IconScale() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="5" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="5" y1="7" x2="5" y2="11" stroke="currentColor" strokeWidth="1.3" />
      <line x1="19" y1="7" x2="19" y2="11" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 11a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16.5 11a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconFlask() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
      <path
        d="M10 3 10 9 6 19A2 2 0 0 0 8 21H16A2 2 0 0 0 18 19L14 9 14 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <line x1="8" y1="16" x2="16" y2="16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="10" y1="3" x2="14" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
      <path
        d="M4 12l16-8-6 16-3-6-7-2Z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBadge({ theme, children }: { theme: ThemeName; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-neuSm ${THEME[theme].badge}`}
    >
      {children}
    </span>
  );
}

function Dots({ count, activeIndex, theme }: { count: number; activeIndex: number | null; theme: ThemeName }) {
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === activeIndex ? `w-4 ${THEME[theme].dot}` : "w-1.5 bg-neu-bg shadow-neuInset"
          }`}
        />
      ))}
    </div>
  );
}

export function IntakeScreen({
  onStart,
  onBack,
}: {
  onStart: (jurisdiction: Jurisdiction, category: string | null) => void;
  onBack: () => void;
}) {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const stepsDone = (jurisdiction ? 1 : 0) + (category ? 1 : 0);
  const readiness = jurisdiction ? Math.round((stepsDone / 2) * 100) : 0;

  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 ${PAGE_BG}`}>
      <LeafField />
      <AyushBadge />
      <AccountRail onBack={onBack} />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <div className="w-full rounded-[32px] bg-neu-surface p-8 shadow-2xl sm:p-12">
          <div className="flex items-start justify-between">
            <LogoBadge />
            <div className="flex items-center gap-2">
              <FontSizeControl />
              <LanguageSwitcher />
            </div>
          </div>

          <h1 className="mt-5 text-2xl font-bold text-neu-text sm:text-3xl">
            IP-SAKTI Sahayak
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neu-sub">
            Before your first question, set the jurisdiction — and, if you know
            it, the formulation category. Both shape which regulatory posture
            applies, so we ask up front rather than guessing.
          </p>

          {/* Jurisdiction */}
          <div className="mt-8">
            <div className="flex items-center gap-2.5">
              <IconBadge theme="rose">
                <IconScale />
              </IconBadge>
              <div>
                <p className="text-sm font-semibold text-neu-text">
                  Jurisdiction <span className="text-red-500">*</span>
                </p>
                <p className="text-xs text-neu-sub">Required</p>
              </div>
            </div>

            <div className="relative mt-3 flex rounded-full bg-neu-bg p-1 shadow-neuInset">
              <div
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full shadow-neuSm transition-all duration-300 ${THEME.rose.fill} ${
                  jurisdiction === "international"
                    ? "translate-x-full opacity-100"
                    : jurisdiction === "india"
                      ? "translate-x-0 opacity-100"
                      : "translate-x-0 opacity-0"
                }`}
              />
              <button
                type="button"
                onClick={() => setJurisdiction("india")}
                className={`relative z-10 flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                  jurisdiction === "india" ? "text-white" : "text-neu-sub"
                }`}
              >
                India
              </button>
              <button
                type="button"
                onClick={() => setJurisdiction("international")}
                className={`relative z-10 flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                  jurisdiction === "international" ? "text-white" : "text-neu-sub"
                }`}
              >
                International
              </button>
            </div>
            <Dots
              count={2}
              activeIndex={jurisdiction === "india" ? 0 : jurisdiction === "international" ? 1 : null}
              theme="rose"
            />
          </div>

          {/* Category */}
          <div className="mt-7">
            <div className="flex items-center gap-2.5">
              <IconBadge theme="sage">
                <IconFlask />
              </IconBadge>
              <div>
                <p className="text-sm font-semibold text-neu-text">
                  Formulation category{" "}
                  <span className="text-xs font-normal text-neu-sub/60">
                    — if you don&apos;t know the category, start without it
                  </span>
                </p>
                <p className="text-xs text-neu-sub">Optional</p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {FORMULATION_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory((prev) => (prev === c ? null : c))}
                  className={`w-full rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:scale-105 sm:w-auto ${
                    category === c
                      ? `scale-105 text-white shadow-neuSm ${THEME.sage.fill}`
                      : "bg-neu-bg text-neu-sub shadow-neuInset"
                  }`}
                  aria-pressed={category === c}
                >
                  {c}
                </button>
              ))}
            </div>
            <Dots
              count={FORMULATION_CATEGORIES.length}
              activeIndex={category ? FORMULATION_CATEGORIES.indexOf(category as (typeof FORMULATION_CATEGORIES)[number]) : null}
              theme="sage"
            />
          </div>

          {/* Ready */}
          <div className="mt-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconBadge theme="amber">
                  <IconSend />
                </IconBadge>
                <p className="text-sm font-semibold text-neu-text">Setup progress</p>
              </div>
              <span className={`text-sm font-bold ${jurisdiction ? THEME.amber.text : "text-neu-sub"}`}>
                {readiness}%
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full bg-neu-bg shadow-neuInset">
              <div
                className={`h-2.5 rounded-full shadow-neuSm transition-all duration-300 ${THEME.amber.fill}`}
                style={{ width: `${readiness}%` }}
              />
            </div>

            <button
              type="button"
              disabled={!jurisdiction}
              onClick={() => jurisdiction && onStart(jurisdiction, category)}
              className={`mt-5 w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-neuSm transition disabled:cursor-not-allowed disabled:opacity-40 ${THEME.amber.fill}`}
            >
              Start asking questions
            </button>
          </div>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}

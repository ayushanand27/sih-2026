"use client";

import { LeafField } from "@/components/brand/LeafField";
import { AyushBadge } from "@/components/brand/AyushBadge";
import { PAGE_BG } from "@/lib/theme";
import { HeroLoginCard } from "./HeroLoginCard";

type Mode = "login" | "signup";

export function HomeHero({
  loginMode,
  onLoginModeChange,
  onSkipToNextPage,
}: {
  loginMode: Mode;
  onLoginModeChange: (mode: Mode) => void;
  onSkipToNextPage: () => void;
}) {
  return (
    <section className={`relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:pb-28 ${PAGE_BG}`}>
      <LeafField />
      <AyushBadge />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-10">
        <div className="max-w-xl text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 ring-1 ring-white/20">
            Ministry of AYUSH · Smart India Hackathon 2026
          </span>

          <h1 className="mt-6 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            Regulatory-grade answers for Ayurveda IP, backed by cited sources.
          </h1>

          <p className="mt-5 text-base leading-relaxed text-white/80 sm:text-lg">
            IP-SAKTI Sahayak fuses statutory retrieval with deterministic
            citation checks, so every answer on patents, GI, and biodiversity
            compliance traces back to the exact section it came from —
            across national and international jurisdictions.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <button
              type="button"
              onClick={onSkipToNextPage}
              className="w-full rounded-full bg-saffron-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-saffron-600 sm:w-auto"
            >
              Continue to Chat →
            </button>
            <a
              href="#faq"
              className="w-full rounded-full border border-white/25 px-7 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="flex w-full justify-center lg:w-auto lg:justify-end">
          <HeroLoginCard mode={loginMode} onModeChange={onLoginModeChange} />
        </div>
      </div>
    </section>
  );
}

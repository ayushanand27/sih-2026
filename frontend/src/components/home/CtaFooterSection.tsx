"use client";

import { PAGE_BG } from "@/lib/theme";
import { SiteFooter } from "@/components/brand/SiteFooter";

export function CtaFooterSection({
  onLoginClick,
  onSignUpClick,
  onSkipToChat,
}: {
  onLoginClick: () => void;
  onSignUpClick: () => void;
  onSkipToChat: () => void;
}) {
  return (
    <footer id="footer-cta" className={`scroll-mt-24 px-4 py-28 sm:px-6 sm:py-40 ${PAGE_BG}`}>
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-4xl font-bold text-white sm:text-6xl">
          Ready to ask your first question?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">
          Sign in to keep a history across visits, or jump straight into a
          session — no account required to start.
        </p>

        <div className="mx-auto mt-14 flex max-w-3xl flex-col gap-6 sm:flex-row">
          <button
            type="button"
            onClick={onLoginClick}
            className="flex-1 rounded-full border-2 border-white/30 px-12 py-6 text-lg font-semibold text-white transition hover:bg-white/10"
          >
            Login
          </button>
          <button
            type="button"
            onClick={onSignUpClick}
            className="flex-1 rounded-full bg-saffron-500 px-12 py-6 text-lg font-semibold text-white shadow-lg transition hover:bg-saffron-600"
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={onSkipToChat}
            className="flex-1 rounded-full bg-white px-12 py-6 text-lg font-semibold text-forest-700 shadow-lg transition hover:bg-forest-50"
          >
            Skip to Chat
          </button>
        </div>

        <div className="mt-14">
          <SiteFooter large />
        </div>
      </div>
    </footer>
  );
}

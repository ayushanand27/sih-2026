"use client";

import { useEffect, useRef, useState } from "react";
import { DISCLAIMER_SHORT } from "@/lib/disclaimer";
import { WhyUseUs } from "./WhyUseUs";

const LINK_CLASSES =
  "font-semibold text-amber-200 underline decoration-amber-200/50 underline-offset-4 transition-colors hover:text-white hover:decoration-white";

/** `large` doubles the footer's text sizes for placement inside an
 * already-oversized section (e.g. the home page's footer CTA) — default
 * sizing is unchanged for every other caller. */
export function SiteFooter({ large = false }: { large?: boolean } = {}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!whyOpen) return;
    // The panel's full-height text content needs a real layout pass before
    // scrollIntoView measures it correctly -- one rAF after the commit isn't
    // always enough (it undershot/overshot in testing), so wait two.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [whyOpen]);

  const toggleWhy = () => setWhyOpen((v) => !v);

  return (
    <footer className="mt-6 w-full text-center">
      <div
        className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 ${large ? "text-lg sm:text-xl" : "text-xs sm:text-sm"}`}
      >
        <button type="button" onClick={toggleWhy} className={LINK_CLASSES}>
          Why use us?
        </button>
      </div>
      <p
        className={`mx-auto mt-3 font-semibold leading-relaxed text-amber-200/90 ${large ? "text-sm sm:text-base" : "text-[11px]"}`}
      >
        {DISCLAIMER_SHORT}
      </p>
      <p
        className={`mx-auto mt-2 leading-relaxed text-white/50 ${large ? "max-w-xl text-sm sm:text-base" : "max-w-md text-[11px]"}`}
      >
        Built for Smart India Hackathon 2026 (SIH26045) under the Ministry
        of AYUSH, Government of India — an open-source student prototype,
        not an officially published government service.
      </p>

      {whyOpen && (
        <div ref={panelRef} className="mt-6 w-full scroll-mt-6">
          <WhyUseUs />
        </div>
      )}
    </footer>
  );
}

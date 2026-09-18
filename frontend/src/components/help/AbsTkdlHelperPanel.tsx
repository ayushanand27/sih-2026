"use client";

import { useState } from "react";
import type { FormulationCategory } from "@/lib/types";

const CATEGORY_POSTURE: Record<FormulationCategory, { ip: string; abs: string }> = {
  "Classical medicine": {
    ip: "Largely traditional knowledge — blocked from patenting by Section 3(p) of the Patents Act. It's defended, not attacked, via TKDL, which patent offices use to reject or oppose claims that merely restate a known formulation.",
    abs: "Lower exposure if no new biological material is being accessed, but sourcing the raw material still triggers Biological Diversity Act obligations.",
  },
  "Patent & Proprietary (P&P) medicine": {
    ip: "May combine known ingredients in a genuinely novel ratio, process or delivery form — patentability depends entirely on what is actually claimed as new.",
    abs: "Access-and-Benefit-Sharing obligations apply to the biological resources used, regardless of how old the underlying formulation is.",
  },
  "New / non-classical drug": {
    ip: "The strongest patent potential of any category — but requires clinical safety and effectiveness evidence under the NDCT Rules 2019.",
    abs: "Full ABS compliance is expected, especially where the innovation stems from novel bioprospecting.",
  },
  Phytopharmaceutical: {
    ip: "A distinct regulatory category with its own approval pathway — patent strategy should track the specific standardized extract or fraction, not the source plant itself.",
    abs: "ABS applies to sourcing of the plant material used to derive the standardized extract.",
  },
  "Ayurveda-Aahar / nutraceutical": {
    ip: "Sits across food and drug regulation (FSSAI) — trademark and trade-secret protection often matter more here than patents.",
    abs: "ABS obligations still apply wherever the formulation uses a biological resource sourced from India.",
  },
  Cosmetic: {
    ip: "Design and trademark protection are usually more relevant than patents for a finished cosmetic product.",
    abs: "ABS applies to any Indian biological resource used as an active ingredient.",
  },
};

const CHECKLIST_ITEMS = [
  "Identify every biological resource used, and confirm whether it was accessed from India.",
  "Determine your applicant type — this decides whether you approach the National Biodiversity Authority (foreign entities, or Indian entities transferring results abroad) or intimate your State Biodiversity Board (Indian citizens/companies).",
  "Obtain the required prior approval or intimation before commercial use, research transfer, or filing for IP protection.",
  "Enter into a Benefit-Sharing Agreement wherever one is required, before commercialisation.",
  "Keep documentation of ABS approval on file — it's often required at the time of patent examination or grant.",
];

/** The problem statement explicitly asks for "an ABS-compliance helper and
 * a TKDL / prior-art pointer" as a distinct feature, not just something
 * generic chat happens to be able to answer. This gives it real, structured
 * content instead of a bare link: category-specific IP/ABS posture (mirrors
 * the PS's own classical-vs-new-drug example), an actual checklist, and a
 * TKDL explainer — ending in a handoff to the human-facilitator panel for
 * anything case-specific. */
export function AbsTkdlHelperPanel({
  category,
  onTalkToFacilitator,
}: {
  category: string | null;
  onTalkToFacilitator: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));
  const posture =
    category && category in CATEGORY_POSTURE
      ? CATEGORY_POSTURE[category as FormulationCategory]
      : null;

  return (
    <div>
      <p className="text-sm font-bold text-neu-text">ABS & prior-art helper</p>
      <p className="mt-1 text-xs leading-relaxed text-neu-sub">
        General guidance on Access-and-Benefit-Sharing duties and prior-art
        defence — not a compliance certification for your specific case.
      </p>

      {posture ? (
        <div className="mt-4 rounded-xl border border-forest-100 bg-forest-50/60 p-3">
          <p className="text-xs font-bold text-forest-700">Your formulation: {category}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neu-text">
            <span className="font-semibold">IP posture — </span>
            {posture.ip}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neu-text">
            <span className="font-semibold">ABS posture — </span>
            {posture.abs}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-neu-bg bg-white/60 p-3 text-[11px] text-neu-sub">
          Set a formulation category on the setup screen to see posture
          guidance specific to it.
        </p>
      )}

      <p className="mt-5 text-xs font-bold text-neu-text">Access & Benefit-Sharing checklist</p>
      <div className="mt-2 space-y-1">
        {CHECKLIST_ITEMS.map((item, i) => (
          <label
            key={i}
            className="flex items-start gap-2.5 rounded-xl px-1 py-1.5 text-[11px] leading-relaxed text-neu-text transition-colors hover:bg-neu-bg/40"
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) =>
                setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
              }
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-forest-600"
            />
            <span className={checked[i] ? "text-neu-sub line-through" : ""}>{item}</span>
          </label>
        ))}
      </div>

      <p className="mt-5 text-xs font-bold text-neu-text">TKDL & prior art</p>
      <p className="mt-2 text-[11px] leading-relaxed text-neu-text">
        The Traditional Knowledge Digital Library documents Ayurveda, Unani,
        Siddha and Yoga knowledge in patent-examiner-readable form. It
        doesn&apos;t grant you rights — it&apos;s used defensively, helping
        patent offices reject or oppose claims that merely restate
        already-known traditional knowledge.
      </p>
      <a
        href="https://www.tkdl.res.in"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-[11px] font-semibold text-forest-600 underline decoration-forest-200 underline-offset-2 hover:text-forest-700"
      >
        Learn more at tkdl.res.in ↗
      </a>

      <div className="mt-5 border-t border-neu-bg pt-4">
        <p className="text-[11px] text-neu-sub">Need help with your specific formulation?</p>
        <button
          type="button"
          onClick={onTalkToFacilitator}
          className="mt-2 w-full rounded-xl bg-forest-600 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-700"
        >
          Talk to a human IP facilitator →
        </button>
      </div>
    </div>
  );
}

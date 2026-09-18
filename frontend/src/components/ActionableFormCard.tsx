"use client";

import { useState } from "react";
import type { FormCard } from "@/lib/types";
import { ActionableFormModal } from "./ActionableFormModal";

/** compliance/form_navigator.py's catalog match — first-pass reference
 * data (form numbers verified against the real indexed statute text where
 * possible), not a substitute for professional/legal review before
 * actually filing. Clicking anywhere on the card opens the full-detail
 * modal (ActionableFormModal); the portal link also works directly from
 * here without opening it, via stopPropagation. */
export function ActionableFormCard({ form }: Readonly<{ form: FormCard }>) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {/* A real <button> for "open the detail modal" (not role="button" on
       * a div) — wrapping just the header, not the whole card, since the
       * card also contains a genuinely separate <a> link below, and a
       * <button> can't contain another interactive element. */}
      <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 text-sm transition hover:border-amber-400 hover:bg-amber-50">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="block w-full text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {form.agency}
              </p>
              <p className="mt-0.5 font-medium text-neu-text">{form.title}</p>
            </div>
          </div>
        </button>
        <p className="mt-1.5 text-xs text-neu-sub">{form.statutory_mandate}</p>
        <p className="mt-1 text-xs text-neu-sub">
          <span className="font-medium text-neu-text">Deadline:</span> {form.deadline}
        </p>
        {form.required_attachments.length > 0 && (
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-neu-sub">
            {form.required_attachments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <a
          href={form.submission_portal}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-[#5B6F45] underline decoration-[#B7C79E] underline-offset-2 hover:text-[#3F4F30]"
        >
          Go to submission portal →
        </a>
      </div>

      {modalOpen && (
        <ActionableFormModal form={form} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

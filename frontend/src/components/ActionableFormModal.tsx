"use client";

import type { FormCard } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api";

/** Full-detail view of one compliance/form_navigator.py catalog match,
 * opened by clicking its ActionableFormCard. Same underlying data as the
 * card — this is a more spacious, dedicated view plus a prominent link
 * button, not different information. */
export function ActionableFormModal({
  form,
  onClose,
}: Readonly<{
  form: FormCard;
  onClose: () => void;
}>) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-neu-text/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`form-modal-title-${form.form_id}`}
    >
      {/* A real <button> covering the backdrop, not a click handler on a
       * plain <div> — click-to-close-on-backdrop is a native button
       * interaction; keyboard/screen-reader users close via the explicit
       * ✕ button below instead (tabIndex={-1} keeps this out of tab
       * order so it doesn't sit awkwardly ahead of the real content). */}
      <button
        type="button"
        className="fixed inset-0 cursor-default"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {form.agency === "NBA" ? "National Biodiversity Authority" : "Indian Patent Office"}
            </p>
            <h2 id={`form-modal-title-${form.form_id}`} className="mt-1 text-lg font-semibold text-neu-text">
              {form.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-neu-sub hover:bg-neu-bg hover:text-neu-text"
          >
            ✕
          </button>
        </div>

        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
              Statutory authority
            </dt>
            <dd className="mt-1 text-neu-text">{form.statutory_mandate}</dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
              Filing deadline
            </dt>
            <dd className="mt-1 text-neu-text">{form.deadline}</dd>
          </div>

          {form.required_attachments.length > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
                Mandatory attachments
              </dt>
              <dd className="mt-1">
                <ul className="list-inside list-disc space-y-1 text-neu-text">
                  {form.required_attachments.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-5 rounded-lg bg-neu-bg px-3 py-2 text-xs leading-relaxed text-neu-sub">
          First-pass reference data — form numbers verified against the
          real indexed statute text where possible, but not a substitute
          for professional/legal review before actually filing.
        </p>

        <a
          href={form.submission_portal}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block rounded-xl bg-[#5B6F45] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#3F4F30]"
        >
          Go to official submission portal →
        </a>
        <a
          href={`${API_BASE_URL}/api/v1/compliance/forms/${form.form_id}/download`}
          className="mt-2 block rounded-xl border border-neu-bg px-4 py-2.5 text-center text-sm font-semibold text-neu-text transition hover:border-[#B7C79E] hover:bg-[#EDF2E2] hover:text-[#3F4F30]"
        >
          Download prep checklist (.docx)
        </a>
        <p className="mt-1.5 text-center text-[11px] text-neu-sub">
          A cover sheet with these details filled in — not the official
          form itself.
        </p>
      </div>
    </div>
  );
}

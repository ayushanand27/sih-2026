"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, ApiNotConfiguredError, ClientTimeoutError, query } from "@/lib/api";
import type { Jurisdiction } from "@/lib/types";
import { SidePanel } from "./SidePanel";

/** Toggle switch in the chat header: flipping it fetches the same last
 * question against the OTHER jurisdiction's corpus and shows the answer in a
 * popup, so the user can see how national/international treatment differs
 * for whatever they're currently discussing -- without changing the actual
 * conversation's jurisdiction. Stays reactive while open: asking a new
 * question re-fetches automatically instead of leaving the popup stuck on
 * whatever was last asked. */
export function JurisdictionCompare({
  jurisdiction,
  category,
  lastQuestion,
}: {
  jurisdiction: Jurisdiction;
  category: string | null;
  lastQuestion: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; abstained: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const requestId = useRef(0);

  const otherJurisdiction: Jurisdiction =
    jurisdiction === "india" ? "international" : "india";
  const otherLabel = otherJurisdiction === "india" ? "National" : "International";

  useEffect(() => {
    if (!open || !lastQuestion || askedFor === lastQuestion) return;

    const thisRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    setAnswer(null);

    query({
      question: category
        ? `For a ${category} formulation: ${lastQuestion}`
        : lastQuestion,
      jurisdiction: otherJurisdiction,
    })
      .then((res) => {
        if (requestId.current !== thisRequest) return; // superseded by a newer question
        setAnswer({ text: res.answer, abstained: res.flags.abstained });
        setAskedFor(lastQuestion);
      })
      .catch((err) => {
        if (requestId.current !== thisRequest) return;
        setError(
          err instanceof ApiError || err instanceof ClientTimeoutError || err instanceof ApiNotConfiguredError
            ? err.message
            : "Something went wrong talking to the backend."
        );
      })
      .finally(() => {
        if (requestId.current === thisRequest) setLoading(false);
      });
    // otherJurisdiction/category intentionally excluded: they're derived from
    // jurisdiction/category props already in the dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lastQuestion, jurisdiction, category, askedFor]);

  return (
    <div className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5"
      >
        <span className="text-xs font-medium text-neu-sub">{otherLabel} view</span>
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full shadow-neuInset transition-colors ${
            open ? "bg-rose-500" : "bg-neu-bg"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-neuSm transition-[left] duration-150 ${
              open ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>

      <SidePanel open={open} onClose={() => setOpen(false)}>
        <p className="text-xs font-bold uppercase tracking-wide text-rose-600">
          How this differs under {otherLabel} rules
        </p>

        {!lastQuestion && (
          <p className="mt-2 text-xs leading-relaxed text-neu-sub">
            Ask a question first, then flip this to see how{" "}
            {otherLabel.toLowerCase()} rules treat the same topic.
          </p>
        )}

        {lastQuestion && loading && (
          <p className="mt-2 text-xs leading-relaxed text-neu-sub">
            Checking the {otherLabel.toLowerCase()} sources for &quot;
            {lastQuestion}&quot;...
          </p>
        )}

        {lastQuestion && !loading && error && (
          <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>
        )}

        {lastQuestion && !loading && !error && answer && (
          <p
            className={`mt-2 text-xs leading-relaxed ${
              answer.abstained ? "text-amber-700" : "text-neu-text"
            }`}
          >
            {answer.abstained
              ? `Nothing in the ${otherLabel.toLowerCase()} corpus answers this directly.`
              : answer.text}
          </p>
        )}
      </SidePanel>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";

const PHRASES = [
  "Rewriting your question for retrieval...",
  "Searching the indexed corpus...",
  "Reranking the most relevant passages...",
  "Drafting a grounded answer...",
  "Still working — this corpus is thorough, and so is the check...",
  "Almost there — attaching citations...",
];

export function LoadingState() {
  const elapsed = useElapsedSeconds(true);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex max-w-[85%] animate-fadeIn items-start gap-3 rounded-2xl border border-neu-bg bg-white/70 px-4 py-3 shadow-neuSm">
      <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 animate-pulseSoft" />
      <div className="space-y-1">
        <p className="text-sm text-neu-text/80">{PHRASES[phraseIndex]}</p>
        <p className="text-xs tabular-nums text-neu-sub">
          {elapsed}s elapsed
          {elapsed > 45 ? " — in-scope questions can take up to ~60s" : ""}
        </p>
      </div>
    </div>
  );
}

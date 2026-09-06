export function ConfidenceBadge({ confidence }: { confidence: number }) {
  // Three tiers, not two: a bare "60% match" number reads the same whether
  // retrieval found a clean answer or landed on a genuinely contested legal
  // boundary (e.g. classical vs. patent_and_proprietary triage) — the
  // 60-79 band gets its own label + tooltip instead of just a middling
  // percentage, so the UI doesn't imply more certainty than the reranker
  // actually has for exactly the cases where the classification is nuanced.
  if (confidence >= 80) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-700"
        title="The cross-encoder reranker's confidence in the strongest retrieved passage — reflects retrieval quality, not a guarantee the final answer is correct."
      >
        {confidence}% match
      </span>
    );
  }

  if (confidence >= 60) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-saffron-300/60 bg-saffron-100 px-2 py-0.5 text-xs font-medium tabular-nums text-saffron-600"
        title="Retrieval found relevant text, but the confidence sits in a band where this project's own formulation triage is often nuanced (e.g. a custom herb blend sitting right on the classical vs. patent-and-proprietary boundary) — worth reading the citations closely rather than taking the classification as settled."
      >
        {confidence}% · Moderate Grounding (Nuanced Legal Boundary)
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-clay-200 bg-clay-50 px-2 py-0.5 text-xs font-medium tabular-nums text-ink/60"
      title="The cross-encoder reranker's confidence in the strongest retrieved passage — reflects retrieval quality, not a guarantee the final answer is correct."
    >
      {confidence}% match
    </span>
  );
}

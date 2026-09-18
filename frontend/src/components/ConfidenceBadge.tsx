export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 75
      ? "bg-[#EDF2E2] text-[#5B6F45] border-[#B7C79E]/60"
      : confidence >= 45
        ? "bg-amber-100 text-amber-700 border-amber-300/60"
        : "bg-neu-bg/60 text-neu-sub border-neu-bg";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}
      title="Relevance score from the reranker — not a calibrated accuracy figure."
    >
      {confidence}% match
    </span>
  );
}

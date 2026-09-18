export function AbstentionBanner() {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-100/60 px-3 py-2 text-xs text-amber-700">
      <span aria-hidden className="mt-0.5">
        ⚠
      </span>
      <p>
        Nothing in the indexed corpus answers this directly — the response
        above is an honest abstention, not a guess. Try rephrasing, or check
        the jurisdiction/category filters above the chat.
      </p>
    </div>
  );
}

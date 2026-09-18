"use client";

import type { Citation } from "@/lib/types";
import { sourceUrl } from "@/lib/api";

export function SourceViewer({
  citation,
  onClose,
}: {
  citation: Citation | null;
  onClose: () => void;
}) {
  if (!citation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-neu-sub">
        <p className="text-sm font-medium">No source open</p>
        <p className="max-w-xs text-xs">
          Click &quot;View source PDF&quot; on any citation to open the exact
          page it was drawn from, side by side with the conversation.
        </p>
      </div>
    );
  }

  let pdfSrc: string | null = null;
  let sourceError: string | null = null;
  try {
    pdfSrc = sourceUrl(citation.source_file, citation.page_number);
  } catch (err) {
    // sourceUrl() throws if the backend URL isn't configured — shouldn't
    // normally happen here (a citation only exists after a successful
    // query, which requires it), but render a message instead of crashing
    // rather than assume that can never change mid-session.
    sourceError = err instanceof Error ? err.message : "Could not build the source URL.";
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-neu-bg bg-neu-surface px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neu-text">
            {citation.source_file}
          </p>
          <p className="text-xs text-neu-sub">
            Page {citation.page_number} · {citation.section_heading}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-neu-sub hover:bg-neu-bg hover:text-neu-text"
          aria-label="Close source viewer"
        >
          ✕
        </button>
      </div>
      {sourceError ? (
        <div className="flex h-full flex-1 items-center justify-center p-8 text-center text-xs text-neu-sub">
          {sourceError}
        </div>
      ) : (
        <iframe
          key={citation.chunk_id}
          title={`${citation.source_file}, page ${citation.page_number}`}
          src={pdfSrc ?? undefined}
          className="h-full w-full flex-1 bg-neu-bg/40"
        />
      )}
    </div>
  );
}

"use client";

import type { RelatedProvision } from "@/lib/types";

export function RelatedProvisionCard({ provision }: { provision: RelatedProvision }) {
  const relationLabel =
    provision.relation === "cross_jurisdiction_counterpart"
      ? "International counterpart"
      : "Related provision";

  return (
    <div className="rounded-xl border border-neu-bg bg-white/70 p-3 text-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5B6F45]">
        {relationLabel}
      </p>
      <p className="mt-1 truncate font-medium text-neu-text">{provision.source_file}</p>
      <p className="mt-0.5 text-xs text-neu-sub">
        p. {provision.page_number} · {provision.section_heading}
      </p>
    </div>
  );
}

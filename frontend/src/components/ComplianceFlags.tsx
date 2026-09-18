"use client";

import type { ComplianceFlag } from "@/lib/types";

export function ComplianceFlags({ flags }: Readonly<{ flags: ComplianceFlag[] }>) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5 border-t border-neu-bg pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
        Worth a closer look
      </p>
      {flags.map((f) => (
        <p key={f.tag} className="rounded-lg bg-neu-bg/60 px-2.5 py-1.5 text-xs text-neu-text/80">
          {f.note}
        </p>
      ))}
    </div>
  );
}

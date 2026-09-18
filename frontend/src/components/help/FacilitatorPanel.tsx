"use client";

import { useState } from "react";
import type { Jurisdiction } from "@/lib/types";

const FACILITATOR_EMAIL = process.env.NEXT_PUBLIC_FACILITATOR_EMAIL || "facilitator@ipsakti.example";

const INPUT_CLASSES =
  "w-full rounded-xl border border-neu-bg bg-white px-3.5 py-2.5 text-xs text-neu-text outline-none transition focus:border-forest-400";

/** The problem statement asks for "a path to escalate to a human IP
 * facilitator." There's no backend inbox/CRM to receive this yet, so this
 * builds the one channel that actually works without one: it opens the
 * user's own email client, addressed and pre-filled with their message plus
 * the conversation's jurisdiction/category context — a real, functional
 * escalation path rather than a dead link. */
export function FacilitatorPanel({
  jurisdiction,
  category,
  lastQuestion,
}: {
  jurisdiction: Jurisdiction;
  category: string | null;
  lastQuestion: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(lastQuestion ?? "");

  const canSend = name.trim().length > 0 && email.trim().includes("@") && message.trim().length > 0;

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    const jurisdictionLabel = jurisdiction === "india" ? "India" : "International";
    const subject = `IP facilitation request — ${jurisdictionLabel}${category ? ` / ${category}` : ""}`;
    const body = [
      `From: ${name.trim()} (${email.trim()})`,
      `Jurisdiction: ${jurisdictionLabel}`,
      category ? `Formulation category: ${category}` : null,
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    window.location.href = `mailto:${FACILITATOR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div>
      <p className="text-sm font-bold text-neu-text">Talk to a human IP facilitator</p>
      <p className="mt-1 text-xs leading-relaxed text-neu-sub">
        For anything case-specific, time-sensitive, or high-stakes, escalate
        to a person instead of relying on the assistant alone.
      </p>

      <div className="mt-4 rounded-xl border border-neu-bg bg-white/60 p-3 text-[11px] text-neu-sub">
        <p>
          <span className="font-semibold text-neu-text">Jurisdiction: </span>
          {jurisdiction === "india" ? "India" : "International"}
        </p>
        {category && (
          <p className="mt-1">
            <span className="font-semibold text-neu-text">Category: </span>
            {category}
          </p>
        )}
      </div>

      <form onSubmit={handleSend} className="mt-4 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className={INPUT_CLASSES}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          autoComplete="email"
          className={INPUT_CLASSES}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Describe what you need help with"
          className={`${INPUT_CLASSES} resize-none`}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="w-full rounded-xl bg-forest-600 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send via email
        </button>
      </form>

      <p className="mt-3 text-[10px] leading-relaxed text-neu-sub/80">
        Prototype — this opens your email client addressed to{" "}
        <span className="font-mono">{FACILITATOR_EMAIL}</span>. Point{" "}
        <span className="font-mono">NEXT_PUBLIC_FACILITATOR_EMAIL</span> at your
        institution&apos;s real facilitation inbox before going live.
      </p>
    </div>
  );
}

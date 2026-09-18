import type { Citation, ConversationMessage } from "@/lib/types";
import { DISCLAIMER_SHORT } from "@/lib/disclaimer";
import { CitationCard } from "./CitationCard";
import { AbstentionBanner } from "./AbstentionBanner";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RelatedProvisionCard } from "./RelatedProvisionCard";
import { ActionableFormCard } from "./ActionableFormCard";
import { ComplianceFlags } from "./ComplianceFlags";

function IconSpeakerPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
      <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ChatMessageBubble({
  message,
  onViewCitation,
  speaking,
  onToggleSpeak,
  speechSupported,
}: {
  message: ConversationMessage;
  onViewCitation: (citation: Citation) => void;
  speaking: boolean;
  onToggleSpeak: () => void;
  speechSupported: boolean;
}) {
  const isUser = message.role === "user";
  const abstained = !!message.flags?.abstained;

  if (message.error) {
    return (
      <div className="max-w-[85%] animate-fadeIn rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-panel">
        <p className="font-medium">The backend couldn&apos;t answer that.</p>
        <p className="mt-1 text-red-600/90">{message.error}</p>
      </div>
    );
  }

  return (
    <div
      className={`max-w-[85%] animate-fadeIn rounded-2xl px-4 py-3 shadow-neuSm ${
        isUser
          ? "ml-auto bg-gradient-to-r from-rose-300 to-orange-400 text-white"
          : "border border-neu-bg bg-white/70 text-neu-text"
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
        {!isUser && speechSupported && !message.pending && (
          <button
            type="button"
            onClick={onToggleSpeak}
            title={speaking ? "Stop reading aloud" : "Read this answer aloud"}
            aria-pressed={speaking}
            className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
              speaking
                ? "animate-glowAmber bg-amber-400 text-white"
                : "text-neu-sub hover:bg-neu-bg hover:text-neu-text"
            }`}
          >
            {speaking ? <IconStop /> : <IconSpeakerPlay />}
          </button>
        )}
      </div>

      {!isUser && !message.pending && (
        <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-neu-sub/70">
          <span aria-hidden>ⓘ</span> {DISCLAIMER_SHORT}
        </p>
      )}

      {!isUser && !abstained && typeof message.confidence_score === "number" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ConfidenceBadge confidence={Math.round(message.confidence_score * 100)} />
          {message.formulation_category && (
            <span className="rounded-full border border-neu-bg bg-neu-bg/60 px-2 py-0.5 text-xs font-medium text-neu-sub">
              {message.formulation_category}
            </span>
          )}
        </div>
      )}

      {!isUser && !abstained && message.flags?.weak_grounding && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          Keyword search found a strong match, but the reranker wasn&apos;t
          confident it answers this — read the sources below before treating
          this as settled.
        </p>
      )}

      {!isUser && abstained && <AbstentionBanner />}

      {!isUser && message.needs_clarification && message.clarifying_questions?.[0] && (
        <p className="mt-2 rounded-lg bg-neu-bg/60 px-2.5 py-1.5 text-xs text-neu-text/80">
          {message.clarifying_questions[0]}
        </p>
      )}

      {!isUser &&
        !abstained &&
        message.citations &&
        message.citations.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-neu-bg pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
              Sources
            </p>
            {message.citations.map((c, i) => (
              <CitationCard
                key={c.chunk_id}
                citation={c}
                index={i}
                onView={onViewCitation}
              />
            ))}
          </div>
        )}

      {!isUser &&
        !abstained &&
        message.related_provisions &&
        message.related_provisions.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-neu-bg pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
              See also
            </p>
            {message.related_provisions.map((p, i) => (
              <RelatedProvisionCard key={`${p.tag}-${i}`} provision={p} />
            ))}
          </div>
        )}

      {!isUser &&
        !abstained &&
        message.actionable_forms &&
        message.actionable_forms.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-neu-bg pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neu-sub">
              Forms you may need
            </p>
            {message.actionable_forms.map((f) => (
              <ActionableFormCard key={f.form_id} form={f} />
            ))}
          </div>
        )}

      {!isUser && !abstained && (
        <ComplianceFlags flags={message.compliance_flags ?? []} />
      )}
    </div>
  );
}

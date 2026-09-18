"use client";

import { useEffect, useState } from "react";

/** Below `sm`, "Ask a question, or tap the mic..." wraps to a second line
 * that a single-row textarea then clips — so drop the hint on narrow
 * screens, where the visible mic icon already communicates it. */
function useIsSmUp() {
  const [isSmUp, setIsSmUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setIsSmUp(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsSmUp(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isSmUp;
}

function IconMic({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${active ? "text-white" : "text-neu-text"}`}>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSpeaker({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-neu-text">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path
          d="M16.5 8.5a5 5 0 0 1 0 7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function ChatComposer({
  input,
  onInputChange,
  onSend,
  sending,
  voiceModeOn,
  onToggleVoiceMode,
  ttsSupported,
  speaking,
  listening,
  onToggleMic,
  micSupported,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Whether answers are currently being (or about to be) read aloud automatically. */
  voiceModeOn: boolean;
  onToggleVoiceMode: () => void;
  ttsSupported: boolean;
  /** Whether an answer is being read aloud right this moment. */
  speaking: boolean;
  listening: boolean;
  onToggleMic: () => void;
  micSupported: boolean;
}) {
  const isSmUp = useIsSmUp();
  const placeholder =
    micSupported && isSmUp ? "Ask a question, or tap the mic..." : "Ask a question...";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="flex w-full items-end gap-1.5 sm:gap-2"
    >
      {ttsSupported && (
        <button
          type="button"
          onClick={onToggleVoiceMode}
          title={voiceModeOn ? "Answers are read aloud — tap to mute" : "Tap to have answers read aloud"}
          aria-pressed={voiceModeOn}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-neuSm transition sm:h-10 sm:w-10 ${
            voiceModeOn ? "bg-gradient-to-r from-amber-300 to-orange-500" : "bg-neu-bg"
          } ${speaking ? "animate-glowAmber" : ""}`}
        >
          <IconSpeaker muted={!voiceModeOn} />
        </button>
      )}

      {micSupported && (
        <button
          type="button"
          onClick={onToggleMic}
          title={listening ? "Stop listening" : "Ask by voice"}
          aria-pressed={listening}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-neuSm transition sm:h-10 sm:w-10 ${
            listening
              ? "animate-glowRose bg-gradient-to-r from-rose-400 to-orange-500"
              : "bg-neu-bg"
          }`}
        >
          <IconMic active={listening} />
        </button>
      )}

      <textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
        placeholder={placeholder}
        className="max-h-40 min-w-0 flex-1 resize-none rounded-2xl bg-neu-bg px-3 py-2.5 text-sm text-neu-text shadow-neuInset outline-none placeholder:text-neu-sub sm:px-4"
      />
      <button
        type="submit"
        disabled={sending || !input.trim()}
        className="shrink-0 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-500 px-3 py-2.5 text-sm font-semibold text-white shadow-neuSm transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
      >
        Send
      </button>
    </form>
  );
}

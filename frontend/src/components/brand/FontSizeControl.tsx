"use client";

import { useFontScale } from "@/hooks/useFontScale";

export function FontSizeControl() {
  const { decrease, increase, reset } = useFontScale();
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white/70 px-1 py-1.5 shadow-neuSm">
      <button
        type="button"
        onClick={decrease}
        aria-label="Decrease text size"
        className="rounded-full px-1.5 text-[10px] font-bold text-neu-sub transition-colors hover:bg-neu-bg hover:text-neu-text"
      >
        A-
      </button>
      <button
        type="button"
        onClick={reset}
        aria-label="Reset text size"
        className="rounded-full px-1.5 text-xs font-bold text-neu-sub transition-colors hover:bg-neu-bg hover:text-neu-text"
      >
        A
      </button>
      <button
        type="button"
        onClick={increase}
        aria-label="Increase text size"
        className="rounded-full px-1.5 text-sm font-bold text-neu-sub transition-colors hover:bg-neu-bg hover:text-neu-text"
      >
        A+
      </button>
    </div>
  );
}

function LeafGlyph({ className = "h-6 w-6 text-emerald-400" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M11 20a7 7 0 0 1-1.2-13.9C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IndiaFlag() {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 24;
    return {
      x2: Number((16 + 2.6 * Math.cos(angle)).toFixed(3)),
      y2: Number((11 + 2.6 * Math.sin(angle)).toFixed(3)),
    };
  });
  return (
    <svg
      viewBox="0 0 32 22"
      className="h-4 w-6 shrink-0 rounded-[2px] shadow-sm sm:h-5 sm:w-7"
      aria-label="Flag of India"
    >
      <rect width="32" height="7.33" fill="#FF9933" />
      <rect y="7.33" width="32" height="7.33" fill="#FFFFFF" />
      <rect y="14.67" width="32" height="7.33" fill="#138808" />
      {spokes.map((s, i) => (
        <line key={i} x1="16" y1="11" x2={s.x2} y2={s.y2} stroke="#000080" strokeWidth="0.25" />
      ))}
      <circle cx="16" cy="11" r="2.6" fill="none" stroke="#000080" strokeWidth="0.45" />
      <circle cx="16" cy="11" r="0.55" fill="#000080" />
    </svg>
  );
}

/** Fixed-position national/ministry attribution shown on every page.
 * Uses a generic leaf mark, not the real Ministry of AYUSH seal (no
 * rights to reproduce official government insignia). */
export function AyushBadge() {
  return (
    <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 sm:right-6 sm:top-6 sm:flex">
      <IndiaFlag />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur-sm">
        <LeafGlyph className="h-4 w-4 text-emerald-300" />
      </span>
      <p className="text-right text-[10px] font-bold uppercase leading-tight tracking-wide text-white sm:text-xs">
        An Initiative under
        <br />
        Ministry of AYUSH
      </p>
    </div>
  );
}

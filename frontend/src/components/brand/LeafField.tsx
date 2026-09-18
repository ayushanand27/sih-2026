function Leaf({ className, color }: { className: string; color: string }) {
  return (
    <svg viewBox="0 0 100 140" className={className} aria-hidden>
      <path d="M50 4C20 26 6 66 50 136 94 66 80 26 50 4Z" fill={color} />
      <path
        d="M50 16C50 50 50 92 50 122"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M50 45 L34 36M50 45 L66 36M50 75 L32 68M50 75 L68 68M50 100 L36 95M50 100 L64 95"
        stroke="rgba(0,0,0,0.14)"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

/** Decorative scattered leaves for the dark botanical backdrop. Purely
 * visual — mount inside a `relative overflow-hidden` container with the
 * real content given a higher z-index. */
export function LeafField() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <Leaf
        className="absolute -top-10 left-[4%] h-44 w-44 -rotate-[18deg] opacity-90"
        color="#274A34"
      />
      <Leaf
        className="absolute -top-6 left-[16%] h-24 w-24 rotate-[28deg] opacity-80"
        color="#7A4A2A"
      />
      <Leaf
        className="absolute -top-14 right-[8%] h-52 w-52 rotate-[155deg] opacity-90"
        color="#3C6B48"
      />
      <Leaf
        className="absolute top-10 right-[24%] h-20 w-20 -rotate-[35deg] opacity-70"
        color="#8A5A32"
      />
      <Leaf
        className="absolute bottom-[6%] left-[2%] h-56 w-56 rotate-[200deg] opacity-80"
        color="#1F4536"
      />
      <Leaf
        className="absolute bottom-8 right-[4%] h-40 w-40 -rotate-[60deg] opacity-75"
        color="#6B4226"
      />
      <Leaf
        className="absolute top-[42%] -left-10 h-32 w-32 rotate-[95deg] opacity-60"
        color="#4C7A54"
      />
      <Leaf
        className="absolute bottom-[28%] -right-8 h-36 w-36 rotate-[110deg] opacity-60"
        color="#5C3620"
      />
    </div>
  );
}

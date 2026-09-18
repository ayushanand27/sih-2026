function IconEmptyStar() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-ink/25" strokeWidth="1.3">
      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" />
    </svg>
  );
}

function EmptyReviewCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-clay-200 bg-white/60 p-8 text-center">
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <IconEmptyStar key={i} />
        ))}
      </div>
      <p className="text-sm font-semibold text-ink/50">No review yet</p>
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section id="reviews" className="scroll-mt-24 bg-clay-50 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-ink sm:text-4xl">
          Reviews
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-ink/60 sm:text-base">
          This is a new prototype — no reviews have been submitted yet. Check
          back once IP-SAKTI Sahayak has real users.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EmptyReviewCard key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

const RESOURCES: { name: string; url: string; description: string }[] = [
  {
    name: "Traditional Knowledge Digital Library (TKDL)",
    url: "https://www.tkdl.res.in",
    description:
      "Documents Ayurveda, Unani, Siddha and Yoga knowledge in a form patent examiners can search — used defensively, to reject or oppose claims that merely restate already-known traditional knowledge.",
  },
  {
    name: "India Code",
    url: "https://www.indiacode.nic.in",
    description:
      "Official full text of central Acts and Rules — the Patents Act, the Biological Diversity Act, the GI Act, and more.",
  },
  {
    name: "IP India",
    url: "https://www.ipindia.gov.in",
    description:
      "File and track patents, trademarks, designs, and geographical indications (InPASS, GI Registry).",
  },
  {
    name: "National Biodiversity Authority (NBA)",
    url: "https://www.nbaindia.org",
    description:
      "Apply for Access-and-Benefit-Sharing approval, or find your State Biodiversity Board's contact details.",
  },
];

function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-neu-sub">
      <path
        d="M9 6h9v9M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Points users to the free, official registries the problem statement
 * calls out by name (URLs taken directly from its own "Dataset Link"
 * text) — the app otherwise only ever shows internally-indexed PDFs, never
 * a path to the live registry a citation came from. */
export function OfficialResourcesPanel() {
  return (
    <div>
      <p className="text-sm font-bold text-neu-text">Official resources & registries</p>
      <p className="mt-1 text-xs leading-relaxed text-neu-sub">
        Free, official government sources — no paid subscription needed to
        use any of these. IP-SAKTI Sahayak links directly to them so you can
        move from a question to the right registry, record or form.
      </p>

      <div className="mt-4 space-y-2.5">
        {RESOURCES.map((r) => (
          <a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-neu-bg bg-white/70 p-3 transition hover:border-forest-300 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-neu-text">{r.name}</p>
              <IconExternal />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-neu-sub">{r.description}</p>
          </a>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-neu-sub/80">
        A future version could also connect your own paid subscriptions
        (e.g. a commercial patent database) — only ever with your explicit,
        logged permission.
      </p>
    </div>
  );
}

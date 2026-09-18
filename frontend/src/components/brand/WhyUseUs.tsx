const SECTIONS: {
  title: string;
  points: { lead: string; body: string }[];
}[] = [
  {
    title: "1. Programmatic Citation Integrity (Zero Hallucination by Design)",
    points: [
      {
        lead: "Deterministic Metadata Attachment:",
        body: "The LLM is strictly prohibited from writing or generating citations. Citations are programmatically bound by the application code, which extracts verified chunk metadata — source file, exact page number, section heading, and confidence score.",
      },
      {
        lead: 'The "Honest Abstention" Guardrail:',
        body: 'If retrieved statutory records do not contain the answer, the engine safely outputs "I could not find this in my sources" instead of extrapolating from parametric memory.',
      },
    ],
  },
  {
    title: "2. Industrial-Grade Hybrid Retrieval & Orchestration",
    points: [
      {
        lead: "BM25 + Dense Reciprocal Rank Fusion (RRF):",
        body: "Regulatory queries demand exact matching for section numbers (e.g., Section 3(p)) and botanical binomial nomenclature alongside conceptual semantic meaning. We fuse sparse BM25 and dense vector search over pgvector.",
      },
      {
        lead: "Cross-Encoder Precision Reranking:",
        body: "Top 40 candidates from hybrid retrieval are re-scored using a dedicated cross-encoder down to the top 5 high-relevance chunks before hitting the generation layer.",
      },
      {
        lead: "Deterministic LangGraph DAG:",
        body: "We eliminate autonomous, unpredictable agent loops. Execution follows a traceable Directed Acyclic Graph (DAG) with exactly one bounded conditional retry upon a weak rerank score — guaranteeing predictable response latency and zero runaway execution cycles.",
      },
    ],
  },
  {
    title: "3. Upstream Regulatory Pre-Conditioning",
    points: [
      {
        lead: "Formulation-First Routing:",
        body: "Intellectual property posture cannot be evaluated without drug classification. The platform dynamically conditions queries by formulation category (Classical Medicine, P&P, Phytopharmaceutical, Ayurveda-Aahar, or Cosmetics).",
      },
      {
        lead: "Dual-Jurisdiction Firewall:",
        body: "Domestic Indian laws and cross-border obligations are isolated to ensure provisions like Indian Access and Benefit-Sharing (ABS) duties under the Biological Diversity Act are never conflated with international patent regimes.",
      },
      {
        lead: "Verified Statutory Foundation:",
        body: "Out-of-the-box coverage spans the Patents Act 1970, Biological Diversity Act (2023 Amendment & 2024 Rules), GI Act (including 2025 Amendment), NDCT Rules 2019, Jan Vishwas Act 2023, and the landmark 2024 WIPO GRATK Treaty.",
      },
    ],
  },
  {
    title: "4. Enterprise-Grade, Sovereign Security",
    points: [
      {
        lead: "Trade Secret Protection:",
        body: "Featuring local/air-gapped inference capability via Ollama (with Groq ultra-low-latency fallback), proprietary formulations and unfiled patent claims never leak to public model training sets.",
      },
      {
        lead: "Modern Interface:",
        body: "Delivered via a responsive Next.js frontend built on a Modern Botanical Glassmorphism design system tailored for rapid executive scanning.",
      },
    ],
  },
];

export function WhyUseUs() {
  return (
    <div className="w-full rounded-[32px] bg-neu-surface p-8 text-left shadow-2xl sm:p-12">
      <h2 className="text-2xl font-bold text-neu-text sm:text-3xl">
        Why use us?
      </h2>

      <p className="mt-4 text-sm leading-relaxed text-neu-sub sm:text-base">
        IP-SAKTI Sahayak replaces generative AI guesswork with a
        deterministic, legally verifiable intelligence platform designed
        specifically for the high-stakes AYUSH bio-economy.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-neu-sub sm:text-base">
        In a regulatory environment, a confidently fabricated answer is far
        worse than no answer. While commercial legal-AI tools exhibit
        hallucination rates between 17% and 33% (as documented in
        peer-reviewed Stanford research), our architecture is engineered
        from the ground up to make statutory hallucination mathematically
        impossible.
      </p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-base font-bold text-neu-text sm:text-lg">
              {section.title}
            </h3>
            <ul className="mt-3 space-y-3">
              {section.points.map((p) => (
                <li key={p.lead} className="flex gap-2.5 text-sm leading-relaxed text-neu-sub sm:text-base">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#748C5B]" />
                  <span>
                    <span className="font-semibold text-neu-text">{p.lead}</span>{" "}
                    {p.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border-l-4 border-amber-400 bg-amber-50/60 p-4">
        <p className="text-sm font-semibold leading-relaxed text-amber-800 sm:text-base">
          The Bottom Line: Generic chatbots guess; IP-SAKTI Sahayak audits.
          It gives AYUSH enterprises, research institutions, and legal teams
          a defensible, source-verified regulatory copilot that cuts legal
          discovery time from weeks to seconds while eliminating compliance
          liability.
        </p>
      </div>
    </div>
  );
}

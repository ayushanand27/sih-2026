"use client";

import { useState } from "react";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is IP-SAKTI Sahayak?",
    answer:
      "It's a source-cited assistant for Ayurveda-related intellectual property and regulatory questions — covering the Patents Act, the Biological Diversity Act, the GI Act, NDCT Rules, and related AYUSH statutes. Every answer is grounded in retrieved statutory text rather than the model's own memory.",
  },
  {
    question: "Which jurisdictions does it cover?",
    answer:
      "You can ask questions under National (India) rules or International rules, set once at the start of a session. Domestic obligations — like Access and Benefit-Sharing duties under the Biological Diversity Act — are kept isolated from cross-border patent regimes so the two are never conflated.",
  },
  {
    question: "Where do the citations in an answer come from?",
    answer:
      "Citations are attached programmatically from the retrieved source chunks — file, page number, and section heading — never written by the language model itself. If the sources don't contain an answer, the assistant says so instead of guessing.",
  },
  {
    question: "Is my formulation or query data kept private?",
    answer:
      "The retrieval pipeline supports local/air-gapped inference, so proprietary formulations and unfiled claims can stay off public model training sets. This prototype's login is a local UI shell only — see the note under the login card.",
  },
  {
    question: "Is this an official Government of India service?",
    answer:
      "No — this is an open-source student prototype built for Smart India Hackathon 2026 (SIH26045) under the Ministry of AYUSH theme. It is not an officially published government service.",
  },
];

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 text-forest-600 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-panel ring-1 ring-black/5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
      >
        <span className="font-semibold text-ink sm:text-lg">{question}</span>
        <IconChevron open={open} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-ink/70 sm:px-6 sm:pb-6 sm:text-base">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-2xl font-bold text-ink sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-ink/60 sm:text-base">
          Everything you need to know before you ask your first question.
        </p>

        <div className="mt-10 space-y-3">
          {FAQS.map((faq, i) => (
            <FaqItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              open={openIndex === i}
              onToggle={() => setOpenIndex((prev) => (prev === i ? null : i))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

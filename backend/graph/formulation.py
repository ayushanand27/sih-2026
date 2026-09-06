"""
Formulation-category triage for IP-SAKTI.

Classifies which regulatory posture a question is asking about — an
Ayurvedic product's IP/ABS/labeling obligations differ sharply depending on
whether it's a classical formulation, a patent & proprietary (P&P) medicine,
a phytopharmaceutical, a nutraceutical (Ayurveda-Aahar), a cosmetic, or a new/
non-classical drug requiring CDSCO clinical trial permission under the NDCT
Rules 2019 — and injects that category plus its statutory tags into the
generation prompt so the LLM answers with the right regulatory frame in
view, not a generic one.

Deterministic on purpose, not an LLM call: this project's whole retry
mechanism exists because LLM-driven decisions (query rewriting) aren't
perfectly reproducible run to run — see graph/nodes.py's should_retry and
the empirical finding in idea.md. Classifying with another LLM call here
would reintroduce exactly that non-determinism one step earlier, before
retrieval even starts. A keyword classifier is a coarse instrument — it
will misclassify genuinely ambiguous or multi-category questions — but it
is at least the same coarse answer every time, which an LLM call is not
guaranteed to be even at temperature 0.

CATEGORY_STATUTORY_TAGS maps each category to a fixed vocabulary of
statutory tags. This is a heuristic FIRST PASS, not authoritative legal
categorization — see ingestion/chunker.py::tag_statutory_metadata for how
(and how unreliably) these tags actually get attached to indexed chunks.
Treat both the classifier and the tag map as something a domain expert
should review, not a finished legal taxonomy.

"patent_and_proprietary" naming (not the shorter "proprietary" this
category was originally keyed under): renamed to match a real classification
bug found in live testing (see CUSTOM_COMBINATION_NOTE below) — a custom
combination of individually-classical ingredients (e.g. "Turmeric +
Ashwagandha + Tulsi + Mulethi") was previously falling through to the
"classical" default, when it is not: verified directly against the real
indexed Drugs_and_Cosmetics_Act_and_Rules.pdf, Section 3(h) defines
"patent or proprietary medicine" for Ayurveda as a formulation using
First-Schedule-listed ingredients that does NOT itself appear as one of
the authoritative books' own formulae — i.e. exactly a novel/custom
combination of otherwise-classical ingredients. The longer key name makes
this the category's own primary identity, not an afterthought abbreviation.
"""

from __future__ import annotations

import re

FORMULATION_CATEGORIES: tuple[str, ...] = (
    "classical",
    "patent_and_proprietary",
    "phytopharmaceutical",
    "ayurveda_aahar",
    "cosmetic",
    "new_or_non_classical_drug",
)

# A question describing a *combination/blend/mixture* of named ingredients
# ("turmeric for wounds, made with ashwagandha, tulsi, mulethi etc.",
# "combination of X and Y", "mixing A, B and C") is describing a P&P
# medicine under Section 3(h) of the D&C Act, 1940 (verified against the
# real indexed Drugs_and_Cosmetics_Act_and_Rules.pdf: "patent or
# proprietary medicine" = a formulation using First-Schedule ingredients
# that is NOT ITSELF one of the authoritative books' own formulae) — even
# when every individual ingredient is itself classical. Real, reproduced
# bug this pattern fixes: without it, such a question matched no other
# category pattern and fell through to the "classical" default, which is
# the wrong regulatory category for a custom blend, not just an imprecise
# one — classical status requires the formulation itself (not just its
# ingredients) to appear in the First Schedule texts.
_CUSTOM_COMBINATION_PATTERN = re.compile(
    r"\b(combination|combo|blend|mixture|mix(?:ing)?|combining|"
    r"made with|made from)\b[^.?!]{0,100}"
    r"\b(ashwagandha|tulsi|turmeric|mulethi|neem|ginger|honey|"
    r"triphala|guduchi|amla|licorice|and|with|,)\b",
    re.I,
)

# Generic patent intent without formulation type — real user query that
# previously triggered a 90s LLM timeout when the model tried to digest
# the full reranked patent corpus at once.
_BROAD_PATENT_PATTERN = re.compile(
    r"\b(?:want|wants|need|needs|how)\s+to\s+patent\b|"
    r"\bpatent\s+(?:my|a|an|this|our)\s+(?:medicine|formula|formulation|drug|product|herb|herbal)\b|"
    r"\bpatent(?:ing)?\s+(?:a\s+)?(?:medicine|formula|formulation)\b",
    re.I,
)

_BROAD_PATENT_CLARIFY = (
    "To guide you correctly: is this a Classical Ayurvedic formulation "
    "(from recognized texts), a Patent & Proprietary (P&P) medicine, a "
    "phytopharmaceutical, an Ayurveda-Aahar product, or something else? "
    "The regulatory and IP path differs sharply between these categories."
)

# Verbatim text supplied by the domain-expert review that found this
# classification gap — kept exactly as given, not paraphrased, since it is
# itself a specific legal statement citing exact section numbers (both
# independently verified against the real indexed corpus this session:
# D&C Act Section 3(h) — data/Drugs_and_Cosmetics_Act_and_Rules.pdf;
# Patents Act Section 3(e)'s "mere admixture...aggregation of the
# properties" language — data/Patents_Act_1970.pdf).
CUSTOM_COMBINATION_NOTE = (
    "Regulated as Patent & Proprietary (P&P) Ayurvedic Medicine under "
    "Section 3(h) of D&C Act, 1940; excluded from patentability under "
    "Patents Act 1970 Sections 3(p) and 3(e) unless synergistic efficacy "
    "beyond mere aggregation is proven."
)

# Checked in this fixed order, first match wins — order matters where terms
# could plausibly overlap (e.g. "patent" alone is too generic to trigger
# "patent_and_proprietary" on its own; only the P&P-specific phrasing does).
_CATEGORY_PATTERNS: list[tuple[str, re.Pattern]] = [
    (
        "ayurveda_aahar",
        re.compile(r"\b(nutraceutical|ayurveda[\s-]*aahar|dietary supplement|functional food|food product)\b", re.I),
    ),
    (
        "cosmetic",
        re.compile(r"\b(cosmetic|soap|face\s*wash|skin\s*care|shampoo|lotion)\b", re.I),
    ),
    (
        "phytopharmaceutical",
        re.compile(r"\b(phytopharmaceutical|botanical drug|standardi[sz]ed (botanical )?extract)\b", re.I),
    ),
    (
        "patent_and_proprietary",
        re.compile(
            r"\b(proprietary medicine|patent(?:ed)? or proprietary|p\s*(?:&|and)\s*p\b|"
            r"proprietary ayurvedic|proprietary formulation)\b",
            re.I,
        ),
    ),
    (
        # Deliberately narrow, distinctive phrasing (NDCT Rules 2019 terms
        # of art) rather than the generic "clinical trial" alone — that
        # phrase alone already feeds CATEGORY_STATUTORY_TAGS's
        # Clinical_Validation tag for *every* category below and would
        # false-positive on, e.g., a phytopharmaceutical or P&P
        # question that merely mentions clinical validation in passing.
        # "new drug"/"non-classical drug" and NDCT-specific terms (IND,
        # safety dossier, new chemical entity) are what actually
        # distinguishes "this needs a fresh CDSCO clinical-trial-permission
        # pathway" from "this is an established category with its own
        # lighter-weight route".
        "new_or_non_classical_drug",
        re.compile(
            r"\b(new drug|non-classical drug|novel (?:ayurvedic )?drug|"
            r"investigational new drug|\bind application\b|safety dossier|"
            r"clinical trial permission|ndct rules|new chemical entity)\b",
            re.I,
        ),
    ),
]

# Canonical tag taxonomy. Every name here must match a real tag that
# ingestion/chunker.py::_compile_statutory_tag_rules or
# _compile_heading_tag_rules can actually produce — with one now-explicit
# exception: D&C_Rule_158B currently has ZERO real indexed chunks (verified
# directly this session — data/Drugs_and_Cosmetics_Act_and_Rules.pdf
# contains only the Act's Sections, not the separate 1945 Rules where
# Rule 158-B's actual phytopharmaceutical/P&P-licensing text lives). It is
# kept here as advisory framing only (tells the LLM "this statutory area is
# typically relevant"), same as WIPO_GRATK_Art3_Disclosure was reserved
# before its real source document existed — see data/international/README.md
# for that precedent. The LLM cannot and will not actually cite Rule 158B
# with real chunk text until the real 1945 Rules document is sourced and
# indexed; this framing note does not fabricate that gap away.
# classical/patent_and_proprietary/ayurveda_aahar were given explicitly;
# phytopharmaceutical and cosmetic's tag sets are a reasonable extrapolation
# from how those categories are actually regulated (D&C Rules for
# phytopharmaceuticals, no-therapeutic-claim for cosmetics), not a literal
# spec, and should be reviewed the same as the rest of this heuristic.
CATEGORY_STATUTORY_TAGS: dict[str, list[str]] = {
    "classical": ["Patents_Act_Sec3p", "Patents_Act_Sec3d", "TKDL", "D&C_First_Schedule", "BDA_Sec7_SBB_Exemption"],
    "patent_and_proprietary": [
        "Patents_Act_Sec3p", "Patents_Act_Sec3e", "BDA_Sec6_NBA_Approval",
        "D&C_Rule_158B", "Clinical_Validation",
    ],
    "phytopharmaceutical": ["D&C_Rule_158B", "Clinical_Validation"],
    "ayurveda_aahar": ["FSSAI_Ayurveda_Aahar_2022", "No_Therapeutic_Claim"],
    "cosmetic": ["D&C_Cosmetic_Rules", "No_Therapeutic_Claim"],
    "new_or_non_classical_drug": ["NDCT_Rules_2019", "Clinical_Validation"],
}

CATEGORY_LABELS: dict[str, str] = {
    "classical": "Classical Ayurvedic Medicine",
    "patent_and_proprietary": "Patent & Proprietary (P&P) Ayurvedic Medicine",
    "phytopharmaceutical": "Phytopharmaceutical",
    "ayurveda_aahar": "Ayurveda-Aahar (Nutraceutical)",
    "cosmetic": "Cosmetic",
    "new_or_non_classical_drug": "New / Non-Classical Drug (NDCT Rules 2019)",
}

_CLARIFYING_DESCRIPTIONS: dict[str, str] = {
    "classical": "a classical/traditional Ayurvedic formulation (e.g. from a recognized classical text)",
    "patent_and_proprietary": "a Patent & Proprietary (P&P) medicine with a brand name and its own formulation",
    "phytopharmaceutical": "a phytopharmaceutical drug (standardized botanical extract)",
    "ayurveda_aahar": "an Ayurveda-Aahar / nutraceutical food product",
    "cosmetic": "a cosmetic product",
    "new_or_non_classical_drug": "a new or non-classical drug requiring clinical trial permission under the NDCT Rules 2019",
}


def triage_formulation(query: str) -> dict:
    """
    Keyword-match `query` against every category (not just the first hit),
    so genuine ambiguity — two or more categories' keywords both present —
    is detectable, not silently resolved by whichever pattern happens to
    be checked first.

    Zero matches still defaults to "classical" UNLESS the query describes a
    custom combination of named ingredients (_CUSTOM_COMBINATION_PATTERN),
    in which case it defaults to "patent_and_proprietary" instead — see
    that pattern's own comment for the real classification bug this fixes.
    Two or more matches DO ask for clarification — that's a real signal the
    question spans categories with materially different statutory
    obligations, not just coarse keyword-matching noise.

    `formulation_notes` carries deterministic, code-authored legal-context
    strings (currently only CUSTOM_COMBINATION_NOTE) — never LLM-generated,
    same "the model doesn't author framing it could get wrong" principle as
    CATEGORY_STATUTORY_TAGS itself. Always present as a list (possibly
    empty), so a caller never needs a None check.

    Returns a dict — not a class — since this is exactly what gets merged
    into GraphState (a plain dict-of-keys, per this project's node
    convention; see graph/nodes.py).
    """
    matched = [category for category, pattern in _CATEGORY_PATTERNS if pattern.search(query)]
    is_custom_combination = bool(_CUSTOM_COMBINATION_PATTERN.search(query))
    is_broad_patent = bool(_BROAD_PATENT_PATTERN.search(query))

    if not matched and is_custom_combination:
        matched = ["patent_and_proprietary"]

    notes = [CUSTOM_COMBINATION_NOTE] if (is_custom_combination and "patent_and_proprietary" in matched) else []

    if is_broad_patent and len(matched) <= 1:
        category = matched[0] if matched else "patent_and_proprietary"
        return {
            "formulation_category": category,
            "needs_clarification": True,
            "clarifying_questions": [_BROAD_PATENT_CLARIFY],
            "formulation_notes": notes,
        }

    if len(matched) >= 2:
        options = " or ".join(_CLARIFYING_DESCRIPTIONS[c] for c in matched)
        question = (
            f"This question touches more than one formulation category — is it "
            f"about {options}? The answer below assumes {CATEGORY_LABELS[matched[0]]} "
            f"unless you clarify."
        )
        return {
            "formulation_category": matched[0],
            "needs_clarification": True,
            "clarifying_questions": [question],
            "formulation_notes": notes,
        }

    category = matched[0] if matched else "classical"
    return {
        "formulation_category": category,
        "needs_clarification": False,
        "clarifying_questions": [],
        "formulation_notes": notes,
    }


def classify_formulation(query: str) -> str:
    """Category only, no clarification info — thin wrapper over
    triage_formulation() for callers (e.g. tests) that just want the
    category."""
    return triage_formulation(query)["formulation_category"]

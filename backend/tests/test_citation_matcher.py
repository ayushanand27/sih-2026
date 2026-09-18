from scripts.citation_matcher import check_citations_matched, expected_statute_matches


def test_section_paren_variant_in_snippet():
    corpus = "patents act 1970 section 3 (p) traditional knowledge"
    assert expected_statute_matches("Section 3(p)", corpus)


def test_form_number_in_answer():
    assert check_citations_matched(
        [{"source_file": "BD_Rules_2024.pdf", "section_heading": "NBA"}],
        "submit form 3 with the prescribed fee",
        ["Form 3", "Section 99"],
    )


def test_act_name_tokens_from_filename():
    assert check_citations_matched(
        [
            {
                "source_file": "Biological_Diversity_Act_2002.pdf",
                "section_heading": "Approval",
                "exact_snippet": "national biodiversity authority",
            }
        ],
        "NBA approval is required",
        ["Biological Diversity Act"],
    )


def test_wrong_section_subclause_does_not_match():
    corpus = "under section 7 of the biological diversity act"
    assert not expected_statute_matches("Section 6(1)", corpus)

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CitationCard } from "./CitationCard";
import type { Citation } from "@/lib/types";

const citation: Citation = {
  chunk_id: "chunk-1",
  source_file: "Patents_Act_1970.pdf",
  page_number: 12,
  section_heading: "Section 3(p)",
  exact_snippet: "What is traditional knowledge shall not be patentable.",
};

describe("CitationCard", () => {
  it("shows the source file, page, and section heading", () => {
    render(<CitationCard citation={citation} index={0} onView={jest.fn()} />);

    expect(screen.getByText("Patents_Act_1970.pdf")).toBeInTheDocument();
    expect(screen.getByText(/p\. 12/)).toBeInTheDocument();
    expect(screen.getByText(/Section 3\(p\)/)).toBeInTheDocument();
  });

  it("calls onView with the citation when 'View source PDF' is clicked", async () => {
    const user = userEvent.setup();
    const onView = jest.fn();
    render(<CitationCard citation={citation} index={0} onView={onView} />);

    await user.click(screen.getByRole("button", { name: /view source pdf/i }));

    expect(onView).toHaveBeenCalledWith(citation);
  });

  it("hides the exact snippet until 'View exact snippet' is clicked", async () => {
    const user = userEvent.setup();
    render(<CitationCard citation={citation} index={0} onView={jest.fn()} />);

    expect(screen.queryByText(citation.exact_snippet)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view exact snippet/i }));

    expect(screen.getByText(citation.exact_snippet)).toBeInTheDocument();
  });
});

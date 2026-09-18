import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "./ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders the confidence percentage", () => {
    render(<ConfidenceBadge confidence={82} />);
    expect(screen.getByText("82% match")).toBeInTheDocument();
  });

  it("labels itself as a relevance score, not an accuracy figure", () => {
    render(<ConfidenceBadge confidence={82} />);
    expect(screen.getByTitle(/relevance score/i)).toBeInTheDocument();
  });

  it.each([
    [90, "text-[#5B6F45]"],
    [60, "text-amber-700"],
    [20, "text-neu-sub"],
  ])("uses a distinct tone for confidence=%i", (confidence, expectedClass) => {
    render(<ConfidenceBadge confidence={confidence} />);
    expect(screen.getByText(`${confidence}% match`)).toHaveClass(expectedClass);
  });
});

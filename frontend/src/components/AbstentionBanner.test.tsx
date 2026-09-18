import { render, screen } from "@testing-library/react";
import { AbstentionBanner } from "./AbstentionBanner";

describe("AbstentionBanner", () => {
  it("tells the user this is an honest abstention, not a guess", () => {
    render(<AbstentionBanner />);
    expect(screen.getByText(/honest abstention, not a guess/i)).toBeInTheDocument();
  });
});

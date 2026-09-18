import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/components/brand/AccountRail", () => ({
  AccountRail: () => null,
}));

import { IntakeScreen } from "./IntakeScreen";

describe("IntakeScreen jurisdiction toggle", () => {
  it("lets the user pick India or International before starting", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(<IntakeScreen onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: /^india$/i }));
    await user.click(screen.getByRole("button", { name: /start asking questions/i }));

    expect(onStart).toHaveBeenCalledWith("india", null);
  });

  it("passes international jurisdiction when that toggle is selected", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(<IntakeScreen onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: /^international$/i }));
    await user.click(screen.getByRole("button", { name: /start asking questions/i }));

    expect(onStart).toHaveBeenCalledWith("international", null);
  });
});

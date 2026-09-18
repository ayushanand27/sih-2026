import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewChatButton } from "./NewChatButton";

describe("NewChatButton", () => {
  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<NewChatButton onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: /new chat/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

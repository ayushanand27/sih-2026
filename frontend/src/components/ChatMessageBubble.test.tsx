import { render, screen } from "@testing-library/react";
import { ChatMessageBubble } from "./ChatMessageBubble";
import type { ConversationMessage } from "@/lib/types";

const baseProps = {
  onViewCitation: jest.fn(),
  speaking: false,
  onToggleSpeak: jest.fn(),
  speechSupported: false,
};

describe("ChatMessageBubble", () => {
  it("renders a user message without the legal-advice disclaimer", () => {
    const message: ConversationMessage = { id: "1", role: "user", content: "What is Section 3(p)?" };
    render(<ChatMessageBubble message={message} {...baseProps} />);

    expect(screen.getByText("What is Section 3(p)?")).toBeInTheDocument();
    expect(screen.queryByText(/not legal advice/i)).not.toBeInTheDocument();
  });

  it("shows the 'not legal advice' disclaimer under every assistant answer", () => {
    const message: ConversationMessage = {
      id: "2",
      role: "assistant",
      content: "Section 3(p) bars patents on traditional knowledge.",
    };
    render(<ChatMessageBubble message={message} {...baseProps} />);

    expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
  });

  it("shows an abstention banner instead of citations when the model abstained", () => {
    const message: ConversationMessage = {
      id: "3",
      role: "assistant",
      content: "I could not find this in my sources.",
      flags: { abstained: true, retried: false, weak_grounding: false },
      citations: [
        {
          chunk_id: "c1",
          source_file: "Some_Act.pdf",
          page_number: 1,
          section_heading: "Irrelevant",
          exact_snippet: "...",
        },
      ],
    };
    render(<ChatMessageBubble message={message} {...baseProps} />);

    expect(screen.getByText(/honest abstention/i)).toBeInTheDocument();
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });

  it("lists citations for a normal, non-abstained answer", () => {
    const message: ConversationMessage = {
      id: "4",
      role: "assistant",
      content: "Here is the answer.",
      flags: { abstained: false, retried: false, weak_grounding: false },
      citations: [
        {
          chunk_id: "c1",
          source_file: "Biological_Diversity_Act.pdf",
          page_number: 5,
          section_heading: "Section 3",
          exact_snippet: "...",
        },
      ],
    };
    render(<ChatMessageBubble message={message} {...baseProps} />);

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Biological_Diversity_Act.pdf")).toBeInTheDocument();
  });

  it("renders an error bubble when the message failed, without the disclaimer", () => {
    const message: ConversationMessage = {
      id: "5",
      role: "assistant",
      content: "",
      error: "Could not reach the backend.",
    };
    render(<ChatMessageBubble message={message} {...baseProps} />);

    expect(screen.getByText(/backend couldn't answer that/i)).toBeInTheDocument();
    expect(screen.getByText("Could not reach the backend.")).toBeInTheDocument();
    expect(screen.queryByText(/not legal advice/i)).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MessageBubble from "./components/MessageBubble";
import { Message } from "./types";

describe("MessageBubble wrapping", () => {
  it("marks normal message bubbles to wrap long unbroken content inside the bubble", () => {
    const message: Message = {
      id: "msg-1",
      role: "assistant",
      text: "C:\\Users\\shlob\\Projects\\VeryLongFolderNameWithoutAnyBreakpoints\\AnotherVeryLongSegment\\file.tsx",
    };

    render(<MessageBubble message={message} sessionProvider="codex" />);

    expect(screen.getByText(message.text).className).toContain("message-bubble-wrap");
  });

  it("marks expanded handoff content to wrap long unbroken content inside the bubble", () => {
    const message: Message = {
      id: "msg-2",
      role: "assistant",
      text: "You are an AI assistant taking over this conversation. Here is the conversation so far:\n\nC:\\Users\\shlob\\Projects\\VeryLongFolderNameWithoutAnyBreakpoints\\AnotherVeryLongSegment\\handoff.txt",
      isContextHandoff: true,
    };

    render(<MessageBubble message={message} sessionProvider="codex" />);

    fireEvent.click(screen.getByRole("button", { name: "Context from previous conversation" }));

    expect(screen.getByText(/handoff\.txt/).className).toContain("message-bubble-wrap");
  });

  it("replaces the streaming pipe with the provider spinner inline while text is streaming", () => {
    const message: Message = {
      id: "msg-3",
      role: "assistant",
      text: "Streaming reply",
      streaming: true,
      provider: "codex",
    };

    const { container } = render(<MessageBubble message={message} sessionProvider="codex" />);

    expect(screen.getByTestId("message-streaming-spinner")).toBeTruthy();
    expect(container.textContent).not.toContain("|");
  });
});

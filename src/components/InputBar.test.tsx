import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InputBar from "./InputBar";

describe("InputBar", () => {
  afterEach(() => {
    cleanup();
  });

  function renderBar(overrides: Partial<Parameters<typeof InputBar>[0]> = {}) {
    const defaults = {
      streaming: false,
      provider: "claude" as const,
      model: "claude-sonnet-4-6",
      onProviderChange: () => {},
      onModelChange: () => {},
      onSend: vi.fn(),
      onCancel: vi.fn(),
    };
    return render(<InputBar {...defaults} {...overrides} />);
  }

  it("send button is disabled when textarea is empty", () => {
    renderBar();
    const sendButton = screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it("send button enables after typing text", () => {
    renderBar();
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "hello" } });
    const sendButton = screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });

  it("send button disables again after clearing text", () => {
    renderBar();
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "hello" } });
    fireEvent.input(textarea, { target: { value: "" } });
    const sendButton = screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it("submits trimmed text on Enter", () => {
    const onSend = vi.fn();
    renderBar({ onSend });
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "  hello world  " } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });
    expect(onSend).toHaveBeenCalledWith("hello world");
    expect(textarea.value).toBe("");
  });

  it("shows a labelled cancel button while streaming", () => {
    const onCancel = vi.fn();
    renderBar({ streaming: true, onCancel });
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    const cancelButton = screen.getByRole("button", { name: "Cancel response" });
    expect(textarea.disabled).toBe(true);
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

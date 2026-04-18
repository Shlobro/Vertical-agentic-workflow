import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InputBar from "./InputBar";

describe("InputBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits trimmed text on Enter", () => {
    const onSend = vi.fn();

    render(
      <InputBar
        disabled={false}
        streaming={false}
        provider="claude"
        model="claude-sonnet-4-6"
        onProviderChange={() => {}}
        onModelChange={() => {}}
        onSend={onSend}
        onCancel={() => {}}
      />,
    );

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "  hello world  " } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    expect(onSend).toHaveBeenCalledWith("hello world");
    expect(textarea.value).toBe("");
  });

  it("shows a labelled cancel button while streaming", () => {
    const onCancel = vi.fn();

    render(
      <InputBar
        disabled={false}
        streaming={true}
        provider="claude"
        model="claude-sonnet-4-6"
        onProviderChange={() => {}}
        onModelChange={() => {}}
        onSend={() => {}}
        onCancel={onCancel}
      />,
    );

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    const cancelButton = screen.getByRole("button", { name: "Cancel response" });

    expect(textarea.disabled).toBe(true);
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

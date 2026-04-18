import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InputBar from "./InputBar";

describe("InputBar", () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    cleanup();
    window.innerHeight = originalInnerHeight;
    vi.restoreAllMocks();
  });

  function renderBar(overrides: Partial<Parameters<typeof InputBar>[0]> = {}) {
    const defaults = {
      streaming: false,
      provider: "claude" as const,
      model: "claude-sonnet-4-6",
      projectFilePaths: [],
      onProviderChange: vi.fn(),
      onModelChange: vi.fn(),
      onSend: vi.fn(),
      onCancel: vi.fn(),
    };
    return { ...render(<InputBar {...defaults} {...overrides} />), ...defaults, ...overrides };
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

  it("does not render a working directory button", () => {
    renderBar();
    expect(screen.queryByLabelText(/working directory/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /pick working directory/i })).toBeNull();
  });

  it("renders separate provider and model dropdowns", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Select provider" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select model" })).toBeTruthy();
  });

  it("opens provider dropdown and calls onProviderChange when a provider is clicked", () => {
    const onProviderChange = vi.fn();
    renderBar({ onProviderChange });
    fireEvent.click(screen.getByRole("button", { name: "Select provider" }));
    const openAIOption = screen.getByText("OpenAI");
    fireEvent.click(openAIOption);
    expect(onProviderChange).toHaveBeenCalledWith("codex");
  });

  it("opens model dropdown and calls onModelChange when a model is clicked", () => {
    const onModelChange = vi.fn();
    renderBar({ onModelChange });
    fireEvent.click(screen.getByRole("button", { name: "Select model" }));
    const opusOption = screen.getByText("Claude Opus 4.7");
    fireEvent.click(opusOption);
    expect(onModelChange).toHaveBeenCalledWith("claude-opus-4-7");
  });

  it("shows matching file suggestions for @mentions and inserts the highlighted path with tab", () => {
    renderBar({
      projectFilePaths: ["README.md", "src/components/InputBar.tsx", "src/App.tsx"],
    });

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "@inp" } });

    expect(screen.getByRole("listbox", { name: "File suggestions" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "src/components/InputBar.tsx" })).toBeTruthy();

    fireEvent.keyDown(textarea, { key: "Tab", code: "Tab" });

    expect(textarea.value).toBe("src/components/InputBar.tsx ");
    expect(screen.queryByRole("listbox", { name: "File suggestions" })).toBeNull();
  });

  it("supports arrow keys before tab commits the selected file path", () => {
    renderBar({
      projectFilePaths: ["docs/input-reference.md", "src/components/InputBar.tsx"],
    });

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "@input" } });

    const options = screen.getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(textarea, { key: "ArrowDown", code: "ArrowDown" });

    const updatedOptions = screen.getAllByRole("option");
    expect(updatedOptions[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(textarea, { key: "Tab", code: "Tab" });

    expect(textarea.value).toBe("docs/input-reference.md ");
  });

  it("places file suggestions above the composer when there is not enough room below", () => {
    window.innerHeight = 640;

    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    rectSpy.mockImplementation(function (this: HTMLElement) {
      if (this.tagName === "DIV" && this.className.includes("rounded-xl border border-border bg-surface")) {
        return {
          x: 0,
          y: 520,
          top: 520,
          bottom: 620,
          left: 0,
          right: 400,
          width: 400,
          height: 100,
          toJSON: () => ({}),
        };
      }

      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      };
    });

    renderBar({
      projectFilePaths: ["src/components/InputBar.tsx"],
    });

    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "@inp" } });

    expect(screen.getByRole("listbox", { name: "File suggestions" }).getAttribute("data-placement")).toBe("above");
  });
});

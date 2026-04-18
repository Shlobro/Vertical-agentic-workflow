import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MissingCompanionFilesDialog from "./MissingCompanionFilesDialog";

describe("MissingCompanionFilesDialog", () => {
  it("does not render when closed", () => {
    render(
      <MissingCompanionFilesDialog
        open={false}
        missingFiles={["CLAUDE.md"]}
        selectedFiles={["CLAUDE.md"]}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText("Missing repo instruction files")).toBeNull();
  });

  it("renders missing files and forwards toggle, cancel, and continue actions", () => {
    const onToggle = vi.fn();
    const onContinue = vi.fn();
    const onCancel = vi.fn();

    render(
      <MissingCompanionFilesDialog
        open
        missingFiles={["CLAUDE.md", "GEMINI.md"]}
        selectedFiles={["GEMINI.md"]}
        onToggle={onToggle}
        onContinue={onContinue}
        onCancel={onCancel}
      />
    );

    const claudeCheckbox = screen.getByRole("checkbox", { name: "Create CLAUDE.md" });
    const geminiCheckbox = screen.getByRole("checkbox", { name: "Create GEMINI.md" });

    expect((claudeCheckbox as HTMLInputElement).checked).toBe(false);
    expect((geminiCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(claudeCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onToggle).toHaveBeenCalledWith("CLAUDE.md");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

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
        templateContent="template"
        rememberTemplate={false}
        isEditingTemplate={false}
        onToggle={vi.fn()}
        onOpenEditor={vi.fn()}
        onTemplateChange={vi.fn()}
        onRememberTemplateChange={vi.fn()}
        onRestoreSystemDefault={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText("Missing repo instruction files")).toBeNull();
  });

  it("renders missing files and forwards toggle, cancel, and continue actions", () => {
    const onToggle = vi.fn();
    const onOpenEditor = vi.fn();
    const onTemplateChange = vi.fn();
    const onRememberTemplateChange = vi.fn();
    const onRestoreSystemDefault = vi.fn();
    const onContinue = vi.fn();
    const onCancel = vi.fn();

    render(
      <MissingCompanionFilesDialog
        open
        missingFiles={["CLAUDE.md", "GEMINI.md"]}
        selectedFiles={["GEMINI.md"]}
        templateContent="template body"
        rememberTemplate
        isEditingTemplate
        onToggle={onToggle}
        onOpenEditor={onOpenEditor}
        onTemplateChange={onTemplateChange}
        onRememberTemplateChange={onRememberTemplateChange}
        onRestoreSystemDefault={onRestoreSystemDefault}
        onContinue={onContinue}
        onCancel={onCancel}
      />
    );

    const claudeCheckbox = screen.getByRole("checkbox", { name: "Create CLAUDE.md" });
    const geminiCheckbox = screen.getByRole("checkbox", { name: "Create GEMINI.md" });

    expect((claudeCheckbox as HTMLInputElement).checked).toBe(false);
    expect((geminiCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(claudeCheckbox);
    fireEvent.change(screen.getByRole("textbox", { name: "Companion file template" }), {
      target: { value: "edited body" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember edited template as default" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore system default" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onToggle).toHaveBeenCalledWith("CLAUDE.md");
    expect(onTemplateChange).toHaveBeenCalledWith("edited body");
    expect(onRememberTemplateChange).toHaveBeenCalledWith(false);
    expect(onRestoreSystemDefault).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onOpenEditor).toHaveBeenCalledTimes(0);
  });

  it("shows the editor button when the template editor is closed", () => {
    const onOpenEditor = vi.fn();

    render(
      <MissingCompanionFilesDialog
        open
        missingFiles={["CLAUDE.md"]}
        selectedFiles={["CLAUDE.md"]}
        templateContent="template body"
        rememberTemplate={false}
        isEditingTemplate={false}
        onToggle={vi.fn()}
        onOpenEditor={onOpenEditor}
        onTemplateChange={vi.fn()}
        onRememberTemplateChange={vi.fn()}
        onRestoreSystemDefault={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit default content" }));

    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });
});

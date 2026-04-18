import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";
import { ChatProject } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

const projects: ChatProject[] = [
  {
    id: "project-1",
    title: "Alpha",
    workingDir: "D:\\Projects\\Alpha",
    collapsed: false,
    lastActiveSessionId: "session-1",
    sessions: [
      {
        id: "session-1",
        title: "First chat",
        provider: "claude",
        model: "claude-sonnet-4-6",
        cliSessionId: "",
        messages: [],
        isStreaming: false,
      },
    ],
  },
  {
    id: "project-2",
    title: "Beta",
    workingDir: "D:\\Projects\\Beta",
    collapsed: false,
    lastActiveSessionId: "session-2",
    sessions: [
      {
        id: "session-2",
        title: "Second chat",
        provider: "codex",
        model: "gpt-5.4",
        cliSessionId: "",
        messages: [],
        isStreaming: true,
      },
    ],
  },
];

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
  });

  function renderSidebar(overrides: Partial<ComponentProps<typeof Sidebar>> = {}) {
    return render(
      <Sidebar
        width={288}
        isResizing={false}
        onResizeStart={vi.fn()}
        projects={projects}
        activeSessionId="session-2"
        onNewProject={vi.fn()}
        onNewChat={vi.fn()}
        onToggleProject={vi.fn()}
        onSelectSession={vi.fn()}
        onRenameProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onRenameSession={vi.fn()}
        onDeleteSession={vi.fn()}
        {...overrides}
      />
    );
  }

  it("renames a project from the actions menu", () => {
    const onRenameProject = vi.fn();

    renderSidebar({ onRenameProject });

    fireEvent.click(screen.getByRole("button", { name: "Open actions for project Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename project" }));

    const input = screen.getByLabelText("Rename project");
    fireEvent.change(input, { target: { value: "Renamed project" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameProject).toHaveBeenCalledWith("project-2", "Renamed project");
  });

  it("creates a new chat inside a project", () => {
    const onNewChat = vi.fn();

    renderSidebar({ activeSessionId: "session-1", onNewChat });

    fireEvent.click(screen.getByRole("button", { name: "New chat in Alpha" }));

    expect(onNewChat).toHaveBeenCalledWith("project-1");
  });

  it("deletes a chat from the chat actions menu", () => {
    const onDeleteSession = vi.fn();

    renderSidebar({ activeSessionId: "session-1", onDeleteSession });

    fireEvent.click(screen.getByRole("button", { name: "Open actions for First chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDeleteSession).toHaveBeenCalledWith("session-1");
  });

  it("toggles a project collapse button", () => {
    const onToggleProject = vi.fn();

    renderSidebar({ activeSessionId: "session-1", onToggleProject });

    fireEvent.click(screen.getByRole("button", { name: "Collapse Alpha" }));

    expect(onToggleProject).toHaveBeenCalledWith("project-1");
  });

  it("shows each chat's provider icon in the session row", () => {
    renderSidebar();

    expect(screen.getByAltText("claude provider").getAttribute("src")).toBe(PROVIDER_ICONS.claude);
    expect(screen.getByAltText("codex provider").getAttribute("src")).toBe(PROVIDER_ICONS.codex);
  });

  it("applies the supplied width and exposes a resize handle", () => {
    const onResizeStart = vi.fn();
    const { container } = renderSidebar({ width: 344, onResizeStart });

    expect((container.firstChild as HTMLElement).style.width).toBe("344px");

    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(handle.className).toContain("cursor-col-resize");

    fireEvent.mouseDown(handle, { clientX: 344 });

    expect(onResizeStart).toHaveBeenCalledTimes(1);
  });
});

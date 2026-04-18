import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";
import { ChatSession } from "../types";

const sessions: ChatSession[] = [
  {
    id: "session-1",
    title: "First chat",
    provider: "claude",
    model: "claude-sonnet-4-6",
    cliSessionId: "",
    messages: [],
    isStreaming: false,
    workingDir: "",
  },
  {
    id: "session-2",
    title: "Second chat",
    provider: "codex",
    model: "gpt-5.4",
    cliSessionId: "",
    messages: [],
    isStreaming: true,
    workingDir: "",
  },
];

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renames a chat from the actions menu", () => {
    const onRenameSession = vi.fn();

    render(
      <Sidebar
        sessions={sessions}
        activeSessionId="session-2"
        onNewChat={vi.fn()}
        onSelectSession={vi.fn()}
        onRenameSession={onRenameSession}
        onDeleteSession={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open actions for Second chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename chat" }));

    const input = screen.getByLabelText("Rename chat");
    fireEvent.change(input, { target: { value: "Renamed chat" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameSession).toHaveBeenCalledWith("session-2", "Renamed chat");
  });

  it("deletes a chat from the actions menu", () => {
    const onDeleteSession = vi.fn();

    render(
      <Sidebar
        sessions={sessions}
        activeSessionId="session-1"
        onNewChat={vi.fn()}
        onSelectSession={vi.fn()}
        onRenameSession={vi.fn()}
        onDeleteSession={onDeleteSession}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open actions for First chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDeleteSession).toHaveBeenCalledWith("session-1");
  });
});

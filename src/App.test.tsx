import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useChatStore } from "./store/chatStore";

const listenMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
  message: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "C:\\Users\\Tester\\AppData\\Local\\Vertical\\"),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: vi.fn(async () => undefined),
}));

vi.mock("./components/Sidebar", () => ({
  default: ({
    sessions,
    onDeleteSession,
  }: {
    sessions: Array<{ id: string; title: string }>;
    onDeleteSession: (id: string) => void | Promise<void>;
  }) => (
    <div data-testid="sidebar">
      {sessions.map((session) => (
        <button key={session.id} onClick={() => onDeleteSession(session.id)}>
          Delete {session.title}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./components/ChatView", () => ({
  default: () => <div data-testid="chat-view" />,
}));

vi.mock("./components/InputBar", () => ({
  default: ({ onPickWorkingDir, workingDir }: { onPickWorkingDir: () => void; workingDir: string }) => (
    <div>
      <button onClick={onPickWorkingDir}>Pick working directory</button>
      <span data-testid="working-dir">{workingDir}</span>
    </div>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
    });
    listenMock.mockReset();
    listenMock.mockResolvedValue(vi.fn());
    openMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a session and stores the selected working directory when none exists", async () => {
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Pick working directory" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith({ directory: true, multiple: false });
    });

    await waitFor(() => {
      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.activeSession()?.workingDir).toBe("D:\\Projects\\Workspace");
    });

    expect(screen.getByTestId("working-dir").textContent).toBe("D:\\Projects\\Workspace");
  });

  it("confirms before deleting a chat", async () => {
    const store = useChatStore.getState();
    const session = store.addSession("claude", "claude-sonnet-4-6");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: `Delete ${session.title}` }));
    expect(screen.getByText(`This will permanently remove "${session.title}" from the sidebar.`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete chat" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessions).toHaveLength(0);
    });
  });

  it("keeps the chat when delete confirmation is cancelled", async () => {
    const store = useChatStore.getState();
    const session = store.addSession("claude", "claude-sonnet-4-6");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: `Delete ${session.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "Keep chat" }));

    expect(useChatStore.getState().sessions).toHaveLength(1);
    expect(useChatStore.getState().sessions[0].id).toBe(session.id);
  });
});

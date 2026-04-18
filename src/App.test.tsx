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
  default: () => <div data-testid="sidebar" />,
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
});

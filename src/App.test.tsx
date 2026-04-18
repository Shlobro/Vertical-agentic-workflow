import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useChatStore } from "./store/chatStore";
import { invoke } from "@tauri-apps/api/core";

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
}));

vi.mock("./components/Sidebar", () => ({
  default: ({
    projects,
    onNewProject,
    onDeleteProject,
    onDeleteSession,
  }: {
    projects: Array<{ id: string; title: string; sessions: Array<{ id: string; title: string }> }>;
    onNewProject: () => void | Promise<void>;
    onDeleteProject: (id: string) => void;
    onDeleteSession: (id: string) => void;
  }) => (
    <div data-testid="sidebar">
      <button onClick={() => void onNewProject()}>New project</button>
      {projects.map((project) => (
        <div key={project.id}>
          <button onClick={() => onDeleteProject(project.id)}>Delete project {project.title}</button>
          {project.sessions.map((session) => (
            <button key={session.id} onClick={() => onDeleteSession(session.id)}>
              Delete {session.title}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("./components/ChatView", () => ({
  default: ({ session }: { session: unknown }) => <div data-testid="chat-view">{session ? "active" : "empty"}</div>,
}));

vi.mock("./components/InputBar", () => ({
  default: ({
    provider,
    model,
    onProviderChange,
    onModelChange,
    onSend,
  }: {
    provider: string;
    model: string;
    onProviderChange: (provider: "claude" | "codex") => void;
    onModelChange: (model: string) => void;
    onSend: (text: string) => void;
  }) => (
    <div data-testid="input-bar">
      <div data-testid="active-provider">{provider}</div>
      <div data-testid="active-model">{model}</div>
      <button onClick={() => onProviderChange("codex")}>Switch provider</button>
      <button onClick={() => onModelChange("gpt-5.4:high")}>Switch model</button>
      <button onClick={() => onSend("hello")}>Send</button>
    </div>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    useChatStore.setState({
      projects: [],
      activeSessionId: null,
    });
    listenMock.mockReset();
    listenMock.mockResolvedValue(vi.fn());
    openMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a project only after a folder is selected", async () => {
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith({ directory: true, multiple: false });
    });

    await waitFor(() => {
      const state = useChatStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].workingDir).toBe("D:\\Projects\\Workspace");
      expect(state.projects[0].sessions).toHaveLength(1);
    });
  });

  it("does not create a project when folder selection is cancelled", async () => {
    openMock.mockResolvedValue(null);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalled();
    });

    expect(useChatStore.getState().projects).toHaveLength(0);
  });

  it("confirms before deleting a project", async () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: `Delete project ${project.title}` }));
    expect(screen.getByText(`This will permanently remove "${project.title}" and all chats inside it.`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(0);
    });
  });

  it("hides the input bar when no chat is selected", () => {
    render(<App />);

    expect(screen.queryByTestId("input-bar")).toBeNull();
    expect(screen.getByTestId("chat-view").textContent).toBe("empty");
  });

  it("updates the active session config before sending", async () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    const session = project.sessions[0];
    store.finalizeAssistant(session.id, "", "claude-session-1");
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Switch provider" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch model" }));

    expect(screen.getByTestId("active-provider").textContent).toBe("codex");
    expect(screen.getByTestId("active-model").textContent).toBe("gpt-5.4:high");

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("send_message", {
        sessionUuid: session.id,
        provider: "codex",
        model: "gpt-5.4:high",
        prompt: "hello",
        cliSessionId: null,
        workingDir: "D:\\Projects\\Alpha",
      });
    });
  });
});

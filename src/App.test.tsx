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
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
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
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });

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

  it("hydrates projects from persisted workspace state on startup", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [
            {
              id: "project-1",
              title: "Alpha",
              workingDir: "D:\\Projects\\Alpha",
              collapsed: false,
              lastActiveSessionId: "session-2",
              sessions: [
                {
                  id: "session-2",
                  title: "Saved chat",
                  provider: "claude",
                  model: "claude-sonnet-4-6",
                  cliSessionId: "",
                  messages: [],
                  isStreaming: false,
                },
              ],
            },
          ],
          activeSessionId: "session-2",
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(1);
      expect(useChatStore.getState().activeSessionId).toBe("session-2");
    });
  });

  it("loads an existing persisted project instead of creating a fresh one", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command, args) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
        };
      }
      if (command === "load_project_state") {
        expect(args).toEqual({ workingDir: "D:\\Projects\\Workspace" });
        return {
          id: "project-1",
          title: "Workspace",
          workingDir: "D:\\Projects\\Workspace",
          collapsed: false,
          lastActiveSessionId: "session-9",
          sessions: [
            {
              id: "session-9",
              title: "Loaded chat",
              provider: "codex",
              model: "gpt-5.4",
              cliSessionId: "thread-9",
              messages: [],
              isStreaming: false,
            },
          ],
        };
      }
      return undefined;
    });
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(1);
      expect(useChatStore.getState().projects[0].sessions[0].title).toBe("Loaded chat");
      expect(useChatStore.getState().activeSessionId).toBe("session-9");
    });
  });
});

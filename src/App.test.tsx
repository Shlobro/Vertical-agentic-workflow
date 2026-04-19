import type { MouseEvent as ReactMouseEvent } from "react";
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
    width,
    onResizeStart,
    projects,
    onNewProject,
    onOpenProjectFolder,
    onOpenProjectTerminal,
    onDeleteProject,
    onDeleteSession,
  }: {
    width: number;
    onResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
    projects: Array<{ id: string; title: string; sessions: Array<{ id: string; title: string }> }>;
    onNewProject: () => void | Promise<void>;
    onOpenProjectFolder: (id: string) => void | Promise<void>;
    onOpenProjectTerminal: (id: string) => void | Promise<void>;
    onDeleteProject: (id: string) => void;
    onDeleteSession: (id: string) => void;
  }) => (
    <div data-testid="sidebar">
      <div data-testid="sidebar-width">{width}</div>
      <div role="separator" aria-label="Resize sidebar" onMouseDown={onResizeStart} />
      <button onClick={() => void onNewProject()}>New project</button>
      {projects.map((project) => (
        <div key={project.id}>
          <button onClick={() => void onOpenProjectFolder(project.id)}>Open folder {project.title}</button>
          <button onClick={() => void onOpenProjectTerminal(project.id)}>Open terminal {project.title}</button>
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
    projectFilePaths,
    onProviderChange,
    onModelChange,
    onSend,
  }: {
    provider: string;
    model: string;
    projectFilePaths: string[];
    onProviderChange: (provider: "claude" | "codex") => void;
    onModelChange: (model: string) => void;
    onSend: (text: string) => void;
  }) => (
    <div data-testid="input-bar">
      <div data-testid="active-provider">{provider}</div>
      <div data-testid="active-model">{model}</div>
      <div data-testid="project-file-count">{projectFilePaths.length}</div>
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
    invokeMock.mockImplementation(async (command, _args) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: [],
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      if (command === "list_project_files") {
        return {
          paths: [],
        };
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
    const invokeMock = vi.mocked(invoke);
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("load_workspace_state");
    });

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

  it("opens the project path in File Explorer from the sidebar action", async () => {
    const store = useChatStore.getState();
    store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open folder Alpha" }));

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("open_project_in_file_explorer", {
        workingDir: "D:\\Projects\\Alpha",
      });
    });
  });

  it("opens the project path in Windows Terminal from the sidebar action", async () => {
    const store = useChatStore.getState();
    store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open terminal Alpha" }));

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("open_project_in_terminal", {
        workingDir: "D:\\Projects\\Alpha",
      });
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
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command, _args) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      if (command === "list_project_files") {
        return {
          paths: [],
        };
      }
      return undefined;
    });

    render(<App />);

    // Switch provider on a session with no messages — no dialog shown
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

  it("shows provider switch dialog mid-chat and sends context handoff on confirm", async () => {
    const sessionId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const messages = [
      { id: "m1", role: "user" as const, text: "hello" },
      { id: "m2", role: "assistant" as const, text: "world", provider: "claude" as const, model: "claude-sonnet-4-6" },
    ];
    const workspaceState = {
      projects: [{
        id: projectId,
        title: "Alpha",
        workingDir: "D:\\Projects\\Alpha",
        collapsed: false,
        lastActiveSessionId: sessionId,
        sessions: [{
          id: sessionId,
          title: "Chat 1",
          provider: "claude" as const,
          model: "claude-sonnet-4-6",
          cliSessionId: "claude-session-1",
          messages,
          isStreaming: false,
        }],
      }],
      activeSessionId: sessionId,
      sidebarWidthRatio: null,
      textZoom: null,
      companionFileSelectionDefaults: null,
      companionFileTemplate: null,
    };

    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") return workspaceState;
      if (command === "load_project_state") return null;
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-view").textContent).toBe("active");
    });

    // Switch provider mid-chat — dialog should appear
    fireEvent.click(screen.getByRole("button", { name: "Switch provider" }));
    expect(screen.getByText(/switching providers mid-chat/i)).toBeTruthy();

    // Confirm the switch
    fireEvent.click(screen.getByRole("button", { name: "Yes, switch" }));

    // Send the next message — handoff context is prepended
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      const calls = invokeMock.mock.calls.filter((c) => c[0] === "send_message");
      expect(calls).toHaveLength(1);
      const args = calls[0][1] as Record<string, unknown>;
      expect(args.cliSessionId).toBeNull();
      expect(args.provider).toBe("codex");
      expect(typeof args.prompt).toBe("string");
      expect((args.prompt as string)).toContain("hello");
      expect((args.prompt as string)).toContain("Continue seamlessly as the assistant");
      expect((args.prompt as string)).toContain("Respond only to this new message");
    });
  });

  it("hydrates projects from persisted workspace state on startup", async () => {
    window.innerWidth = 1000;

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
          sidebarWidthRatio: 0.412,
          textZoom: {
            chatRem: 1,
            inputRem: 1.125,
            sidebarRem: 0.9375,
          },
          companionFileSelectionDefaults: ["GEMINI.md"],
          companionFileTemplate: null,
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      if (command === "list_project_files") {
        return {
          paths: [],
        };
      }
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(1);
      expect(useChatStore.getState().activeSessionId).toBe("session-2");
    });

    expect(screen.getByTestId("sidebar-width").textContent).toBe("412");
    const appShell = screen.getByTestId("sidebar-width").closest(".flex.h-screen") as HTMLElement;
    expect(appShell.style.getPropertyValue("--chat-font-size")).toBe("1rem");
    expect(appShell.style.getPropertyValue("--input-font-size")).toBe("1.125rem");
    expect(appShell.style.getPropertyValue("--sidebar-font-size")).toBe("0.9375rem");
  });

  it("updates the sidebar width while dragging the resize handle", async () => {
    window.innerWidth = 1000;

    render(<App />);

    expect(screen.getByTestId("sidebar-width").textContent).toBe("288");

    fireEvent.mouseDown(screen.getByRole("separator", { name: "Resize sidebar" }), { clientX: 288 });
    fireEvent.mouseMove(window, { clientX: 360 });

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-width").textContent).toBe("360");
    });

    fireEvent.mouseMove(window, { clientX: 800 });

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-width").textContent).toBe("750");
    });

    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: 0.75,
        textZoom: {
          chatRem: 0.9375,
          inputRem: 1.0625,
          sidebarRem: 0.875,
        },
        companionFileSelectionDefaults: ["CLAUDE.md", "AGENTS.md", "GEMINI.md"],
        companionFileTemplate: null,
      });
    });
  });

  it("keeps the same sidebar ratio when the window is resized", async () => {
    window.innerWidth = 1000;

    render(<App />);

    fireEvent.mouseDown(screen.getByRole("separator", { name: "Resize sidebar" }), { clientX: 288 });
    fireEvent.mouseMove(window, { clientX: 400 });

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-width").textContent).toBe("400");
    });

    window.innerWidth = 1500;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-width").textContent).toBe("600");
    });

    window.innerWidth = 800;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-width").textContent).toBe("320");
    });

    fireEvent.mouseUp(window);
  });

  it("loads an existing persisted project instead of creating a fresh one", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: [],
        };
      }
      if (command === "load_project_state") {
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

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("load_workspace_state");
    });

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(1);
      expect(useChatStore.getState().projects[0].sessions[0].title).toBe("Loaded chat");
      expect(useChatStore.getState().activeSessionId).toBe("session-9");
    });
  });

  it("prompts for missing companion files and creates the selected defaults before opening the project", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: ["CLAUDE.md", "AGENTS.md", "GEMINI.md"],
        };
      }
      if (command === "create_missing_companion_files") {
        return undefined;
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(await screen.findByText("Missing repo instruction files")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Create CLAUDE.md" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Create AGENTS.md" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Create GEMINI.md" }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Create GEMINI.md" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_missing_companion_files", {
        workingDir: "D:\\Projects\\Workspace",
        fileNames: ["CLAUDE.md", "AGENTS.md"],
        templateContent: expect.any(String),
      });
    });

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(1);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: expect.any(Number),
        textZoom: {
          chatRem: 0.9375,
          inputRem: 1.0625,
          sidebarRem: 0.875,
        },
        companionFileSelectionDefaults: ["CLAUDE.md", "AGENTS.md"],
        companionFileTemplate: null,
      });
    });
  });

  it("uses the remembered companion-file defaults for the next folder selection", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: ["CLAUDE.md", "AGENTS.md", "GEMINI.md"],
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(await screen.findByText("Missing repo instruction files")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Create CLAUDE.md" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Create AGENTS.md" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: expect.any(Number),
        textZoom: {
          chatRem: 0.9375,
          inputRem: 1.0625,
          sidebarRem: 0.875,
        },
        companionFileSelectionDefaults: ["GEMINI.md"],
        companionFileTemplate: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(await screen.findByText("Missing repo instruction files")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Create CLAUDE.md" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("checkbox", { name: "Create AGENTS.md" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("checkbox", { name: "Create GEMINI.md" }) as HTMLInputElement).checked).toBe(true);
  });

  it("abandons project creation when the companion-file dialog is cancelled", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: ["CLAUDE.md"],
        };
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(useChatStore.getState().projects).toHaveLength(0);
    });

    expect(invokeMock).not.toHaveBeenCalledWith(
      "create_missing_companion_files",
      expect.anything()
    );
  });

  it("opens the template editor, restores the system default, and creates files with temporary edited content", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command, args) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: ["CLAUDE.md"],
        };
      }
      if (command === "create_missing_companion_files") {
        expect(args).toEqual({
          workingDir: "D:\\Projects\\Workspace",
          fileNames: ["CLAUDE.md"],
          templateContent: "temporary template",
        });
        return undefined;
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(await screen.findByText("Missing repo instruction files")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit default content" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Companion file template" }), {
      target: { value: "temporary template" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore system default" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Companion file template" }), {
      target: { value: "temporary template" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_missing_companion_files", {
        workingDir: "D:\\Projects\\Workspace",
        fileNames: ["CLAUDE.md"],
        templateContent: "temporary template",
      });
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: expect.any(Number),
        textZoom: {
          chatRem: 0.9375,
          inputRem: 1.0625,
          sidebarRem: 0.875,
        },
        companionFileSelectionDefaults: ["CLAUDE.md"],
        companionFileTemplate: null,
      });
    });
  });

  it("remembers a custom template for future new projects when requested", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [],
          activeSessionId: null,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "check_missing_companion_files") {
        return {
          missingFiles: ["CLAUDE.md"],
        };
      }
      if (command === "create_missing_companion_files") {
        return undefined;
      }
      if (command === "load_project_state") {
        return null;
      }
      return undefined;
    });
    openMock.mockResolvedValue("D:\\Projects\\Workspace");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(await screen.findByText("Missing repo instruction files")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit default content" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Companion file template" }), {
      target: { value: "remembered template" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember edited template as default" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: expect.any(Number),
        textZoom: {
          chatRem: 0.9375,
          inputRem: 1.0625,
          sidebarRem: 0.875,
        },
        companionFileSelectionDefaults: ["CLAUDE.md"],
        companionFileTemplate: "remembered template",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(await screen.findByText("Missing repo instruction files")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit default content" }));

    expect((screen.getByRole("textbox", { name: "Companion file template" }) as HTMLTextAreaElement).value).toBe(
      "remembered template"
    );
  });

  it("zooms the chat, input, and sidebar text independently with ctrl plus wheel and persists the new sizes", async () => {
    const sessionId = crypto.randomUUID();
    const workspaceState = {
      projects: [{
        id: "project-zoom",
        title: "Alpha",
        workingDir: "D:\\Projects\\Alpha",
        collapsed: false,
        lastActiveSessionId: sessionId,
        sessions: [{
          id: sessionId,
          title: "Chat 1",
          provider: "claude" as const,
          model: "claude-sonnet-4-6",
          cliSessionId: "",
          messages: [],
          isStreaming: false,
        }],
      }],
      activeSessionId: sessionId,
      sidebarWidthRatio: null,
      textZoom: null,
      companionFileSelectionDefaults: null,
      companionFileTemplate: null,
    };
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "load_workspace_state") return workspaceState;
      if (command === "load_project_state") return null;
      if (command === "list_project_files") return { paths: [] };
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-view").textContent).toBe("active");
    });

    const appShell = screen.getByTestId("sidebar-width").closest(".flex.h-screen") as HTMLElement;

    fireEvent.wheel(screen.getByTestId("chat-view"), { ctrlKey: true, deltaY: -100 });
    await waitFor(() => {
      expect(appShell.style.getPropertyValue("--chat-font-size")).toBe("1rem");
      expect(appShell.style.getPropertyValue("--input-font-size")).toBe("1.0625rem");
      expect(appShell.style.getPropertyValue("--sidebar-font-size")).toBe("0.875rem");
    });

    fireEvent.wheel(screen.getByTestId("input-bar"), { ctrlKey: true, deltaY: 100 });
    await waitFor(() => {
      expect(appShell.style.getPropertyValue("--input-font-size")).toBe("1rem");
    });

    fireEvent.wheel(screen.getByTestId("sidebar"), { ctrlKey: true, deltaY: -100 });
    await waitFor(() => {
      expect(appShell.style.getPropertyValue("--sidebar-font-size")).toBe("0.9375rem");
    });

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: expect.any(Number),
        textZoom: {
          chatRem: 1,
          inputRem: 1,
          sidebarRem: 0.9375,
        },
        companionFileSelectionDefaults: ["CLAUDE.md", "AGENTS.md", "GEMINI.md"],
        companionFileTemplate: null,
      });
    });
  });

  it("loads relative project file paths for the active project and passes them to the input bar", async () => {
    const sessionId = crypto.randomUUID();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "load_workspace_state") {
        return {
          projects: [{
            id: "project-files",
            title: "Alpha",
            workingDir: "D:\\Projects\\Alpha",
            collapsed: false,
            lastActiveSessionId: sessionId,
            sessions: [{
              id: sessionId,
              title: "Chat 1",
              provider: "claude",
              model: "claude-sonnet-4-6",
              cliSessionId: "",
              messages: [],
              isStreaming: false,
            }],
          }],
          activeSessionId: sessionId,
          sidebarWidthRatio: null,
          textZoom: null,
          companionFileSelectionDefaults: null,
          companionFileTemplate: null,
        };
      }
      if (command === "list_project_files") {
        return {
          paths: ["README.md", "src/App.tsx"],
        };
      }
      return undefined;
    });

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_project_files", {
        workingDir: "D:\\Projects\\Alpha",
      });
    });

    expect(screen.getByTestId("project-file-count").textContent).toBe("2");
  });
});

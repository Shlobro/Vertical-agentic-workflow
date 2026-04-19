import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "./chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      projects: [],
      activeSessionId: null,
    });
  });

  it("creates a project with an initial active session", () => {
    const project = useChatStore.getState().addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    const state = useChatStore.getState();

    expect(project.title).toBe("Alpha");
    expect(project.sessions).toHaveLength(1);
    expect(state.activeSessionId).toBe(project.sessions[0].id);
    expect(project.lastActiveSessionId).toBe(project.sessions[0].id);
    expect(state.activeSession()).toMatchObject({
      id: project.sessions[0].id,
      provider: "claude",
      model: "claude-sonnet-4-6",
      messages: [],
      isStreaming: false,
      hasUnreadCompletion: false,
    });
  });

  it("adds a chat inside an existing project and activates it", () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");

    const session = store.addSession(project.id, "codex", "gpt-5.4");
    const updatedProject = useChatStore.getState().projects[0];

    expect(session?.provider).toBe("codex");
    expect(updatedProject.sessions).toHaveLength(2);
    expect(useChatStore.getState().activeSessionId).toBe(session?.id);
    expect(updatedProject.lastActiveSessionId).toBe(session?.id);
  });

  it("updates and finalizes the last assistant message", () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "codex", "gpt-5.4");
    const session = project.sessions[0];

    store.addMessage(session.id, {
      id: "user-1",
      role: "user",
      text: "Hello",
    });
    store.addMessage(session.id, {
      id: "assistant-1",
      role: "assistant",
      text: "",
      streaming: true,
    });
    store.setStreaming(session.id, true);
    store.updateLastAssistant(session.id, "Partial");
    store.finalizeAssistant(session.id, "Partial done", "thread-123");

    const updated = useChatStore.getState().projects[0].sessions[0];
    expect(updated.isStreaming).toBe(false);
    expect(updated.cliSessionId).toBe("thread-123");
    expect(updated.messages[1]).toMatchObject({
      role: "assistant",
      text: "Partial done",
      streaming: false,
    });
    expect(updated.hasUnreadCompletion).toBe(false);
  });

  it("collapsing a project clears the active selection when needed", () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");

    store.toggleProjectCollapsed(project.id);

    const state = useChatStore.getState();
    expect(state.projects[0].collapsed).toBe(true);
    expect(state.activeSessionId).toBeNull();
  });

  it("deletes a project and clears the active session when it belonged to that project", () => {
    const store = useChatStore.getState();
    const first = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    store.addProject("D:\\Projects\\Beta", "codex", "gpt-5.4");

    store.setActiveSession(first.sessions[0].id);
    store.deleteProject(first.id);

    const state = useChatStore.getState();
    expect(state.projects.map((project) => project.title)).toEqual(["Beta"]);
    expect(state.activeSessionId).toBeNull();
  });

  it("hydrates persisted workspace state", () => {
    useChatStore.getState().hydrateWorkspace({
      projects: [
        {
          id: "project-1",
          title: "Alpha",
          workingDir: "D:\\Projects\\Alpha",
          collapsed: false,
          lastActiveSessionId: "session-2",
          sessions: [
            {
              id: "session-1",
              title: "Chat 1",
              provider: "claude",
              model: "claude-sonnet-4-6",
              cliSessionId: "",
              messages: [],
              isStreaming: false,
              hasUnreadCompletion: false,
            },
            {
              id: "session-2",
              title: "Chat 2",
              provider: "codex",
              model: "gpt-5.4",
              cliSessionId: "",
              messages: [],
              isStreaming: false,
              hasUnreadCompletion: false,
            },
          ],
        },
      ],
      activeSessionId: "session-2",
      sidebarWidthRatio: null,
      textZoom: null,
      companionFileSelectionDefaults: null,
      companionFileTemplate: null,
    });

    const state = useChatStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.activeSessionId).toBe("session-2");
    expect(state.activeSession()?.title).toBe("Chat 2");
  });

  it("tracks the latest selected chat per project", () => {
    const store = useChatStore.getState();
    const first = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    const second = store.addProject("D:\\Projects\\Beta", "codex", "gpt-5.4");

    store.setActiveSession(first.sessions[0].id);

    const updatedFirst = useChatStore.getState().projects.find((project) => project.id === first.id);
    const updatedSecond = useChatStore.getState().projects.find((project) => project.id === second.id);

    expect(updatedFirst?.lastActiveSessionId).toBe(first.sessions[0].id);
    expect(updatedSecond?.lastActiveSessionId).toBe(second.sessions[0].id);
  });

  it("renames a chat with trimmed text", () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    const session = project.sessions[0];

    store.renameSession(session.id, "  Project planning  ");

    expect(useChatStore.getState().projects[0].sessions[0].title).toBe("Project planning");
  });

  it("updates session provider and model without clearing cli session id", () => {
    const store = useChatStore.getState();
    const project = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    const session = project.sessions[0];

    store.finalizeAssistant(session.id, "", "claude-session-1");
    store.updateSessionConfig(session.id, "codex", "gpt-5.4");

    expect(useChatStore.getState().projects[0].sessions[0]).toMatchObject({
      provider: "codex",
      model: "gpt-5.4",
      cliSessionId: "claude-session-1",
    });
  });

  it("marks a background chat as completed-unread until it is opened", () => {
    const store = useChatStore.getState();
    const first = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    store.addProject("D:\\Projects\\Beta", "codex", "gpt-5.4");
    const backgroundSessionId = first.sessions[0].id;

    store.finalizeAssistant(backgroundSessionId, "Done", "thread-1");

    let backgroundSession = useChatStore
      .getState()
      .projects[0]
      .sessions.find((session) => session.id === backgroundSessionId);
    expect(backgroundSession?.hasUnreadCompletion).toBe(true);

    store.setActiveSession(backgroundSessionId);

    backgroundSession = useChatStore
      .getState()
      .projects[0]
      .sessions.find((session) => session.id === backgroundSessionId);
    expect(backgroundSession?.hasUnreadCompletion).toBe(false);
  });

  it("clears any completed glow when a chat starts streaming again", () => {
    const store = useChatStore.getState();
    const first = store.addProject("D:\\Projects\\Alpha", "claude", "claude-sonnet-4-6");
    store.addProject("D:\\Projects\\Beta", "codex", "gpt-5.4");
    const sessionId = first.sessions[0].id;

    store.finalizeAssistant(sessionId, "Done", "thread-1");
    store.setStreaming(sessionId, true);

    const updated = useChatStore
      .getState()
      .projects[0]
      .sessions.find((session) => session.id === sessionId);
    expect(updated?.isStreaming).toBe(true);
    expect(updated?.hasUnreadCompletion).toBe(false);
  });
});

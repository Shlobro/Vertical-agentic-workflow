import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "./chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
    });
  });

  it("creates and activates a new session", () => {
    const session = useChatStore.getState().addSession("claude", "claude-sonnet-4-6");
    const state = useChatStore.getState();

    expect(state.activeSessionId).toBe(session.id);
    expect(state.activeSession()).toMatchObject({
      id: session.id,
      provider: "claude",
      model: "claude-sonnet-4-6",
      messages: [],
      isStreaming: false,
    });
  });

  it("updates and finalizes the last assistant message", () => {
    const store = useChatStore.getState();
    const session = store.addSession("codex", "gpt-5.4");

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

    const updated = useChatStore.getState().sessions[0];
    expect(updated.isStreaming).toBe(false);
    expect(updated.cliSessionId).toBe("thread-123");
    expect(updated.messages[1]).toMatchObject({
      role: "assistant",
      text: "Partial done",
      streaming: false,
    });
  });

  it("keeps the selected OpenAI model on a new session", () => {
    const session = useChatStore.getState().addSession("codex", "gpt-5.3-codex:xhigh");

    expect(session.model).toBe("gpt-5.3-codex:xhigh");
  });

  it("renames a session with trimmed text", () => {
    const store = useChatStore.getState();
    const session = store.addSession("claude", "claude-sonnet-4-6");

    store.renameSession(session.id, "  Project planning  ");

    expect(useChatStore.getState().sessions[0].title).toBe("Project planning");
  });

  it("deletes the active session and selects the next available one", () => {
    const store = useChatStore.getState();
    const first = store.addSession("claude", "claude-sonnet-4-6");
    const second = store.addSession("codex", "gpt-5.4");
    const third = store.addSession("claude", "claude-opus-4-7");

    store.setActiveSession(second.id);
    store.deleteSession(second.id);

    const state = useChatStore.getState();
    expect(state.sessions.map((session) => session.id)).toEqual([first.id, third.id]);
    expect(state.activeSessionId).toBe(third.id);
  });
});

import { create } from "zustand";
import { ChatSession, Message, Provider } from "../types";

let sessionCounter = 1;

interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  addSession: (provider: Provider, model: string) => ChatSession;
  setActiveSession: (id: string) => void;
  activeSession: () => ChatSession | null;
  addMessage: (sessionId: string, msg: Message) => void;
  updateLastAssistant: (sessionId: string, text: string) => void;
  finalizeAssistant: (sessionId: string, text: string, cliSessionId: string) => void;
  setStreaming: (sessionId: string, streaming: boolean) => void;
  updateSessionTitle: (sessionId: string) => void;
  setWorkingDir: (sessionId: string, dir: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  addSession(provider, model) {
    const sess: ChatSession = {
      id: crypto.randomUUID(),
      title: `Chat ${sessionCounter++}`,
      provider,
      model,
      cliSessionId: "",
      messages: [],
      isStreaming: false,
      workingDir: "",
    };
    set((s) => ({ sessions: [...s.sessions, sess], activeSessionId: sess.id }));
    return sess;
  },

  setActiveSession(id) {
    set({ activeSessionId: id });
  },

  activeSession() {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },

  addMessage(sessionId, msg) {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, messages: [...sess.messages, msg] }
          : sess
      ),
    }));
  },

  updateLastAssistant(sessionId, text) {
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const msgs = [...sess.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, text };
        }
        return { ...sess, messages: msgs };
      }),
    }));
  },

  finalizeAssistant(sessionId, text, cliSessionId) {
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const msgs = [...sess.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, text, streaming: false };
        }
        return { ...sess, messages: msgs, isStreaming: false, cliSessionId: cliSessionId || sess.cliSessionId };
      }),
    }));
  },

  setStreaming(sessionId, streaming) {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, isStreaming: streaming } : sess
      ),
    }));
  },

  setWorkingDir(sessionId, dir) {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, workingDir: dir } : sess
      ),
    }));
  },

  updateSessionTitle(sessionId) {
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const firstUser = sess.messages.find((m) => m.role === "user");
        if (!firstUser) return sess;
        const title = firstUser.text.trim().slice(0, 40) || sess.title;
        return { ...sess, title };
      }),
    }));
  },
}));

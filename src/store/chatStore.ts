import { create } from "zustand";
import { ChatProject, ChatSession, Message, Provider } from "../types";

let sessionCounter = 1;

function createSession(provider: Provider, model: string): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: `Chat ${sessionCounter++}`,
    provider,
    model,
    cliSessionId: "",
    messages: [],
    isStreaming: false,
  };
}

interface ChatStore {
  projects: ChatProject[];
  activeSessionId: string | null;
  addProject: (workingDir: string, provider: Provider, model: string) => ChatProject;
  renameProject: (projectId: string, title: string) => void;
  deleteProject: (projectId: string) => void;
  toggleProjectCollapsed: (projectId: string) => void;
  addSession: (projectId: string, provider: Provider, model: string) => ChatSession | null;
  setActiveSession: (id: string | null) => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  updateSessionConfig: (id: string, provider: Provider, model: string) => void;
  activeSession: () => ChatSession | null;
  findProjectBySessionId: (sessionId: string | null) => ChatProject | null;
  addMessage: (sessionId: string, msg: Message) => void;
  updateLastAssistant: (sessionId: string, text: string) => void;
  finalizeAssistant: (sessionId: string, text: string, cliSessionId: string) => void;
  setStreaming: (sessionId: string, streaming: boolean) => void;
  updateSessionTitle: (sessionId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  projects: [],
  activeSessionId: null,

  addProject(workingDir, provider, model) {
    const title = workingDir.split(/[\\/]/).filter(Boolean).pop() || "New Project";
    const session = createSession(provider, model);
    const project: ChatProject = {
      id: crypto.randomUUID(),
      title,
      workingDir,
      collapsed: false,
      sessions: [session],
    };

    set((state) => ({
      projects: [...state.projects, project],
      activeSessionId: session.id,
    }));

    return project;
  },

  renameProject(projectId, title) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, title: trimmedTitle } : project
      ),
    }));
  },

  deleteProject(projectId) {
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) return state;

      const sessionIds = new Set(project.sessions.map((session) => session.id));
      return {
        projects: state.projects.filter((item) => item.id !== projectId),
        activeSessionId: sessionIds.has(state.activeSessionId ?? "") ? null : state.activeSessionId,
      };
    });
  },

  toggleProjectCollapsed(projectId) {
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) return state;

      const nextCollapsed = !project.collapsed;
      const activeInProject = project.sessions.some((session) => session.id === state.activeSessionId);

      return {
        projects: state.projects.map((item) =>
          item.id === projectId ? { ...item, collapsed: nextCollapsed } : item
        ),
        activeSessionId: nextCollapsed && activeInProject ? null : state.activeSessionId,
      };
    });
  },

  addSession(projectId, provider, model) {
    const session = createSession(provider, model);
    let created = false;

    set((state) => ({
      projects: state.projects.map((project) => {
        if (project.id !== projectId) return project;
        created = true;
        return {
          ...project,
          collapsed: false,
          sessions: [...project.sessions, session],
        };
      }),
      activeSessionId: created ? session.id : state.activeSessionId,
    }));

    return created ? session : null;
  },

  setActiveSession(id) {
    set({ activeSessionId: id });
  },

  renameSession(id, title) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === id ? { ...session, title: trimmedTitle } : session
        ),
      })),
    }));
  },

  deleteSession(id) {
    set((state) => {
      let nextActiveSessionId = state.activeSessionId;

      const projects = state.projects.map((project) => {
        const index = project.sessions.findIndex((session) => session.id === id);
        if (index === -1) return project;

        const sessions = project.sessions.filter((session) => session.id !== id);
        if (state.activeSessionId === id) {
          nextActiveSessionId = sessions[index]?.id ?? sessions[index - 1]?.id ?? null;
        }

        return { ...project, sessions };
      });

      return {
        projects,
        activeSessionId: nextActiveSessionId,
      };
    });
  },

  updateSessionConfig(id, provider, model) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === id
            ? {
                ...session,
                provider,
                model,
                cliSessionId:
                  session.provider === provider && session.model === model ? session.cliSessionId : "",
              }
            : session
        ),
      })),
    }));
  },

  activeSession() {
    const { projects, activeSessionId } = get();
    for (const project of projects) {
      const session = project.sessions.find((item) => item.id === activeSessionId);
      if (session) return session;
    }
    return null;
  },

  findProjectBySessionId(sessionId) {
    if (!sessionId) return null;
    return get().projects.find((project) =>
      project.sessions.some((session) => session.id === sessionId)
    ) ?? null;
  },

  addMessage(sessionId, msg) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, messages: [...session.messages, msg] }
            : session
        ),
      })),
    }));
  },

  updateLastAssistant(sessionId, text) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          const messages = [...session.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant") {
            messages[messages.length - 1] = { ...lastMessage, text };
          }
          return { ...session, messages };
        }),
      })),
    }));
  },

  finalizeAssistant(sessionId, text, cliSessionId) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          const messages = [...session.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant") {
            messages[messages.length - 1] = { ...lastMessage, text, streaming: false };
          }
          return {
            ...session,
            messages,
            isStreaming: false,
            cliSessionId: cliSessionId || session.cliSessionId,
          };
        }),
      })),
    }));
  },

  setStreaming(sessionId, streaming) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === sessionId ? { ...session, isStreaming: streaming } : session
        ),
      })),
    }));
  },

  updateSessionTitle(sessionId) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          const firstUser = session.messages.find((message) => message.role === "user");
          if (!firstUser) return session;
          const title = firstUser.text.trim().slice(0, 40) || session.title;
          return { ...session, title };
        }),
      })),
    }));
  },
}));

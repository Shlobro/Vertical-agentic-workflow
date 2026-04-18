import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useChatStore } from "./store/chatStore";
import {
  ChatProject,
  MessageDoneEvent,
  MessageErrorEvent,
  PersistedWorkspaceState,
  Provider,
  StreamChunkEvent,
  MODELS,
} from "./types";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import ConfirmDialog from "./components/ConfirmDialog";
import InputBar from "./components/InputBar";

type PendingDelete =
  | { kind: "project"; id: string }
  | { kind: "session"; id: string }
  | null;

export default function App() {
  const store = useChatStore();
  const activeSession = store.activeSession();
  const activeProject = store.findProjectBySessionId(store.activeSessionId);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const hydrationCompleteRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<Provider>("claude");
  const [defaultModel, setDefaultModel] = useState(MODELS.claude[0].id);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  function handleProviderChange(nextProvider: Provider) {
    const nextModel = MODELS[nextProvider][0].id;
    setDefaultProvider(nextProvider);
    setDefaultModel(nextModel);
    if (activeSession) {
      store.updateSessionConfig(activeSession.id, nextProvider, nextModel);
    }
  }

  function handleModelChange(nextModel: string) {
    setDefaultModel(nextModel);
    if (activeSession) {
      store.updateSessionConfig(activeSession.id, activeSession.provider, nextModel);
    }
  }

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const state = await invoke<PersistedWorkspaceState>("load_workspace_state");
        store.hydrateWorkspace(state);
      } catch (error) {
        console.error("Failed to load persisted workspace state", error);
      } finally {
        hydrationCompleteRef.current = true;
      }
    };

    void loadWorkspace();
  }, []);

  useEffect(() => {
    const setup = async () => {
      const u1 = await listen<StreamChunkEvent>("stream-chunk", ({ payload }) => {
        store.updateLastAssistant(payload.session_uuid, payload.text);
      });
      const u2 = await listen<MessageDoneEvent>("message-done", ({ payload }) => {
        store.finalizeAssistant(payload.session_uuid, payload.full_text, payload.cli_session_id);
        store.updateSessionTitle(payload.session_uuid);
      });
      const u3 = await listen<MessageErrorEvent>("message-error", ({ payload }) => {
        const errorText = payload.partial_text
          ? `${payload.partial_text}\n\nError: ${payload.error}`
          : `Error: ${payload.error}`;
        store.finalizeAssistant(payload.session_uuid, errorText, "");
      });
      unlistenRef.current = [u1, u2, u3];
    };

    setup().catch((error) => {
      console.error("Failed to bind Tauri event listeners", error);
    });

    return () => {
      unlistenRef.current.forEach((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unsubscribe = useChatStore.subscribe((state, previousState) => {
      if (!hydrationCompleteRef.current) return;
      if (state.projects === previousState.projects && state.activeSessionId === previousState.activeSessionId) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        invoke("save_workspace_state", {
          projects: useChatStore.getState().projects,
          activeSessionId: useChatStore.getState().activeSessionId,
        }).catch((error) => {
          console.error("Failed to save workspace state", error);
        });
      }, 150);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  async function handleNewProject() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        const existingProject = store.findProjectByWorkingDir(selected);
        if (existingProject) {
          store.setActiveSession(existingProject.lastActiveSessionId ?? existingProject.sessions[0]?.id ?? null);
          return;
        }

        const persistedProject = await invoke<ChatProject | null>("load_project_state", {
          workingDir: selected,
        });
        if (persistedProject) {
          store.upsertProject(persistedProject);
          return;
        }

        store.addProject(selected, defaultProvider, defaultModel);
      }
    } catch (error) {
      console.error("Failed to open project directory picker", error);
    }
  }

  function handleNewChat(projectId: string) {
    store.addSession(projectId, defaultProvider, defaultModel);
  }

  function handleDeleteProject(projectId: string) {
    setPendingDelete({ kind: "project", id: projectId });
  }

  function handleDeleteChat(sessionId: string) {
    setPendingDelete({ kind: "session", id: sessionId });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.kind === "project") {
      const project = store.projects.find((item) => item.id === pendingDelete.id);
      if (!project) {
        setPendingDelete(null);
        return;
      }

      try {
        await invoke("delete_project_state", { workingDir: project.workingDir });
      } catch (error) {
        console.error("Failed to delete project storage", error);
        return;
      }

      store.deleteProject(pendingDelete.id);
    } else {
      store.deleteSession(pendingDelete.id);
    }
    setPendingDelete(null);
  }

  function handleCancelDelete() {
    setPendingDelete(null);
  }

  async function handleSend(text: string) {
    const session = store.activeSession();
    const project = store.findProjectBySessionId(store.activeSessionId);
    if (!session || !project) return;

    store.addMessage(session.id, {
      id: crypto.randomUUID(),
      role: "user",
      text,
    });

    store.addMessage(session.id, {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "",
      streaming: true,
    });
    store.setStreaming(session.id, true);

    try {
      await invoke("send_message", {
        sessionUuid: session.id,
        provider: session.provider,
        model: session.model,
        prompt: text,
        cliSessionId: session.cliSessionId || null,
        workingDir: project.workingDir,
      });
    } catch (error) {
      store.finalizeAssistant(session.id, `Error: ${formatError(error)}`, "");
    }
  }

  async function handleCancel() {
    const session = store.activeSession();
    if (!session?.isStreaming) return;

    try {
      await invoke("cancel_message", { sessionUuid: session.id });
    } catch (error) {
      store.finalizeAssistant(session.id, `Error: ${formatError(error)}`, "");
    }
  }

  const pendingDeleteProject =
    pendingDelete?.kind === "project"
      ? store.projects.find((project) => project.id === pendingDelete.id) ?? null
      : null;

  const pendingDeleteSession =
    pendingDelete?.kind === "session"
      ? store.findProjectBySessionId(pendingDelete.id)?.sessions.find((session) => session.id === pendingDelete.id) ??
        null
      : null;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary text-text-primary">
      <Sidebar
        projects={store.projects}
        activeSessionId={store.activeSessionId}
        onNewProject={handleNewProject}
        onNewChat={handleNewChat}
        onToggleProject={store.toggleProjectCollapsed}
        onSelectSession={store.setActiveSession}
        onRenameProject={store.renameProject}
        onDeleteProject={handleDeleteProject}
        onRenameSession={store.renameSession}
        onDeleteSession={handleDeleteChat}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatView session={activeSession} />
        {activeSession && activeProject && (
          <InputBar
            streaming={activeSession.isStreaming}
            provider={activeSession.provider}
            model={activeSession.model}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onSend={handleSend}
            onCancel={handleCancel}
          />
        )}
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDeleteProject ? "Delete project?" : "Delete chat?"}
        description={
          pendingDeleteProject
            ? `This will permanently remove "${pendingDeleteProject.title}" and all chats inside it.`
            : pendingDeleteSession
              ? `This will permanently remove "${pendingDeleteSession.title}" from the project.`
              : ""
        }
        confirmLabel={pendingDeleteProject ? "Delete project" : "Delete chat"}
        cancelLabel={pendingDeleteProject ? "Keep project" : "Keep chat"}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

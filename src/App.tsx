import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useChatStore } from "./store/chatStore";
import { MessageDoneEvent, MessageErrorEvent, Provider, StreamChunkEvent, MODELS } from "./types";
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
  const [provider, setProvider] = useState<Provider>("claude");
  const [model, setModel] = useState(MODELS.claude[0].id);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  function handleProviderChange(nextProvider: Provider) {
    setProvider(nextProvider);
    setModel(MODELS[nextProvider][0].id);
  }

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

  async function handleNewProject() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        store.addProject(selected, provider, model);
      }
    } catch (error) {
      console.error("Failed to open project directory picker", error);
    }
  }

  function handleNewChat(projectId: string) {
    store.addSession(projectId, provider, model);
  }

  function handleDeleteProject(projectId: string) {
    setPendingDelete({ kind: "project", id: projectId });
  }

  function handleDeleteChat(sessionId: string) {
    setPendingDelete({ kind: "session", id: sessionId });
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.kind === "project") {
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
            provider={provider}
            model={model}
            onProviderChange={handleProviderChange}
            onModelChange={setModel}
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

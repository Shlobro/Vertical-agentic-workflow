import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open, message } from "@tauri-apps/plugin-dialog";
import { appLocalDataDir } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";
import { useChatStore } from "./store/chatStore";
import { MessageDoneEvent, MessageErrorEvent, Provider, StreamChunkEvent, MODELS } from "./types";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import InputBar from "./components/InputBar";

export default function App() {
  const store = useChatStore();
  const activeSession = store.activeSession();
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const [provider, setProvider] = useState<Provider>("claude");
  const [model, setModel] = useState(MODELS.claude[0].id);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setModel(MODELS[p][0].id);
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
    return () => { unlistenRef.current.forEach((u) => u()); };
  }, []);

  function handleNewChat() {
    store.addSession(provider, model);
  }

  async function resolveWorkingDir(sess: ReturnType<typeof store.activeSession> & object): Promise<string> {
    if (sess.workingDir) return sess.workingDir;

    await message(
      "No working directory selected for this chat. The agent will run in the default folder.",
      { title: "No Working Directory", kind: "warning" }
    );

    const dataDir = await appLocalDataDir();
    const defaultDir = `${dataDir}default`;
    try {
      await mkdir(defaultDir, { recursive: true });
    } catch {
      // already exists
    }
    store.setWorkingDir(sess.id, defaultDir);
    return defaultDir;
  }

  async function handleSend(text: string) {
    let sess = store.activeSession();
    if (!sess) sess = store.addSession(provider, model);

    const workingDir = await resolveWorkingDir(sess);

    store.addMessage(sess.id, {
      id: crypto.randomUUID(),
      role: "user",
      text,
    });

    store.addMessage(sess.id, {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "",
      streaming: true,
    });
    store.setStreaming(sess.id, true);

    try {
      await invoke("send_message", {
        sessionUuid: sess.id,
        provider: sess.provider,
        model: sess.model,
        prompt: text,
        cliSessionId: sess.cliSessionId || null,
        workingDir,
      });
    } catch (e) {
      store.finalizeAssistant(sess.id, `Error: ${formatError(e)}`, "");
    }
  }

  async function handleCancel() {
    const sess = store.activeSession();
    if (!sess?.isStreaming) return;

    try {
      await invoke("cancel_message", { sessionUuid: sess.id });
    } catch (e) {
      store.finalizeAssistant(sess.id, `Error: ${formatError(e)}`, "");
    }
  }

  async function handlePickWorkingDir() {
    const sess = store.activeSession() ?? store.addSession(provider, model);

    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        store.setWorkingDir(sess.id, selected);
      }
    } catch (error) {
      console.error("Failed to open working directory picker", error);
    }
  }

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden">
      <Sidebar
        sessions={store.sessions}
        activeSessionId={store.activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={store.setActiveSession}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <ChatView session={activeSession} />
        <InputBar
          streaming={activeSession?.isStreaming ?? false}
          provider={provider}
          model={model}
          workingDir={activeSession?.workingDir ?? ""}
          onProviderChange={handleProviderChange}
          onModelChange={setModel}
          onSend={handleSend}
          onCancel={handleCancel}
          onPickWorkingDir={handlePickWorkingDir}
        />
      </div>
    </div>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

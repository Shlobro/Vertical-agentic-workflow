import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useChatStore } from "./store/chatStore";
import { Provider } from "./types";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import InputBar from "./components/InputBar";

interface StreamChunk { session_uuid: string; text: string; }
interface MessageDone { session_uuid: string; full_text: string; cli_session_id: string; }
interface MessageError { session_uuid: string; error: string; }

export default function App() {
  const store = useChatStore();
  const activeSession = store.activeSession();
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setup = async () => {
      const u1 = await listen<StreamChunk>("stream-chunk", ({ payload }) => {
        store.updateLastAssistant(payload.session_uuid, payload.text);
      });
      const u2 = await listen<MessageDone>("message-done", ({ payload }) => {
        store.finalizeAssistant(payload.session_uuid, payload.full_text, payload.cli_session_id);
        store.updateSessionTitle(payload.session_uuid);
      });
      const u3 = await listen<MessageError>("message-error", ({ payload }) => {
        store.finalizeAssistant(payload.session_uuid, `Error: ${payload.error}`, "");
      });
      unlistenRef.current = [u1, u2, u3];
    };
    setup();
    return () => { unlistenRef.current.forEach((u) => u()); };
  }, []);

  function handleNewChat(provider: Provider, model: string) {
    store.addSession(provider, model);
  }

  async function handleSend(text: string) {
    const sess = store.activeSession();
    if (!sess) return;

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
      });
    } catch (e) {
      store.finalizeAssistant(sess.id, `Error: ${e}`, "");
    }
  }

  function handleCancel() {
    // TODO: implement via cancel_message Tauri command
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
          disabled={!activeSession}
          streaming={activeSession?.isStreaming ?? false}
          onSend={handleSend}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

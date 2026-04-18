import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Ellipsis, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { ChatSession } from "../types";

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void | Promise<void>;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingSessionId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingSessionId]);

  function startRename(session: ChatSession) {
    setOpenMenuId(null);
    setEditingSessionId(session.id);
    setDraftTitle(session.title);
  }

  function submitRename() {
    if (!editingSessionId) return;

    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDraftTitle("");
      setEditingSessionId(null);
      return;
    }

    onRenameSession(editingSessionId, trimmedTitle);
    setEditingSessionId(null);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitRename();
      return;
    }

    if (event.key === "Escape") {
      setEditingSessionId(null);
      setDraftTitle("");
    }
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitRename();
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-bg-sidebar border-r border-border h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">Vertical</h1>
        <p className="text-xs text-text-muted mt-0.5">CLI Chat Interface</p>
      </div>

      <div className="px-3 pb-3 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No chats yet</p>
        )}
        {[...sessions].reverse().map((sess) => (
          <div
            key={sess.id}
            className={`group rounded-lg text-sm transition-colors ${
              sess.id === activeSessionId
                ? "bg-blue-600/20 text-blue-400"
                : "text-text-muted hover:text-text-primary hover:bg-surface"
            }`}
          >
            <div className="flex items-center gap-1">
              {editingSessionId === sess.id ? (
                <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0 pl-3 py-1.5">
                  <label className="sr-only" htmlFor={`rename-${sess.id}`}>
                    Rename chat
                  </label>
                  <input
                    id={`rename-${sess.id}`}
                    ref={renameInputRef}
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={submitRename}
                    onKeyDown={handleRenameKeyDown}
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary outline-none focus:border-blue-400"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectSession(sess.id)}
                  className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 text-left"
                >
                  <MessageSquare size={13} className="flex-shrink-0" />
                  <span className="truncate flex-1">{sess.title}</span>
                  {sess.isStreaming && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
                  )}
                </button>
              )}

              <div className="relative pr-1">
                <button
                  type="button"
                  aria-label={`Open actions for ${sess.title}`}
                  onClick={() => setOpenMenuId((current) => (current === sess.id ? null : sess.id))}
                  className={`rounded-md p-1.5 transition-colors ${
                    openMenuId === sess.id
                      ? "bg-surface text-text-primary"
                      : "text-text-muted hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  <Ellipsis size={14} />
                </button>

                {openMenuId === sess.id && (
                  <div className="absolute right-1 top-10 z-10 min-w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => startRename(sess)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-text-primary hover:bg-surface-hover"
                    >
                      <Pencil size={14} />
                      Rename chat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        void onDeleteSession(sess.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-red-300 hover:bg-surface-hover"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

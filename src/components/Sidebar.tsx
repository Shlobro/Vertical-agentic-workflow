import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Ellipsis,
  Folder,
  MessageCirclePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ChatProject, ChatSession } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  projects: ChatProject[];
  activeSessionId: string | null;
  onNewProject: () => void | Promise<void>;
  onNewChat: (projectId: string) => void;
  onToggleProject: (projectId: string) => void;
  onSelectSession: (id: string) => void;
  onRenameProject: (projectId: string, title: string) => void;
  onDeleteProject: (projectId: string) => void | Promise<void>;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void | Promise<void>;
}

export default function Sidebar({
  projects,
  activeSessionId,
  onNewProject,
  onNewChat,
  onToggleProject,
  onSelectSession,
  onRenameProject,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<
    { kind: "project"; id: string } | { kind: "session"; id: string } | null
  >(null);
  const [draftTitle, setDraftTitle] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingItem) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingItem]);

  function startRenameProject(project: ChatProject) {
    setOpenMenuId(null);
    setEditingItem({ kind: "project", id: project.id });
    setDraftTitle(project.title);
  }

  function startRenameSession(session: ChatSession) {
    setOpenMenuId(null);
    setEditingItem({ kind: "session", id: session.id });
    setDraftTitle(session.title);
  }

  function submitRename() {
    if (!editingItem) return;

    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDraftTitle("");
      setEditingItem(null);
      return;
    }

    if (editingItem.kind === "project") {
      onRenameProject(editingItem.id, trimmedTitle);
    } else {
      onRenameSession(editingItem.id, trimmedTitle);
    }
    setEditingItem(null);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitRename();
      return;
    }

    if (event.key === "Escape") {
      setEditingItem(null);
      setDraftTitle("");
    }
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitRename();
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-bg-sidebar border-r border-border h-full">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">Vertical</h1>
        <p className="text-xs text-text-muted mt-0.5">CLI Chat Interface</p>
      </div>

      <div className="px-3 pb-3 border-b border-border">
        <button
          onClick={() => void onNewProject()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {projects.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No projects yet</p>
        )}

        {[...projects].reverse().map((project) => {
          const editingProject = editingItem?.kind === "project" && editingItem.id === project.id;

          return (
            <div key={project.id} className="rounded-xl border border-transparent bg-transparent">
              <div className="group rounded-lg px-1 py-1 text-sm text-text-muted hover:bg-surface">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={project.collapsed ? `Expand ${project.title}` : `Collapse ${project.title}`}
                    onClick={() => onToggleProject(project.id)}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  >
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${project.collapsed ? "" : "rotate-90"}`}
                    />
                  </button>

                  <Folder size={15} className="flex-shrink-0 text-blue-300" />

                  {editingProject ? (
                    <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0">
                      <label className="sr-only" htmlFor={`rename-project-${project.id}`}>
                        Rename project
                      </label>
                      <input
                        id={`rename-project-${project.id}`}
                        ref={renameInputRef}
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onBlur={submitRename}
                        onKeyDown={handleRenameKeyDown}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary outline-none focus:border-blue-400"
                      />
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-primary">{project.title}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label={`New chat in ${project.title}`}
                    onClick={() => onNewChat(project.id)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  >
                    <MessageCirclePlus size={14} />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Open actions for project ${project.title}`}
                      onClick={() => setOpenMenuId((current) => (current === project.id ? null : project.id))}
                      className={`rounded-md p-1.5 transition-colors ${
                        openMenuId === project.id
                          ? "bg-surface text-text-primary"
                          : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                      }`}
                    >
                      <Ellipsis size={14} />
                    </button>

                    {openMenuId === project.id && (
                      <div className="absolute right-0 top-10 z-10 min-w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => startRenameProject(project)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-text-primary hover:bg-surface-hover"
                        >
                          <Pencil size={14} />
                          Rename project
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            void onDeleteProject(project.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-red-300 hover:bg-surface-hover"
                        >
                          <Trash2 size={14} />
                          Delete project
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!project.collapsed && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {project.sessions.length === 0 && (
                    <p className="px-3 py-2 text-xs text-text-muted">No chats yet</p>
                  )}

                  {[...project.sessions].reverse().map((session) => {
                    const editingSession =
                      editingItem?.kind === "session" && editingItem.id === session.id;

                    return (
                      <div
                        key={session.id}
                        className={`group rounded-lg text-sm transition-colors ${
                          session.id === activeSessionId
                            ? "bg-blue-600/20 text-blue-400"
                            : "text-text-muted hover:text-text-primary hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {editingSession ? (
                            <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0 pl-3 py-1.5">
                              <label className="sr-only" htmlFor={`rename-session-${session.id}`}>
                                Rename chat
                              </label>
                              <input
                                id={`rename-session-${session.id}`}
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
                              onClick={() => onSelectSession(session.id)}
                              className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 text-left"
                            >
                              <img
                                src={PROVIDER_ICONS[session.provider]}
                                alt={`${session.provider} provider`}
                                className="h-[13px] w-[13px] flex-shrink-0 object-contain opacity-85"
                              />
                              <span className="truncate flex-1">{session.title}</span>
                              {session.isStreaming && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
                              )}
                            </button>
                          )}

                          <div className="relative pr-1">
                            <button
                              type="button"
                              aria-label={`Open actions for ${session.title}`}
                              onClick={() =>
                                setOpenMenuId((current) => (current === session.id ? null : session.id))
                              }
                              className={`rounded-md p-1.5 transition-colors ${
                                openMenuId === session.id
                                  ? "bg-surface text-text-primary"
                                  : "text-text-muted hover:bg-surface hover:text-text-primary"
                              }`}
                            >
                              <Ellipsis size={14} />
                            </button>

                            {openMenuId === session.id && (
                              <div className="absolute right-1 top-10 z-10 min-w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => startRenameSession(session)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-text-primary hover:bg-surface-hover"
                                >
                                  <Pencil size={14} />
                                  Rename chat
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    void onDeleteSession(session.id);
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
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

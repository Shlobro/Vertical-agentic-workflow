import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Ellipsis,
  Folder,
  MessageCirclePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ChatProject, ChatSession } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  width: number;
  isResizing: boolean;
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
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
  onSearchSelectSession: (sessionId: string, messageId: string | null, query: string) => void;
  onSearchClear: () => void;
  onSearchQueryChange: (query: string, scopeContents: boolean) => void;
}

interface SearchScope {
  projectNames: boolean;
  chatNames: boolean;
  chatContents: boolean;
}

interface FilteredSession {
  session: ChatSession;
  lastMatchingMessageId: string | null;
}

interface FilteredProject {
  project: ChatProject;
  sessions: FilteredSession[];
  projectMatches: boolean;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function isScopeEmpty(scope: SearchScope) {
  return !scope.projectNames && !scope.chatNames && !scope.chatContents;
}

function filterProjects(projects: ChatProject[], query: string, scope: SearchScope): FilteredProject[] {
  const q = query.trim().toLowerCase();
  const effective = scope;

  if (!q) {
    return projects.map((p) => ({
      project: p,
      sessions: p.sessions.map((s) => ({ session: s, lastMatchingMessageId: null })),
      projectMatches: false,
    }));
  }

  return projects
    .map((project): FilteredProject | null => {
      const projectMatches = effective.projectNames && project.title.toLowerCase().includes(q);

      const matchedSessions: FilteredSession[] = project.sessions
        .map((session): FilteredSession | null => {
          const titleMatches = effective.chatNames && session.title.toLowerCase().includes(q);
          const matchingMessages = effective.chatContents
            ? session.messages.filter((m) => m.text.toLowerCase().includes(q))
            : [];
          const lastMatchingMessageId =
            matchingMessages.length > 0 ? matchingMessages[matchingMessages.length - 1].id : null;

          if (titleMatches || lastMatchingMessageId) {
            return { session, lastMatchingMessageId: titleMatches ? null : lastMatchingMessageId };
          }
          return null;
        })
        .filter((s): s is FilteredSession => s !== null);

      if (projectMatches) {
        return {
          project,
          sessions: project.sessions.map((s) => ({ session: s, lastMatchingMessageId: null })),
          projectMatches: true,
        };
      }

      if (matchedSessions.length > 0) {
        return { project, sessions: matchedSessions, projectMatches: false };
      }

      return null;
    })
    .filter((p): p is FilteredProject => p !== null);
}

export default function Sidebar({
  width,
  isResizing,
  onResizeStart,
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
  onSearchSelectSession,
  onSearchClear,
  onSearchQueryChange,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>({
    projectNames: true,
    chatNames: true,
    chatContents: false,
  });
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openMenuId && !searchMenuOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
      if (searchMenuRef.current && !searchMenuRef.current.contains(event.target as Node)) {
        setSearchMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId, searchMenuOpen]);

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

  function toggleScopeKey(key: keyof SearchScope) {
    setSearchScope((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (searchQuery) onSearchQueryChange(searchQuery, next.chatContents);
      return next;
    });
  }

  const scopeEmpty = isScopeEmpty(searchScope);
  const isSearching = !scopeEmpty && searchQuery.trim().length > 0;
  const filteredProjects = filterProjects(projects, searchQuery, searchScope);

  function handleSessionClick(sessionId: string, lastMatchingMessageId: string | null) {
    if (isSearching && lastMatchingMessageId) {
      onSearchSelectSession(sessionId, lastMatchingMessageId, searchQuery);
    } else {
      onSelectSession(sessionId);
    }
  }

  return (
    <div
      className="relative flex h-full flex-shrink-0 flex-col border-r border-border bg-bg-sidebar"
      style={{ width }}
    >
      <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        onMouseDown={onResizeStart}
        className="group absolute -right-2 top-0 z-20 h-full w-4 cursor-col-resize"
      >
        <div
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
            isResizing ? "bg-blue-400/80" : "bg-transparent group-hover:bg-blue-400/50"
          }`}
        />
      </div>

      <div className="px-3 pt-5 pb-3 border-b border-border space-y-2">
        <button
          onClick={() => void onNewProject()}
          className="sidebar-font-base w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          <Plus size={15} />
          New Project
        </button>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const next = e.target.value;
                setSearchQuery(next);
                if (!next) onSearchClear();
                else onSearchQueryChange(next, searchScope.chatContents);
              }}
              placeholder={scopeEmpty ? "No scope selected" : "Search…"}
              aria-label="Search projects and chats"
              disabled={scopeEmpty}
              className={`sidebar-font-small w-full rounded-lg border border-border bg-surface pl-7 pr-7 py-1.5 placeholder:text-text-muted outline-none transition-colors ${
                scopeEmpty
                  ? "opacity-40 cursor-not-allowed text-text-muted"
                  : "text-text-primary focus:border-blue-400"
              }`}
            />
            {isSearching && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearchQuery(""); onSearchClear(); searchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="relative" ref={searchMenuRef}>
            <button
              type="button"
              aria-label="Search options"
              onClick={() => setSearchMenuOpen((o) => !o)}
              className={`rounded-md p-1.5 transition-colors ${
                searchMenuOpen
                  ? "bg-surface text-text-primary"
                  : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
              }`}
            >
              <Ellipsis size={14} />
            </button>

            {searchMenuOpen && (
              <div className="absolute right-0 top-10 z-10 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg">
                {(
                  [
                    { key: "projectNames", label: "Project names" },
                    { key: "chatNames", label: "Chat names" },
                    { key: "chatContents", label: "Chat contents" },
                  ] as { key: keyof SearchScope; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleScopeKey(key)}
                    className="sidebar-font-base flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-text-primary hover:bg-surface-hover"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border transition-colors ${
                        searchScope[key]
                          ? "border-blue-500 bg-blue-500"
                          : "border-border bg-transparent"
                      }`}
                    >
                      {searchScope[key] && (
                        <svg viewBox="0 0 10 8" className="h-2 w-2 fill-white" aria-hidden="true">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {filteredProjects.length === 0 && (
          <p className="sidebar-font-small text-text-muted text-center py-4">
            {isSearching ? "No results" : "No projects yet"}
          </p>
        )}

        {[...filteredProjects].reverse().map(({ project, sessions: filteredSessions, projectMatches }) => {
          const editingProject = editingItem?.kind === "project" && editingItem.id === project.id;
          const isExpanded = isSearching ? true : !project.collapsed;

          return (
            <div key={project.id} className="rounded-xl border border-transparent bg-transparent">
              <div className="sidebar-font-base group rounded-lg px-1 py-1 text-text-muted hover:bg-surface">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={project.collapsed ? `Expand ${project.title}` : `Collapse ${project.title}`}
                    onClick={() => !isSearching && onToggleProject(project.id)}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  >
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
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
                        className="sidebar-font-base w-full rounded-md border border-border bg-surface px-2 py-1 text-text-primary outline-none focus:border-blue-400"
                      />
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-primary">
                        {isSearching && searchScope.projectNames
                          ? highlightText(project.title, searchQuery)
                          : project.title}
                      </p>
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
                      <div ref={menuRef} className="absolute right-0 top-10 z-10 min-w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
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

              {isExpanded && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {filteredSessions.length === 0 && projectMatches && project.sessions.length === 0 && (
                    <p className="sidebar-font-small px-3 py-2 text-text-muted">No chats yet</p>
                  )}
                  {filteredSessions.length === 0 && !isSearching && (
                    <p className="sidebar-font-small px-3 py-2 text-text-muted">No chats yet</p>
                  )}

                  {filteredSessions.map(({ session, lastMatchingMessageId }) => {
                    const editingSession =
                      editingItem?.kind === "session" && editingItem.id === session.id;
                    const titleMatches = isSearching && searchScope.chatNames && session.title.toLowerCase().includes(searchQuery.trim().toLowerCase());

                    return (
                      <div
                        key={session.id}
                        className={`sidebar-font-base group rounded-lg transition-colors ${
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
                                className="sidebar-font-base w-full rounded-md border border-border bg-surface px-2 py-1 text-text-primary outline-none focus:border-blue-400"
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSessionClick(session.id, lastMatchingMessageId)}
                              className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 text-left"
                            >
                              {(() => {
                                const lastMsgProvider = [...session.messages].reverse().find((m) => m.provider)?.provider ?? session.provider;
                                return session.isStreaming ? (
                                  <motion.img
                                    src={PROVIDER_ICONS[lastMsgProvider]}
                                    alt={`${lastMsgProvider} provider`}
                                    className="h-[13px] w-[13px] flex-shrink-0 object-contain opacity-85"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                                  />
                                ) : (
                                  <img
                                    src={PROVIDER_ICONS[lastMsgProvider]}
                                    alt={`${lastMsgProvider} provider`}
                                    className="h-[13px] w-[13px] flex-shrink-0 object-contain opacity-85"
                                  />
                                );
                              })()}
                              <span className="truncate flex-1">
                                {titleMatches
                                  ? highlightText(session.title, searchQuery)
                                  : session.title}
                              </span>
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
                              <div ref={menuRef} className="absolute right-1 top-10 z-10 min-w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
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

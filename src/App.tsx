import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useChatStore } from "./store/chatStore";
import {
  ChatProject,
  CompanionFileName,
  MessageDoneEvent,
  MessageErrorEvent,
  MissingCompanionFilesState,
  PersistedWorkspaceState,
  Provider,
  StreamChunkEvent,
  MODELS,
} from "./types";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import ConfirmDialog from "./components/ConfirmDialog";
import InputBar from "./components/InputBar";
import MissingCompanionFilesDialog from "./components/MissingCompanionFilesDialog";

type PendingDelete =
  | { kind: "project"; id: string }
  | { kind: "session"; id: string }
  | null;

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH_RATIO = 0.75;
const COMPANION_FILE_NAMES: CompanionFileName[] = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];
const SYSTEM_COMPANION_FILE_TEMPLATE = `- always start by reading \`vertical_developer_guide.md\` and then read any other relevant \`*_developer_guide.md\` files for the folders you will modify.
- always read the \`.md\` file in every folder you work in. if there is no \`.md\` file in that folder, create one named \`<folder>_developer_guide.md\` and write it for developers who are new to the codebase. these files should never be over 500 lines long.
- when changing any file, update the \`.md\` file in that folder and in ancestor folders when the developer-facing architecture or behavior changed. these \`.md\` files should never be longer than 500 lines long.
- no code file generated or edited should exceed 1000 lines of code. split files before they cross this limit.
- whenever creating a new file, choose its folder carefully and create a new folder when needed so responsibility boundaries stay clear.
- each folder should only have 1 \`.md\` file, except the repository root which may contain multiple \`.md\` files. never create summary-only or visualization-only markdown files.
- never mention legacy functionality or recent change history in developer guide markdown files. write only what is true for the current code.
- keep system temp directories (for example \`%TEMP%/\`) ignored via \`.gitignore\`.
- always ask whether a commit message is good before committing.
- \`.md\` files are ignored when counting files in a folder. keep each folder at 10 code files or fewer where practical, and create a new folder before feature growth makes a folder hard to scan.
- always verify code changes by running the relevant checks, linting and tests.
- never worry about backward compatibility or legacy functionality. always assume everyone has up to date files.
- never assume, if something is ambiguous then ask!
- always repeat to me what i ask and ask clarifying questions to make sure we are on the same page before doing any changes.
- make sure every function and functionality has a test and that all tests pass.
- whith any change update the changlog.
`;

interface CompanionDialogState {
  workingDir: string;
  missingFiles: CompanionFileName[];
  selectedFiles: CompanionFileName[];
  templateContent: string;
  initialTemplateContent: string;
  rememberTemplate: boolean;
  isEditingTemplate: boolean;
}

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
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [companionFileSelectionDefaults, setCompanionFileSelectionDefaults] =
    useState<CompanionFileName[]>(COMPANION_FILE_NAMES);
  const [rememberedCompanionFileTemplate, setRememberedCompanionFileTemplate] = useState<string | null>(null);
  const [companionDialogState, setCompanionDialogState] = useState<CompanionDialogState | null>(null);
  const sidebarResizeRef = useRef({ startX: 0, startWidth: DEFAULT_SIDEBAR_WIDTH });
  const sidebarWidthRatioRef = useRef(getSidebarWidthRatio(DEFAULT_SIDEBAR_WIDTH));
  const companionFileSelectionDefaultsRef = useRef<CompanionFileName[]>(COMPANION_FILE_NAMES);
  const rememberedCompanionFileTemplateRef = useRef<string | null>(null);
  const companionDialogResolverRef = useRef<((shouldContinue: boolean) => void) | null>(null);

  useEffect(() => {
    sidebarWidthRatioRef.current = getSidebarWidthRatio(sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    companionFileSelectionDefaultsRef.current = companionFileSelectionDefaults;
  }, [companionFileSelectionDefaults]);

  useEffect(() => {
    rememberedCompanionFileTemplateRef.current = rememberedCompanionFileTemplate;
  }, [rememberedCompanionFileTemplate]);

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
        if (typeof state.sidebarWidthRatio === "number") {
          const nextWidth = getSidebarWidthFromRatio(state.sidebarWidthRatio);
          setSidebarWidth(nextWidth);
          sidebarWidthRatioRef.current = getSidebarWidthRatio(nextWidth);
        }
        if (Array.isArray(state.companionFileSelectionDefaults)) {
          setCompanionFileSelectionDefaults(state.companionFileSelectionDefaults);
        }
        setRememberedCompanionFileTemplate(state.companionFileTemplate ?? null);
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
    const saveWorkspaceState = (sidebarWidthRatio: number) => {
      invoke("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio,
        companionFileSelectionDefaults: companionFileSelectionDefaultsRef.current,
        companionFileTemplate: rememberedCompanionFileTemplateRef.current,
      }).catch((error) => {
        console.error("Failed to save workspace state", error);
      });
    };

    const unsubscribe = useChatStore.subscribe((state, previousState) => {
      if (!hydrationCompleteRef.current) return;
      if (state.projects === previousState.projects && state.activeSessionId === previousState.activeSessionId) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveWorkspaceState(sidebarWidthRatioRef.current);
      }, 150);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hydrationCompleteRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      invoke("save_workspace_state", {
        projects: useChatStore.getState().projects,
        activeSessionId: useChatStore.getState().activeSessionId,
        sidebarWidthRatio: sidebarWidthRatioRef.current,
        companionFileSelectionDefaults,
        companionFileTemplate: rememberedCompanionFileTemplate,
      }).catch((error) => {
        console.error("Failed to save workspace state", error);
      });
    }, 150);
  }, [sidebarWidth, companionFileSelectionDefaults, rememberedCompanionFileTemplate]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - sidebarResizeRef.current.startX;
      const maxSidebarWidth = getMaxSidebarWidth();
      const nextWidth = clamp(
        sidebarResizeRef.current.startWidth + delta,
        MIN_SIDEBAR_WIDTH,
        maxSidebarWidth,
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    const handleResize = () => {
      setSidebarWidth(getSidebarWidthFromRatio(sidebarWidthRatioRef.current));
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  async function handleNewProject() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        const shouldContinue = await maybeHandleMissingCompanionFiles(selected);
        if (!shouldContinue) {
          return;
        }

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

  async function maybeHandleMissingCompanionFiles(workingDir: string) {
    const { missingFiles } = await invoke<MissingCompanionFilesState>("check_missing_companion_files", {
      workingDir,
    });
    if (missingFiles.length === 0) {
      return true;
    }

    const rememberedSelections = companionFileSelectionDefaults.filter((fileName) => missingFiles.includes(fileName));
    const templateContent = rememberedCompanionFileTemplate ?? SYSTEM_COMPANION_FILE_TEMPLATE;

    return new Promise<boolean>((resolve) => {
      companionDialogResolverRef.current = resolve;
      setCompanionDialogState({
        workingDir,
        missingFiles,
        selectedFiles: rememberedSelections,
        templateContent,
        initialTemplateContent: templateContent,
        rememberTemplate: false,
        isEditingTemplate: false,
      });
    });
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

  function handleSidebarResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsResizingSidebar(true);
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

  function handleCompanionSelectionToggle(fileName: CompanionFileName) {
    setCompanionDialogState((current) => {
      if (!current) return current;

      const selectedFiles = current.selectedFiles.includes(fileName)
        ? current.selectedFiles.filter((value) => value !== fileName)
        : [...current.selectedFiles, fileName];

      return { ...current, selectedFiles };
    });
  }

  function handleOpenCompanionTemplateEditor() {
    setCompanionDialogState((current) => (current ? { ...current, isEditingTemplate: true } : current));
  }

  function handleCompanionTemplateChange(templateContent: string) {
    setCompanionDialogState((current) => (current ? { ...current, templateContent } : current));
  }

  function handleCompanionRememberTemplateChange(rememberTemplate: boolean) {
    setCompanionDialogState((current) => (current ? { ...current, rememberTemplate } : current));
  }

  function handleRestoreSystemCompanionTemplate() {
    setCompanionDialogState((current) =>
      current
        ? {
            ...current,
            templateContent: SYSTEM_COMPANION_FILE_TEMPLATE,
          }
        : current,
    );
  }

  async function handleCompanionDialogContinue() {
    if (!companionDialogState) return;

    const selectedFiles = [...companionDialogState.selectedFiles];
    setCompanionFileSelectionDefaults(selectedFiles);
    const templateWasChanged = companionDialogState.templateContent !== companionDialogState.initialTemplateContent;

    if (companionDialogState.rememberTemplate) {
      setRememberedCompanionFileTemplate(
        companionDialogState.templateContent === SYSTEM_COMPANION_FILE_TEMPLATE
          ? null
          : companionDialogState.templateContent,
      );
    } else if (templateWasChanged) {
      setRememberedCompanionFileTemplate(null);
    }

    try {
      if (selectedFiles.length > 0) {
        await invoke("create_missing_companion_files", {
          workingDir: companionDialogState.workingDir,
          fileNames: selectedFiles,
          templateContent: companionDialogState.templateContent,
        });
      }

      companionDialogResolverRef.current?.(true);
      companionDialogResolverRef.current = null;
      setCompanionDialogState(null);
    } catch (error) {
      console.error("Failed to create companion markdown files", error);
    }
  }

  function handleCompanionDialogCancel() {
    companionDialogResolverRef.current?.(false);
    companionDialogResolverRef.current = null;
    setCompanionDialogState(null);
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
        width={sidebarWidth}
        isResizing={isResizingSidebar}
        onResizeStart={handleSidebarResizeStart}
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
      <MissingCompanionFilesDialog
        open={companionDialogState !== null}
        missingFiles={companionDialogState?.missingFiles ?? []}
        selectedFiles={companionDialogState?.selectedFiles ?? []}
        templateContent={companionDialogState?.templateContent ?? SYSTEM_COMPANION_FILE_TEMPLATE}
        rememberTemplate={companionDialogState?.rememberTemplate ?? false}
        isEditingTemplate={companionDialogState?.isEditingTemplate ?? false}
        onToggle={handleCompanionSelectionToggle}
        onOpenEditor={handleOpenCompanionTemplateEditor}
        onTemplateChange={handleCompanionTemplateChange}
        onRememberTemplateChange={handleCompanionRememberTemplateChange}
        onRestoreSystemDefault={handleRestoreSystemCompanionTemplate}
        onContinue={handleCompanionDialogContinue}
        onCancel={handleCompanionDialogCancel}
      />
    </div>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMaxSidebarWidth() {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.floor(window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO));
}

function getSidebarWidthRatio(width: number) {
  if (window.innerWidth <= 0) {
    return MAX_SIDEBAR_WIDTH_RATIO;
  }

  return clamp(width / window.innerWidth, MIN_SIDEBAR_WIDTH / window.innerWidth, MAX_SIDEBAR_WIDTH_RATIO);
}

function getSidebarWidthFromRatio(ratio: number) {
  return clamp(Math.round(window.innerWidth * ratio), MIN_SIDEBAR_WIDTH, getMaxSidebarWidth());
}

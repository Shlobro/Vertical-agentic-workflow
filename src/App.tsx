import { CSSProperties, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
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
  DEFAULT_MODELS,
  TextZoomState,
} from "./types";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import ConfirmDialog from "./components/ConfirmDialog";
import InputBar from "./components/InputBar";
import MissingCompanionFilesDialog from "./components/MissingCompanionFilesDialog";
import ProviderSwitchDialog from "./components/ProviderSwitchDialog";

type PendingDelete =
  | { kind: "project"; id: string }
  | { kind: "session"; id: string }
  | null;

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH_RATIO = 0.75;
const DEFAULT_TEXT_ZOOM: TextZoomState = {
  chatRem: 0.9375,
  inputRem: 1.0625,
  sidebarRem: 0.875,
};
const MIN_TEXT_ZOOM_REM = 0.75;
const MAX_TEXT_ZOOM_REM = 1.5;
const TEXT_ZOOM_STEP_REM = 0.0625;
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

interface ProjectFileList {
  paths: string[];
}

export default function App() {
  const store = useChatStore();
  const activeSession = store.activeSession();
  const activeProject = store.findProjectBySessionId(store.activeSessionId);
  const appShellRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const hydrationCompleteRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<Provider>("claude");
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODELS.claude);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [providerSwitchDialog, setProviderSwitchDialog] = useState<{
    toProvider: Provider;
    toModel: string;
  } | null>(null);
  const pendingContextHandoffRef = useRef(false);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const [activeHighlightQuery, setActiveHighlightQuery] = useState<string>("");
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [textZoom, setTextZoom] = useState<TextZoomState>(DEFAULT_TEXT_ZOOM);
  const [companionFileSelectionDefaults, setCompanionFileSelectionDefaults] =
    useState<CompanionFileName[]>(COMPANION_FILE_NAMES);
  const [rememberedCompanionFileTemplate, setRememberedCompanionFileTemplate] = useState<string | null>(null);
  const [companionDialogState, setCompanionDialogState] = useState<CompanionDialogState | null>(null);
  const [projectFilePaths, setProjectFilePaths] = useState<string[]>([]);
  const sidebarResizeRef = useRef({ startX: 0, startWidth: DEFAULT_SIDEBAR_WIDTH });
  const sidebarWidthRatioRef = useRef(getSidebarWidthRatio(DEFAULT_SIDEBAR_WIDTH));
  const textZoomRef = useRef<TextZoomState>(DEFAULT_TEXT_ZOOM);
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
    textZoomRef.current = textZoom;
  }, [textZoom]);

  useEffect(() => {
    rememberedCompanionFileTemplateRef.current = rememberedCompanionFileTemplate;
  }, [rememberedCompanionFileTemplate]);

  useEffect(() => {
    const activeWorkingDir = activeProject?.workingDir;
    if (!activeWorkingDir) {
      setProjectFilePaths([]);
      return;
    }

    let cancelled = false;

    const loadProjectFiles = async () => {
      try {
        const result = await invoke<ProjectFileList>("list_project_files", {
          workingDir: activeWorkingDir,
        });
        if (!cancelled) {
          setProjectFilePaths(result?.paths ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setProjectFilePaths([]);
        }
        console.error("Failed to load project file list", error);
      }
    };

    void loadProjectFiles();

    return () => {
      cancelled = true;
    };
  }, [activeProject?.workingDir]);

  function handleProviderChange(nextProvider: Provider) {
    const nextModel = DEFAULT_MODELS[nextProvider];
    if (activeSession && activeSession.messages.length > 0 && activeSession.provider !== nextProvider) {
      setProviderSwitchDialog({ toProvider: nextProvider, toModel: nextModel });
      return;
    }
    commitProviderChange(nextProvider, nextModel);
  }

  function commitProviderChange(nextProvider: Provider, nextModel: string) {
    setDefaultProvider(nextProvider);
    setDefaultModel(nextModel);
    if (activeSession) {
      store.updateSessionConfig(activeSession.id, nextProvider, nextModel);
    }
  }

  function handleProviderSwitchConfirm() {
    if (!providerSwitchDialog) return;
    commitProviderChange(providerSwitchDialog.toProvider, providerSwitchDialog.toModel);
    pendingContextHandoffRef.current = true;
    setProviderSwitchDialog(null);
  }

  function handleProviderSwitchCancel() {
    setProviderSwitchDialog(null);
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
        if (state.textZoom) {
          const nextTextZoom = normalizeTextZoom(state.textZoom);
          setTextZoom(nextTextZoom);
          textZoomRef.current = nextTextZoom;
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
        textZoom: textZoomRef.current,
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
        textZoom,
        companionFileSelectionDefaults,
        companionFileTemplate: rememberedCompanionFileTemplate,
      }).catch((error) => {
        console.error("Failed to save workspace state", error);
      });
    }, 150);
  }, [sidebarWidth, textZoom, companionFileSelectionDefaults, rememberedCompanionFileTemplate]);

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

  useEffect(() => {
    const shell = appShellRef.current;
    if (!shell) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const surfaceElement = target.closest("[data-text-zoom-surface]") as HTMLElement | null;
      const surface = surfaceElement?.dataset.textZoomSurface;
      if (!surface) return;

      event.preventDefault();

      const direction = event.deltaY < 0 ? 1 : -1;
      setTextZoom((current) => {
        const next = { ...current };

        if (surface === "chat") {
          next.chatRem = adjustTextZoom(current.chatRem, direction);
        } else if (surface === "input") {
          next.inputRem = adjustTextZoom(current.inputRem, direction);
        } else if (surface === "sidebar") {
          next.sidebarRem = adjustTextZoom(current.sidebarRem, direction);
        } else {
          return current;
        }

        if (
          next.chatRem === current.chatRem &&
          next.inputRem === current.inputRem &&
          next.sidebarRem === current.sidebarRem
        ) {
          return current;
        }

        return next;
      });
    };

    shell.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      shell.removeEventListener("wheel", handleWheel);
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

  async function handleOpenProjectFolder(projectId: string) {
    const project = store.projects.find((item) => item.id === projectId);
    if (!project) return;

    try {
      await invoke("open_project_in_file_explorer", { workingDir: project.workingDir });
    } catch (error) {
      console.error("Failed to open project in File Explorer", error);
    }
  }

  async function handleOpenProjectTerminal(projectId: string) {
    const project = store.projects.find((item) => item.id === projectId);
    if (!project) return;

    try {
      await invoke("open_project_in_terminal", { workingDir: project.workingDir });
    } catch (error) {
      console.error("Failed to open project in Windows Terminal", error);
    }
  }

  function handleDeleteProject(projectId: string) {
    setPendingDelete({ kind: "project", id: projectId });
  }

  function handleDeleteChat(sessionId: string) {
    setPendingDelete({ kind: "session", id: sessionId });
  }

  function handleSearchSelectSession(sessionId: string, messageId: string | null, query: string) {
    store.setActiveSession(sessionId);
    setActiveHighlightQuery(query);
    setScrollToMessageId(messageId);
  }

  function handleSelectSession(sessionId: string) {
    setScrollToMessageId(null);
    setActiveHighlightQuery("");
    store.setActiveSession(sessionId);
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

    const isHandoff = pendingContextHandoffRef.current;
    pendingContextHandoffRef.current = false;

    if (isHandoff) {
      const priorMessages = session.messages.filter((m) => !m.isContextHandoff);
      const transcript = priorMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n\n");
      const handoffText = `You are an AI assistant taking over a conversation that was started with a different AI. Continue seamlessly as the assistant — the user should not be aware that a switch happened. Here is the conversation so far:\n\n${transcript}`;

      store.addMessage(session.id, {
        id: crypto.randomUUID(),
        role: "user",
        text: handoffText,
        isContextHandoff: true,
      });
    }

    const freshSession = store.activeSession();
    if (!freshSession) return;

    store.addMessage(freshSession.id, {
      id: crypto.randomUUID(),
      role: "user",
      text,
    });

    store.addMessage(freshSession.id, {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "",
      streaming: true,
    });
    store.setStreaming(freshSession.id, true);

    const handoffMessage = isHandoff
      ? freshSession.messages.find((m) => m.isContextHandoff)
      : null;
    const promptToSend = handoffMessage
      ? `${handoffMessage.text}\n\nRespond only to this new message:\n\n${text}`
      : text;

    try {
      await invoke("send_message", {
        sessionUuid: freshSession.id,
        provider: freshSession.provider,
        model: freshSession.model,
        prompt: promptToSend,
        cliSessionId: isHandoff ? null : (freshSession.cliSessionId || null),
        workingDir: project.workingDir,
      });
    } catch (error) {
      store.finalizeAssistant(freshSession.id, `Error: ${formatError(error)}`, "");
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

  const shellStyle = {
    "--chat-font-size": `${textZoom.chatRem}rem`,
    "--chat-font-size-small": `${roundTextZoom(textZoom.chatRem * 0.8125)}rem`,
    "--chat-font-size-title": `${roundTextZoom(textZoom.chatRem * 2)}rem`,
    "--input-font-size": `${textZoom.inputRem}rem`,
    "--input-font-size-small": `${roundTextZoom(textZoom.inputRem * 0.75)}rem`,
    "--input-control-height": `${roundTextZoom(textZoom.inputRem * 1.95)}rem`,
    "--input-control-padding-x": `${roundTextZoom(textZoom.inputRem * 0.47)}rem`,
    "--input-control-padding-y": `${roundTextZoom(textZoom.inputRem * 0.35)}rem`,
    "--input-control-gap": `${roundTextZoom(textZoom.inputRem * 0.35)}rem`,
    "--input-control-icon-size": `${roundTextZoom(textZoom.inputRem * 0.94)}rem`,
    "--input-control-chevron-size": `${roundTextZoom(textZoom.inputRem * 0.66)}rem`,
    "--input-action-size": `${roundTextZoom(textZoom.inputRem * 1.95)}rem`,
    "--input-provider-control-width": `${roundTextZoom(textZoom.inputRem * 6.1)}rem`,
    "--input-model-control-width": `${roundTextZoom(textZoom.inputRem * 9.2)}rem`,
    "--input-provider-menu-width": `${roundTextZoom(textZoom.inputRem * 7.8)}rem`,
    "--input-model-menu-width": `${roundTextZoom(textZoom.inputRem * 12.2)}rem`,
    "--sidebar-font-size": `${textZoom.sidebarRem}rem`,
    "--sidebar-font-size-small": `${roundTextZoom(textZoom.sidebarRem * 0.857)}rem`,
  } as CSSProperties;

  return (
    <div ref={appShellRef} className="flex h-screen overflow-hidden bg-bg-primary text-text-primary" style={shellStyle}>
      <div data-text-zoom-surface="sidebar" className="flex min-h-0">
        <Sidebar
          width={sidebarWidth}
          isResizing={isResizingSidebar}
          onResizeStart={handleSidebarResizeStart}
          projects={store.projects}
          activeSessionId={store.activeSessionId}
          onNewProject={handleNewProject}
          onNewChat={handleNewChat}
          onOpenProjectFolder={handleOpenProjectFolder}
          onOpenProjectTerminal={handleOpenProjectTerminal}
          onToggleProject={store.toggleProjectCollapsed}
          onSelectSession={handleSelectSession}
          onRenameProject={store.renameProject}
          onDeleteProject={handleDeleteProject}
          onRenameSession={store.renameSession}
          onDeleteSession={handleDeleteChat}
          onSearchSelectSession={handleSearchSelectSession}
          onSearchClear={() => { setActiveHighlightQuery(""); setScrollToMessageId(null); }}
          onSearchQueryChange={(query, scopeContents) => {
            setActiveHighlightQuery(scopeContents ? query : "");
            if (!scopeContents) setScrollToMessageId(null);
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div data-text-zoom-surface="chat" className="flex min-h-0 flex-1">
          <ChatView
            session={activeSession}
            highlightQuery={activeHighlightQuery || undefined}
            scrollToMessageId={scrollToMessageId}
          />
        </div>
        {activeSession && activeProject && (
          <div data-text-zoom-surface="input">
            <InputBar
              streaming={activeSession.isStreaming}
              provider={activeSession.provider}
              model={activeSession.model}
              projectFilePaths={projectFilePaths}
              onProviderChange={handleProviderChange}
              onModelChange={handleModelChange}
              onSend={handleSend}
              onCancel={handleCancel}
            />
          </div>
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
      <ProviderSwitchDialog
        open={providerSwitchDialog !== null}
        toProvider={providerSwitchDialog?.toProvider ?? "claude"}
        onConfirm={handleProviderSwitchConfirm}
        onCancel={handleProviderSwitchCancel}
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

function normalizeTextZoom(textZoom: TextZoomState): TextZoomState {
  return {
    chatRem: clampTextZoom(textZoom.chatRem),
    inputRem: clampTextZoom(textZoom.inputRem),
    sidebarRem: clampTextZoom(textZoom.sidebarRem),
  };
}

function adjustTextZoom(current: number, direction: 1 | -1) {
  return clampTextZoom(roundTextZoom(current + direction * TEXT_ZOOM_STEP_REM));
}

function clampTextZoom(value: number) {
  return clamp(value, MIN_TEXT_ZOOM_REM, MAX_TEXT_ZOOM_REM);
}

function roundTextZoom(value: number) {
  return Math.round(value * 10000) / 10000;
}

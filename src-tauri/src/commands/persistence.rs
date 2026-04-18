use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
const PROJECT_STATE_VERSION: u32 = 1;
const REGISTRY_VERSION: u32 = 1;
const PROJECT_STATE_DIR: &str = ".Vertical";
const CHATS_DIR: &str = "chats";
const PROJECT_FILE_NAME: &str = "project.json";
const REGISTRY_FILE_NAME: &str = "registry.json";
const COMPANION_FILE_NAMES: [&str; 3] = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedWorkspaceState {
    pub projects: Vec<PersistedProject>,
    pub active_session_id: Option<String>,
    pub sidebar_width_ratio: Option<f64>,
    pub text_zoom: Option<TextZoomState>,
    pub companion_file_selection_defaults: Option<Vec<String>>,
    pub companion_file_template: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextZoomState {
    pub chat_rem: f64,
    pub input_rem: f64,
    pub sidebar_rem: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MissingCompanionFilesState {
    pub missing_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileList {
    pub paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedProject {
    pub id: String,
    pub title: String,
    pub working_dir: String,
    pub collapsed: bool,
    pub last_active_session_id: Option<String>,
    pub sessions: Vec<PersistedSession>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSession {
    pub id: String,
    pub title: String,
    pub provider: String,
    pub model: String,
    pub cli_session_id: String,
    pub messages: Vec<PersistedMessage>,
    pub is_streaming: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    pub streaming: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryFile {
    version: u32,
    project_paths: Vec<String>,
    active_project_path: Option<String>,
    sidebar_width_ratio: Option<f64>,
    text_zoom: Option<TextZoomState>,
    companion_file_selection_defaults: Option<Vec<String>>,
    companion_file_template: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFile {
    version: u32,
    id: String,
    title: String,
    working_dir: String,
    collapsed: bool,
    last_active_session_id: Option<String>,
    session_order: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatFile {
    version: u32,
    id: String,
    title: String,
    provider: String,
    model: String,
    cli_session_id: String,
    messages: Vec<PersistedMessage>,
}

#[tauri::command]
pub fn load_workspace_state() -> Result<PersistedWorkspaceState, String> {
    let root = executable_storage_root()?;
    let state = load_workspace_state_from_root(&root)?;
    save_registry_file(
        &root,
        &state.projects,
        &state.active_session_id,
        state.sidebar_width_ratio,
        state.text_zoom.clone(),
        state.companion_file_selection_defaults.clone(),
        state.companion_file_template.clone(),
    )?;
    Ok(state)
}

#[tauri::command]
pub fn load_project_state(working_dir: String) -> Result<Option<PersistedProject>, String> {
    load_project(Path::new(&working_dir))
}

#[tauri::command]
pub fn check_missing_companion_files(working_dir: String) -> Result<MissingCompanionFilesState, String> {
    Ok(MissingCompanionFilesState {
        missing_files: missing_companion_files(Path::new(&working_dir)),
    })
}

#[tauri::command]
pub fn create_missing_companion_files(
    working_dir: String,
    file_names: Vec<String>,
    template_content: String,
) -> Result<(), String> {
    let project_root = Path::new(&working_dir);

    for file_name in normalize_companion_file_names(file_names)? {
        let file_path = project_root.join(file_name);
        if file_path.exists() {
            continue;
        }

        fs::write(&file_path, &template_content)
            .map_err(|error| format!("Failed to write '{}': {error}", file_path.display()))?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_project_files(working_dir: String) -> Result<ProjectFileList, String> {
    Ok(ProjectFileList {
        paths: collect_project_files(Path::new(&working_dir))?,
    })
}

#[tauri::command]
pub fn save_workspace_state(
    projects: Vec<PersistedProject>,
    active_session_id: Option<String>,
    sidebar_width_ratio: Option<f64>,
    text_zoom: Option<TextZoomState>,
    companion_file_selection_defaults: Option<Vec<String>>,
    companion_file_template: Option<String>,
) -> Result<(), String> {
    let root = executable_storage_root()?;
    save_workspace_state_to_root(
        &root,
        &projects,
        active_session_id.as_deref(),
        sidebar_width_ratio,
        text_zoom,
        companion_file_selection_defaults,
        companion_file_template,
    )
}

#[tauri::command]
pub fn delete_project_state(working_dir: String) -> Result<(), String> {
    delete_project_state_at_path(Path::new(&working_dir))
}

fn executable_storage_root() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("Failed to resolve executable path: {error}"))?;
    exe_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Failed to resolve executable directory".to_string())
}

fn load_workspace_state_from_root(root: &Path) -> Result<PersistedWorkspaceState, String> {
    let registry = load_registry_file(root)?;
    let mut projects = Vec::new();
    let mut active_session_id = None;

    for project_path in registry.project_paths {
        let project_root = PathBuf::from(&project_path);
        if !project_root.exists() {
            continue;
        }

        let loaded = match load_project(&project_root) {
            Ok(Some(project)) => project,
            Ok(None) => continue,
            Err(_) => continue,
        };

        if registry.active_project_path.as_deref() == Some(project_path.as_str()) {
            active_session_id = resolve_active_session_id(&loaded);
        }

        projects.push(loaded);
    }

    if active_session_id.is_none() {
        active_session_id = projects
            .iter()
            .flat_map(|project| project.sessions.iter())
            .map(|session| session.id.clone())
            .next();
    }

    Ok(PersistedWorkspaceState {
        projects,
        active_session_id,
        sidebar_width_ratio: registry.sidebar_width_ratio,
        text_zoom: registry.text_zoom,
        companion_file_selection_defaults: registry.companion_file_selection_defaults,
        companion_file_template: registry.companion_file_template,
    })
}

fn save_workspace_state_to_root(
    root: &Path,
    projects: &[PersistedProject],
    active_session_id: Option<&str>,
    sidebar_width_ratio: Option<f64>,
    text_zoom: Option<TextZoomState>,
    companion_file_selection_defaults: Option<Vec<String>>,
    companion_file_template: Option<String>,
) -> Result<(), String> {
    for project in projects {
        save_project(project, active_session_id)?;
    }

    save_registry_file(
        root,
        projects,
        &active_session_id.map(str::to_string),
        sidebar_width_ratio,
        text_zoom,
        companion_file_selection_defaults,
        companion_file_template,
    )
}

fn save_registry_file(
    root: &Path,
    projects: &[PersistedProject],
    active_session_id: &Option<String>,
    sidebar_width_ratio: Option<f64>,
    text_zoom: Option<TextZoomState>,
    companion_file_selection_defaults: Option<Vec<String>>,
    companion_file_template: Option<String>,
) -> Result<(), String> {
    let registry_dir = registry_dir(root);
    fs::create_dir_all(&registry_dir)
        .map_err(|error| format!("Failed to create registry directory '{}': {error}", registry_dir.display()))?;

    let active_project_path = active_session_id
        .as_deref()
        .and_then(|session_id| find_active_project_path(projects, session_id));

    let registry = RegistryFile {
        version: REGISTRY_VERSION,
        project_paths: projects.iter().map(|project| project.working_dir.clone()).collect(),
        active_project_path,
        sidebar_width_ratio,
        text_zoom,
        companion_file_selection_defaults,
        companion_file_template,
    };

    write_json_file(&registry_dir.join(REGISTRY_FILE_NAME), &registry)
}

fn save_project(project: &PersistedProject, active_session_id: Option<&str>) -> Result<(), String> {
    let vertical_dir = project_vertical_dir(Path::new(&project.working_dir));
    let chats_dir = vertical_dir.join(CHATS_DIR);

    fs::create_dir_all(&chats_dir)
        .map_err(|error| format!("Failed to create project storage '{}': {error}", chats_dir.display()))?;

    let last_active_session_id = project
        .sessions
        .iter()
        .find(|session| Some(session.id.as_str()) == active_session_id)
        .map(|session| session.id.clone());

    let project_file = ProjectFile {
        version: PROJECT_STATE_VERSION,
        id: project.id.clone(),
        title: project.title.clone(),
        working_dir: project.working_dir.clone(),
        collapsed: project.collapsed,
        last_active_session_id: project.last_active_session_id.clone().or(last_active_session_id),
        session_order: project.sessions.iter().map(|session| session.id.clone()).collect(),
    };

    write_json_file(&vertical_dir.join(PROJECT_FILE_NAME), &project_file)?;

    let mut expected_chat_files = HashSet::new();

    for session in &project.sessions {
        let chat_file = ChatFile {
            version: PROJECT_STATE_VERSION,
            id: session.id.clone(),
            title: session.title.clone(),
            provider: session.provider.clone(),
            model: session.model.clone(),
            cli_session_id: session.cli_session_id.clone(),
            messages: session.messages.clone(),
        };
        let chat_path = chats_dir.join(format!("{}.json", session.id));
        expected_chat_files.insert(chat_path.clone());
        write_json_file(&chat_path, &chat_file)?;
    }

    if chats_dir.exists() {
        for entry in fs::read_dir(&chats_dir)
            .map_err(|error| format!("Failed to read chats directory '{}': {error}", chats_dir.display()))?
        {
            let entry = entry.map_err(|error| format!("Failed to read chat entry: {error}"))?;
            let path = entry.path();
            if path.is_file() && !expected_chat_files.contains(&path) {
                fs::remove_file(&path)
                    .map_err(|error| format!("Failed to remove stale chat file '{}': {error}", path.display()))?;
            }
        }
    }

    Ok(())
}

fn load_project(project_root: &Path) -> Result<Option<PersistedProject>, String> {
    let vertical_dir = project_vertical_dir(project_root);
    let project_file_path = vertical_dir.join(PROJECT_FILE_NAME);
    if !project_file_path.exists() {
        return Ok(None);
    }

    let project_file: ProjectFile = read_json_file(&project_file_path)?;
    let chats_dir = vertical_dir.join(CHATS_DIR);
    let mut chats_by_id = HashMap::new();

    if chats_dir.exists() {
        for entry in fs::read_dir(&chats_dir)
            .map_err(|error| format!("Failed to read chats directory '{}': {error}", chats_dir.display()))?
        {
            let entry = entry.map_err(|error| format!("Failed to read chat entry: {error}"))?;
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|extension| extension.to_str()) != Some("json") {
                continue;
            }

            let chat_file: ChatFile = read_json_file(&path)?;
            chats_by_id.insert(
                chat_file.id.clone(),
                PersistedSession {
                    id: chat_file.id,
                    title: chat_file.title,
                    provider: chat_file.provider,
                    model: chat_file.model,
                    cli_session_id: chat_file.cli_session_id,
                    messages: chat_file.messages,
                    is_streaming: false,
                },
            );
        }
    }

    let mut sessions = Vec::new();
    for session_id in project_file.session_order {
        if let Some(session) = chats_by_id.remove(&session_id) {
            sessions.push(session);
        }
    }

    let mut remaining_sessions: Vec<_> = chats_by_id.into_values().collect();
    remaining_sessions.sort_by(|left, right| left.title.cmp(&right.title));
    sessions.extend(remaining_sessions);

    Ok(Some(PersistedProject {
        id: project_file.id,
        title: project_file.title,
        working_dir: project_file.working_dir,
        collapsed: project_file.collapsed,
        last_active_session_id: project_file.last_active_session_id,
        sessions,
    }))
}

fn load_registry_file(root: &Path) -> Result<RegistryFile, String> {
    let path = registry_dir(root).join(REGISTRY_FILE_NAME);
    if !path.exists() {
        return Ok(RegistryFile {
            version: REGISTRY_VERSION,
            project_paths: Vec::new(),
            active_project_path: None,
            sidebar_width_ratio: None,
            text_zoom: None,
            companion_file_selection_defaults: None,
            companion_file_template: None,
        });
    }

    read_json_file(&path)
}

fn missing_companion_files(project_root: &Path) -> Vec<String> {
    COMPANION_FILE_NAMES
        .iter()
        .filter_map(|file_name| {
            let file_path = project_root.join(file_name);
            (!file_path.exists()).then(|| (*file_name).to_string())
        })
        .collect()
}

fn normalize_companion_file_names(file_names: Vec<String>) -> Result<Vec<String>, String> {
    let allowed: HashSet<&str> = COMPANION_FILE_NAMES.iter().copied().collect();
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();

    for file_name in file_names {
        if !allowed.contains(file_name.as_str()) {
            return Err(format!("Unsupported companion file '{}'", file_name));
        }

        if seen.insert(file_name.clone()) {
            normalized.push(file_name);
        }
    }

    Ok(normalized)
}

fn collect_project_files(project_root: &Path) -> Result<Vec<String>, String> {
    let mut collected = Vec::new();
    collect_project_files_recursive(project_root, project_root, &mut collected)?;
    collected.sort_unstable();
    Ok(collected)
}

fn collect_project_files_recursive(
    project_root: &Path,
    current_dir: &Path,
    collected: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current_dir)
        .map_err(|error| format!("Failed to read directory '{}': {error}", current_dir.display()))?
    {
        let entry = entry.map_err(|error| format!("Failed to read project entry: {error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect '{}': {error}", path.display()))?;

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            if should_skip_directory(&entry.file_name()) {
                continue;
            }
            collect_project_files_recursive(project_root, &path, collected)?;
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let relative_path = path
            .strip_prefix(project_root)
            .map_err(|error| format!("Failed to normalize '{}': {error}", path.display()))?;
        collected.push(relative_path.to_string_lossy().replace('\\', "/"));
    }

    Ok(())
}

fn should_skip_directory(name: &std::ffi::OsStr) -> bool {
    match name.to_string_lossy().as_ref() {
        ".git" | ".Vertical" | "node_modules" | "dist" | "target" => true,
        _ => false,
    }
}

fn registry_dir(root: &Path) -> PathBuf {
    root.join(PROJECT_STATE_DIR)
}

fn project_vertical_dir(project_root: &Path) -> PathBuf {
    project_root.join(PROJECT_STATE_DIR)
}

fn resolve_active_session_id(project: &PersistedProject) -> Option<String> {
    project
        .last_active_session_id
        .as_ref()
        .and_then(|session_id| {
            project
                .sessions
                .iter()
                .find(|session| &session.id == session_id)
                .map(|session| session.id.clone())
        })
        .or_else(|| project.sessions.first().map(|session| session.id.clone()))
}

fn find_active_project_path(projects: &[PersistedProject], session_id: &str) -> Option<String> {
    projects
        .iter()
        .find(|project| project.sessions.iter().any(|session| session.id == session_id))
        .map(|project| project.working_dir.clone())
}

fn delete_project_state_at_path(project_root: &Path) -> Result<(), String> {
    let vertical_dir = project_vertical_dir(project_root);
    if !vertical_dir.exists() {
        return Ok(());
    }

    fs::remove_dir_all(&vertical_dir)
        .map_err(|error| format!("Failed to delete project storage '{}': {error}", vertical_dir.display()))
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Failed to serialize '{}': {error}", path.display()))?;
    fs::write(path, content).map_err(|error| format!("Failed to write '{}': {error}", path.display()))
}

fn read_json_file<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, String> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read '{}': {error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse '{}': {error}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::{
        collect_project_files, create_missing_companion_files, delete_project_state_at_path,
        load_workspace_state_from_root, missing_companion_files, project_vertical_dir,
        save_workspace_state_to_root, PersistedMessage, PersistedProject, PersistedSession,
        TextZoomState,
    };
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_root() -> PathBuf {
        let root = env::temp_dir().join(format!("vertical-persistence-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn sample_project(project_root: &PathBuf) -> PersistedProject {
        PersistedProject {
            id: "project-1".to_string(),
            title: "Alpha".to_string(),
            working_dir: project_root.to_string_lossy().to_string(),
            collapsed: false,
            last_active_session_id: Some("session-2".to_string()),
            sessions: vec![
                PersistedSession {
                    id: "session-1".to_string(),
                    title: "Chat 1".to_string(),
                    provider: "claude".to_string(),
                    model: "claude-sonnet-4-6".to_string(),
                    cli_session_id: "cli-1".to_string(),
                    messages: vec![PersistedMessage {
                        id: "msg-1".to_string(),
                        role: "user".to_string(),
                        text: "hello".to_string(),
                        streaming: None,
                    }],
                    is_streaming: false,
                },
                PersistedSession {
                    id: "session-2".to_string(),
                    title: "Chat 2".to_string(),
                    provider: "codex".to_string(),
                    model: "gpt-5.4".to_string(),
                    cli_session_id: String::new(),
                    messages: vec![],
                    is_streaming: false,
                },
            ],
        }
    }

    #[test]
    fn saves_and_loads_workspace_state() {
        let root = temp_root();
        let project_root = root.join("AlphaProject");
        fs::create_dir_all(&project_root).unwrap();
        let project = sample_project(&project_root);

        save_workspace_state_to_root(
            &root,
            &[project],
            Some("session-2"),
            Some(0.512),
            Some(TextZoomState {
                chat_rem: 1.0,
                input_rem: 1.125,
                sidebar_rem: 0.875,
            }),
            Some(vec!["CLAUDE.md".to_string(), "GEMINI.md".to_string()]),
            Some("custom template".to_string()),
        )
        .unwrap();
        let loaded = load_workspace_state_from_root(&root).unwrap();

        assert_eq!(loaded.projects.len(), 1);
        assert_eq!(loaded.projects[0].sessions.len(), 2);
        assert_eq!(loaded.active_session_id.as_deref(), Some("session-2"));
        assert_eq!(loaded.projects[0].sessions[0].id, "session-1");
        assert_eq!(loaded.sidebar_width_ratio, Some(0.512));
        assert_eq!(
            loaded.text_zoom,
            Some(TextZoomState {
                chat_rem: 1.0,
                input_rem: 1.125,
                sidebar_rem: 0.875,
            })
        );
        assert_eq!(
            loaded.companion_file_selection_defaults,
            Some(vec!["CLAUDE.md".to_string(), "GEMINI.md".to_string()])
        );
        assert_eq!(loaded.companion_file_template.as_deref(), Some("custom template"));
    }

    #[test]
    fn removes_stale_chat_files_when_project_is_resaved() {
        let root = temp_root();
        let project_root = root.join("AlphaProject");
        fs::create_dir_all(&project_root).unwrap();
        let mut project = sample_project(&project_root);

        save_workspace_state_to_root(&root, &[project.clone()], Some("session-1"), Some(0.32), None, None, None)
            .unwrap();
        project.sessions.pop();
        save_workspace_state_to_root(&root, &[project], Some("session-1"), Some(0.32), None, None, None).unwrap();

        let stale_chat_path = project_vertical_dir(&project_root).join("chats").join("session-2.json");
        assert!(!stale_chat_path.exists());
    }

    #[test]
    fn deletes_project_storage_directory() {
        let root = temp_root();
        let project_root = root.join("AlphaProject");
        fs::create_dir_all(&project_root).unwrap();
        let project = sample_project(&project_root);

        save_workspace_state_to_root(&root, &[project], Some("session-1"), Some(0.32), None, None, None).unwrap();
        delete_project_state_at_path(&project_root).unwrap();

        assert!(!project_vertical_dir(&project_root).exists());
    }

    #[test]
    fn reports_only_missing_companion_files() {
        let root = temp_root();
        fs::write(root.join("CLAUDE.md"), "existing").unwrap();

        let missing = missing_companion_files(&root);

        assert_eq!(missing, vec!["AGENTS.md".to_string(), "GEMINI.md".to_string()]);
    }

    #[test]
    fn creates_selected_missing_companion_files_without_overwriting_existing_ones() {
        let root = temp_root();
        let existing_path = root.join("AGENTS.md");
        fs::write(&existing_path, "keep me").unwrap();

        create_missing_companion_files(
            root.to_string_lossy().to_string(),
            vec!["CLAUDE.md".to_string(), "AGENTS.md".to_string()],
            "custom body".to_string(),
        )
        .unwrap();

        assert_eq!(fs::read_to_string(root.join("CLAUDE.md")).unwrap(), "custom body");
        assert_eq!(fs::read_to_string(existing_path).unwrap(), "keep me");
        assert!(!root.join("GEMINI.md").exists());
    }

    #[test]
    fn lists_relative_project_files_while_skipping_generated_directories() {
        let root = temp_root();
        fs::create_dir_all(root.join("src").join("nested")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::create_dir_all(root.join(".Vertical")).unwrap();
        fs::create_dir_all(root.join("node_modules").join("pkg")).unwrap();
        fs::create_dir_all(root.join("dist")).unwrap();
        fs::create_dir_all(root.join("target")).unwrap();
        fs::write(root.join("README.md"), "docs").unwrap();
        fs::write(root.join("src").join("main.tsx"), "main").unwrap();
        fs::write(root.join("src").join("nested").join("thing.test.ts"), "test").unwrap();
        fs::write(root.join(".git").join("config"), "git").unwrap();
        fs::write(root.join(".Vertical").join("project.json"), "{}").unwrap();
        fs::write(root.join("node_modules").join("pkg").join("index.js"), "pkg").unwrap();
        fs::write(root.join("dist").join("bundle.js"), "bundle").unwrap();
        fs::write(root.join("target").join("app"), "app").unwrap();

        let files = collect_project_files(&root).unwrap();

        assert_eq!(
            files,
            vec![
                "README.md".to_string(),
                "src/main.tsx".to_string(),
                "src/nested/thing.test.ts".to_string()
            ]
        );
    }
}

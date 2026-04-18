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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedWorkspaceState {
    pub projects: Vec<PersistedProject>,
    pub active_session_id: Option<String>,
    pub sidebar_width_ratio: Option<f64>,
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
    )?;
    Ok(state)
}

#[tauri::command]
pub fn load_project_state(working_dir: String) -> Result<Option<PersistedProject>, String> {
    load_project(Path::new(&working_dir))
}

#[tauri::command]
pub fn save_workspace_state(
    projects: Vec<PersistedProject>,
    active_session_id: Option<String>,
    sidebar_width_ratio: Option<f64>,
) -> Result<(), String> {
    let root = executable_storage_root()?;
    save_workspace_state_to_root(
        &root,
        &projects,
        active_session_id.as_deref(),
        sidebar_width_ratio,
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
    })
}

fn save_workspace_state_to_root(
    root: &Path,
    projects: &[PersistedProject],
    active_session_id: Option<&str>,
    sidebar_width_ratio: Option<f64>,
) -> Result<(), String> {
    for project in projects {
        save_project(project, active_session_id)?;
    }

    save_registry_file(
        root,
        projects,
        &active_session_id.map(str::to_string),
        sidebar_width_ratio,
    )
}

fn save_registry_file(
    root: &Path,
    projects: &[PersistedProject],
    active_session_id: &Option<String>,
    sidebar_width_ratio: Option<f64>,
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
        });
    }

    read_json_file(&path)
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
        delete_project_state_at_path, load_workspace_state_from_root, project_vertical_dir,
        save_workspace_state_to_root, PersistedMessage, PersistedProject, PersistedSession,
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

        save_workspace_state_to_root(&root, &[project], Some("session-2"), Some(0.512)).unwrap();
        let loaded = load_workspace_state_from_root(&root).unwrap();

        assert_eq!(loaded.projects.len(), 1);
        assert_eq!(loaded.projects[0].sessions.len(), 2);
        assert_eq!(loaded.active_session_id.as_deref(), Some("session-2"));
        assert_eq!(loaded.projects[0].sessions[0].id, "session-1");
        assert_eq!(loaded.sidebar_width_ratio, Some(0.512));
    }

    #[test]
    fn removes_stale_chat_files_when_project_is_resaved() {
        let root = temp_root();
        let project_root = root.join("AlphaProject");
        fs::create_dir_all(&project_root).unwrap();
        let mut project = sample_project(&project_root);

        save_workspace_state_to_root(&root, &[project.clone()], Some("session-1"), Some(0.32)).unwrap();
        project.sessions.pop();
        save_workspace_state_to_root(&root, &[project], Some("session-1"), Some(0.32)).unwrap();

        let stale_chat_path = project_vertical_dir(&project_root).join("chats").join("session-2.json");
        assert!(!stale_chat_path.exists());
    }

    #[test]
    fn deletes_project_storage_directory() {
        let root = temp_root();
        let project_root = root.join("AlphaProject");
        fs::create_dir_all(&project_root).unwrap();
        let project = sample_project(&project_root);

        save_workspace_state_to_root(&root, &[project], Some("session-1"), Some(0.32)).unwrap();
        delete_project_state_at_path(&project_root).unwrap();

        assert!(!project_vertical_dir(&project_root).exists());
    }
}

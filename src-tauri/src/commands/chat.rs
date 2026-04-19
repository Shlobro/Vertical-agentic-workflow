use serde::{Deserialize, Serialize};
use std::io::ErrorKind;
use std::collections::{HashMap, HashSet};
use std::process::{ExitStatus, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;

use crate::providers::{ClaudeProvider, CodexProvider, GeminiProvider};

type SharedChild = Arc<AsyncMutex<tokio::process::Child>>;
const PROVIDER_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Clone, Default)]
pub struct ActiveProcesses {
    children: Arc<Mutex<HashMap<String, SharedChild>>>,
    cancelled: Arc<Mutex<HashSet<String>>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StreamChunk {
    pub session_uuid: String,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MessageDone {
    pub session_uuid: String,
    pub full_text: String,
    pub cli_session_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MessageError {
    pub session_uuid: String,
    pub error: String,
    pub partial_text: String,
}

impl ActiveProcesses {
    fn insert(&self, session_uuid: String, child: SharedChild) {
        let mut children = self.children.lock().unwrap();
        children.insert(session_uuid, child);
    }

    fn get(&self, session_uuid: &str) -> Option<SharedChild> {
        let children = self.children.lock().unwrap();
        children.get(session_uuid).cloned()
    }

    fn remove(&self, session_uuid: &str) {
        let mut children = self.children.lock().unwrap();
        children.remove(session_uuid);
    }

    fn mark_cancelled(&self, session_uuid: &str) {
        let mut cancelled = self.cancelled.lock().unwrap();
        cancelled.insert(session_uuid.to_string());
    }

    fn take_cancelled(&self, session_uuid: &str) -> bool {
        let mut cancelled = self.cancelled.lock().unwrap();
        cancelled.remove(session_uuid)
    }
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    processes: State<'_, ActiveProcesses>,
    session_uuid: String,
    provider: String,
    model: String,
    prompt: String,
    cli_session_id: Option<String>,
    working_dir: String,
) -> Result<(), String> {
    let processes = processes.inner().clone();
    let (exe, args) = match provider.as_str() {
        "claude" => ClaudeProvider::build_command(&model, cli_session_id.as_deref(), &prompt),
        "codex" => CodexProvider::build_command(&model, cli_session_id.as_deref(), &prompt),
        "gemini" => GeminiProvider::build_command(&model, cli_session_id.as_deref(), &prompt),
        _ => return Err(format!("Unknown provider: {provider}")),
    };

    let child = spawn_provider_process(&provider, &exe, &args, &working_dir)?;

    let child = Arc::new(AsyncMutex::new(child));
    let (stdout, stderr) = {
        let mut child_guard = child.lock().await;
        if provider_uses_stdin_prompt(&provider) {
            if let Some(mut stdin) = child_guard.stdin.take() {
                stdin
                    .write_all(prompt.as_bytes())
                    .await
                    .map_err(|error| format!("Failed to write prompt to {exe} stdin: {error}"))?;
            }
        }
        let stdout = child_guard
            .stdout
            .take()
            .ok_or_else(|| format!("{exe} stdout pipe was not available"))?;
        let stderr = child_guard
            .stderr
            .take()
            .ok_or_else(|| format!("{exe} stderr pipe was not available"))?;
        (stdout, stderr)
    };

    processes.insert(session_uuid.clone(), child.clone());

    tokio::spawn(async move {
        let stdout_task = tokio::spawn(read_stdout(
            app.clone(),
            session_uuid.clone(),
            provider.clone(),
            stdout,
        ));
        let stderr_task = tokio::spawn(read_stderr(stderr));

        let exit_status = wait_for_child(child, PROVIDER_TIMEOUT).await;
        let stdout_result = stdout_task.await;
        let stderr_result = stderr_task.await;

        processes.remove(&session_uuid);

        let cancelled = processes.take_cancelled(&session_uuid);

        match finalize_message(
            stdout_result,
            stderr_result,
            exit_status,
            &provider,
            cancelled,
        ) {
            Ok(done) => {
                let _ = app.emit(
                    "message-done",
                    MessageDone {
                        session_uuid,
                        full_text: done.full_text,
                        cli_session_id: done.cli_session_id,
                    },
                );
            }
            Err(error) => {
                let _ = app.emit(
                    "message-error",
                    MessageError {
                        session_uuid,
                        error: error.error,
                        partial_text: error.partial_text,
                    },
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_message(
    processes: State<'_, ActiveProcesses>,
    session_uuid: String,
) -> Result<(), String> {
    let Some(child) = processes.get(&session_uuid) else {
        return Ok(());
    };

    processes.mark_cancelled(&session_uuid);

    let mut child_guard = child.lock().await;
    child_guard
        .kill()
        .await
        .map_err(|e| format!("Failed to cancel message: {e}"))
}

struct StreamState {
    full_output: String,
    streamed_text: String,
    cli_session_id: String,
}

struct FinalMessage {
    full_text: String,
    cli_session_id: String,
}

struct FinalError {
    error: String,
    partial_text: String,
}

enum WaitError {
    Process(String),
    TimedOut(Duration),
}

enum SpawnAttemptError {
    Missing(std::io::Error),
    Failed(String),
}

async fn read_stdout(
    app: AppHandle,
    session_uuid: String,
    provider: String,
    stdout: tokio::process::ChildStdout,
) -> Result<StreamState, String> {
    let mut reader = BufReader::new(stdout).lines();
    let mut state = StreamState {
        full_output: String::new(),
        streamed_text: String::new(),
        cli_session_id: String::new(),
    };

    loop {
        match reader.next_line().await {
            Ok(Some(line)) => {
                state.full_output.push_str(&line);
                state.full_output.push('\n');

                if let Some(session_id) = extract_session_id(&provider, &line) {
                    if !session_id.is_empty() {
                        state.cli_session_id = session_id;
                    }
                }

                if let Some(text) = try_extract_stream_text(&provider, &line) {
                    state.streamed_text = merge_stream_text(&state.streamed_text, &text);
                    let _ = app.emit(
                        "stream-chunk",
                        StreamChunk {
                            session_uuid: session_uuid.clone(),
                            text: state.streamed_text.clone(),
                        },
                    );
                }
            }
            Ok(None) => return Ok(state),
            Err(error) => return Err(format!("Failed to read provider output: {error}")),
        }
    }
}

async fn read_stderr(stderr: tokio::process::ChildStderr) -> Result<String, String> {
    let mut reader = BufReader::new(stderr).lines();
    let mut output = String::new();

    loop {
        match reader.next_line().await {
            Ok(Some(line)) => {
                if !output.is_empty() {
                    output.push('\n');
                }
                output.push_str(&line);
            }
            Ok(None) => return Ok(output),
            Err(error) => return Err(format!("Failed to read provider stderr: {error}")),
        }
    }
}

async fn wait_for_child(child: SharedChild, timeout: Duration) -> Result<ExitStatus, WaitError> {
    let mut child_guard = child.lock().await;
    match tokio::time::timeout(timeout, child_guard.wait()).await {
        Ok(result) => result.map_err(|error| {
            WaitError::Process(format!(
                "Failed while waiting for provider process: {error}"
            ))
        }),
        Err(_) => {
            child_guard.kill().await.map_err(|error| {
                WaitError::Process(format!(
                    "Failed to terminate timed out provider process: {error}"
                ))
            })?;
            let _ = child_guard.wait().await;
            Err(WaitError::TimedOut(timeout))
        }
    }
}

fn finalize_message(
    stdout_result: Result<Result<StreamState, String>, tokio::task::JoinError>,
    stderr_result: Result<Result<String, String>, tokio::task::JoinError>,
    exit_status: Result<ExitStatus, WaitError>,
    provider: &str,
    cancelled: bool,
) -> Result<FinalMessage, FinalError> {
    let state = stdout_result
        .map_err(|error| FinalError {
            error: format!("Provider output task crashed: {error}"),
            partial_text: String::new(),
        })?
        .map_err(|error| FinalError {
            error,
            partial_text: String::new(),
        })?;

    let stderr = stderr_result
        .map_err(|error| FinalError {
            error: format!("Provider stderr task crashed: {error}"),
            partial_text: state.streamed_text.clone(),
        })?
        .map_err(|error| FinalError {
            error,
            partial_text: state.streamed_text.clone(),
        })?;

    let status = exit_status.map_err(|error| FinalError {
        error: format_wait_error(error),
        partial_text: state.streamed_text.clone(),
    })?;

    let full_text = finalize_text(provider, &state);
    let cli_session_id = finalize_session_id(provider, &state);

    if status.success() {
        return Ok(FinalMessage {
            full_text,
            cli_session_id,
        });
    }

    if cancelled {
        return Err(FinalError {
            error: "Request cancelled".to_string(),
            partial_text: full_text,
        });
    }

    let error = if stderr.trim().is_empty() {
        format!("Provider exited with status {status}")
    } else {
        stderr.trim().to_string()
    };

    Err(FinalError {
        error,
        partial_text: full_text,
    })
}

fn finalize_text(provider: &str, state: &StreamState) -> String {
    if !state.streamed_text.is_empty() {
        return state.streamed_text.clone();
    }

    match provider {
        "claude" => ClaudeProvider::extract_text(&state.full_output).unwrap_or_default(),
        "codex" => CodexProvider::extract_text(&state.full_output).unwrap_or_default(),
        _ => state.full_output.clone(),
    }
}


fn finalize_session_id(provider: &str, state: &StreamState) -> String {
    if !state.cli_session_id.is_empty() {
        return state.cli_session_id.clone();
    }

    extract_session_id(provider, &state.full_output).unwrap_or_default()
}

fn extract_session_id(provider: &str, json_str: &str) -> Option<String> {
    match provider {
        "claude" => ClaudeProvider::extract_session_id(json_str),
        "codex" => CodexProvider::extract_session_id(json_str),
        "gemini" => GeminiProvider::extract_session_id(json_str),
        _ => None,
    }
}

fn provider_uses_stdin_prompt(provider: &str) -> bool {
    matches!(provider, "claude" | "codex" | "gemini")
}

fn merge_stream_text(existing: &str, incoming: &str) -> String {
    if incoming.is_empty() {
        return existing.to_string();
    }
    if existing.is_empty() || incoming.starts_with(existing) {
        return incoming.to_string();
    }
    if existing.ends_with(incoming) {
        return existing.to_string();
    }

    for overlap in incoming
        .char_indices()
        .map(|(idx, _)| idx)
        .chain(std::iter::once(incoming.len()))
        .filter(|idx| *idx > 0)
        .rev()
    {
        if existing.ends_with(&incoming[..overlap]) {
            let mut merged = existing.to_string();
            merged.push_str(&incoming[overlap..]);
            return merged;
        }
    }

    let mut merged = existing.to_string();
    merged.push_str(incoming);
    merged
}

fn try_extract_stream_text(provider: &str, line: &str) -> Option<String> {
    if provider == "gemini" {
        return GeminiProvider::try_extract_stream_text(line);
    }
    let val: serde_json::Value = serde_json::from_str(line).ok()?;
    extract_text_from_value(&val)
}

fn extract_text_from_value(val: &serde_json::Value) -> Option<String> {
    if let Some(text) = val.get("partial_message").and_then(|item| item.as_str()) {
        if !text.is_empty() {
            return Some(text.to_string());
        }
    }

    if let Some(text) = val.get("text").and_then(|item| item.as_str()) {
        if !text.is_empty() {
            return Some(text.to_string());
        }
    }

    if let Some(text) = val
        .get("delta")
        .and_then(|delta| delta.get("text"))
        .and_then(|item| item.as_str())
    {
        if !text.is_empty() {
            return Some(text.to_string());
        }
    }

    if let Some(content) = val
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_array())
    {
        for item in content {
            if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    if !text.is_empty() {
                        return Some(text.to_string());
                    }
                }
            }
        }
    }

    if let Some(content) = val.get("content").and_then(|content| content.as_array()) {
        for item in content {
            if let Some(text) = extract_text_from_value(item) {
                return Some(text);
            }
        }
    }

    if let Some(item) = val.get("item") {
        if let Some(text) = extract_text_from_value(item) {
            return Some(text);
        }
    }

    None
}

fn format_wait_error(error: WaitError) -> String {
    match error {
        WaitError::Process(message) => message,
        WaitError::TimedOut(timeout) => {
            format!("Provider timed out after {} seconds", timeout.as_secs())
        }
    }
}

fn spawn_provider_process(
    provider: &str,
    exe: &str,
    args: &[String],
    working_dir: &str,
) -> Result<tokio::process::Child, String> {
    #[cfg(target_os = "windows")]
    {
        let direct_error = match try_spawn_candidates(exe, args, working_dir) {
            Ok(child) => return Ok(child),
            Err(SpawnAttemptError::Missing(error)) => error.to_string(),
            Err(SpawnAttemptError::Failed(message)) => message,
        };

        match spawn_provider_via_cmd(exe, args, working_dir) {
            Ok(child) => return Ok(child),
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Failed to spawn {exe} via cmd.exe after direct launch failed ({direct_error}): {error}"
                ));
            }
        }
        Err(format_missing_provider_error(
            provider,
            exe,
            Some(direct_error.as_str()),
        ))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let last_error = match try_spawn_candidates(exe, args, working_dir) {
            Ok(child) => return Ok(child),
            Err(SpawnAttemptError::Missing(error)) => Some(error),
            Err(SpawnAttemptError::Failed(message)) => return Err(message),
        };

        Err(format_missing_provider_error(
            provider,
            exe,
            last_error,
        ))
    }
}

fn try_spawn_candidates(
    exe: &str,
    args: &[String],
    working_dir: &str,
) -> Result<tokio::process::Child, SpawnAttemptError> {
    let mut last_error = None;

    for candidate in executable_candidates(exe) {
        match Command::new(&candidate)
            .args(args)
            .current_dir(working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => return Ok(child),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                last_error = Some(error);
            }
            Err(error) => {
                return Err(SpawnAttemptError::Failed(format!(
                    "Failed to spawn {candidate}: {error}"
                )));
            }
        }
    }

    Err(SpawnAttemptError::Missing(last_error.unwrap_or_else(|| {
        std::io::Error::new(ErrorKind::NotFound, format!("Failed to resolve {exe}"))
    })))
}

fn executable_candidates(exe: &str) -> Vec<String> {
    let mut candidates = vec![exe.to_string()];

    #[cfg(target_os = "windows")]
    {
        for extension in [".cmd", ".exe", ".bat"] {
            if !exe.to_ascii_lowercase().ends_with(extension) {
                candidates.push(format!("{exe}{extension}"));
            }
        }
    }

    candidates
}

#[cfg(target_os = "windows")]
fn spawn_provider_via_cmd(
    exe: &str,
    args: &[String],
    working_dir: &str,
) -> std::io::Result<tokio::process::Child> {
    let mut command_line = quote_for_cmd(exe);
    for arg in args {
        command_line.push(' ');
        command_line.push_str(&quote_for_cmd(arg));
    }

    Command::new("cmd")
        .args(["/d", "/s", "/c", &command_line])
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}

#[cfg(target_os = "windows")]
fn quote_for_cmd(value: &str) -> String {
    if value.is_empty() {
        return "\"\"".to_string();
    }

    let needs_quotes = value.chars().any(|ch| ch.is_whitespace() || matches!(ch, '"' | '&' | '|' | '<' | '>' | '^' | '%' ));
    if !needs_quotes {
        return value.to_string();
    }

    let escaped = value.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

fn format_missing_provider_error(
    provider: &str,
    exe: &str,
    error: Option<&str>,
) -> String {
    let provider_name = match provider {
        "codex" => "Codex CLI",
        "claude" => "Claude Code CLI",
        "gemini" => "Gemini CLI",
        _ => exe,
    };

    match error {
        Some(error) => format!(
            "{provider_name} was not found on PATH. Install it and restart Vertical. Tried executable '{exe}' and Windows fallback names. Last error: {error}"
        ),
        None => format!(
            "{provider_name} was not found on PATH. Install it and restart Vertical."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        executable_candidates, finalize_text, format_missing_provider_error, format_wait_error,
        merge_stream_text, provider_uses_stdin_prompt, try_extract_stream_text, StreamState,
        WaitError,
    };
    use std::time::Duration;

    #[test]
    fn merge_stream_text_appends_incremental_chunks() {
        let merged = merge_stream_text("Hello", " world");
        assert_eq!(merged, "Hello world");
    }

    #[test]
    fn merge_stream_text_keeps_cumulative_snapshot() {
        let merged = merge_stream_text("Hello", "Hello world");
        assert_eq!(merged, "Hello world");
    }

    #[test]
    fn merge_stream_text_avoids_duplicate_overlap() {
        let merged = merge_stream_text("Hello wor", "world");
        assert_eq!(merged, "Hello world");
    }

    #[test]
    fn merge_stream_text_handles_unicode_overlap() {
        let merged = merge_stream_text("שלום עול", "עולם");
        assert_eq!(merged, "שלום עולם");
    }

    #[test]
    fn extracts_claude_stream_text() {
        let line = r#"{"message":{"content":[{"type":"text","text":"hello"}]}}"#;
        assert_eq!(try_extract_stream_text("claude", line).as_deref(), Some("hello"));
    }

    #[test]
    fn extracts_claude_partial_message_text() {
        let line = r#"{"type":"assistant","partial_message":"hello"}"#;
        assert_eq!(try_extract_stream_text("claude", line).as_deref(), Some("hello"));
    }

    #[test]
    fn extracts_codex_completed_agent_message_text() {
        let line = r#"{"type":"item.completed","item":{"type":"agent_message","content":[{"type":"output_text","text":"hello"}]}}"#;
        assert_eq!(try_extract_stream_text("codex", line).as_deref(), Some("hello"));
    }

    #[test]
    fn finalize_text_falls_back_to_provider_result() {
        let state = StreamState {
            full_output: "{\"result\":\"done\"}\n".to_string(),
            streamed_text: String::new(),
            cli_session_id: String::new(),
        };

        assert_eq!(finalize_text("claude", &state), "done");
    }

    #[test]
    fn formats_timeout_errors() {
        let message = format_wait_error(WaitError::TimedOut(Duration::from_secs(42)));
        assert_eq!(message, "Provider timed out after 42 seconds");
    }

    #[test]
    fn missing_codex_error_is_actionable() {
        let message = format_missing_provider_error("codex", "codex", None);
        assert!(message.contains("Codex CLI was not found on PATH"));
    }

    #[test]
    fn missing_provider_error_includes_direct_launch_detail() {
        let message = format_missing_provider_error(
            "codex",
            "codex",
            Some("Failed to spawn codex.cmd: batch file arguments are invalid"),
        );
        assert!(message.contains("batch file arguments are invalid"));
    }

    #[test]
    fn known_providers_use_stdin_for_prompts() {
        assert!(provider_uses_stdin_prompt("claude"));
        assert!(provider_uses_stdin_prompt("codex"));
        assert!(provider_uses_stdin_prompt("gemini"));
        assert!(!provider_uses_stdin_prompt("other"));
    }

    #[test]
    fn windows_executable_candidates_include_script_extensions() {
        let candidates = executable_candidates("codex");

        assert!(candidates.contains(&"codex".to_string()));

        #[cfg(target_os = "windows")]
        {
            assert!(candidates.contains(&"codex.cmd".to_string()));
            assert!(candidates.contains(&"codex.exe".to_string()));
            assert!(candidates.contains(&"codex.bat".to_string()));
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn quote_for_cmd_wraps_paths_and_special_chars() {
        let quoted = super::quote_for_cmd(r#"C:\Users\Shlomo\AppData\Roaming\npm\codex.cmd"#);
        assert_eq!(quoted, r#"C:\Users\Shlomo\AppData\Roaming\npm\codex.cmd"#);

        let quoted_with_spaces = super::quote_for_cmd(r#"D:\My Projects\repo name"#);
        assert_eq!(quoted_with_spaces, r#""D:\My Projects\repo name""#);

        let quoted_with_percent = super::quote_for_cmd("%USERPROFILE%");
        assert_eq!(quoted_with_percent, r#""%USERPROFILE%""#);
    }
}

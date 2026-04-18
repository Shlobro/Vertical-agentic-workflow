use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::providers::{ClaudeProvider, CodexProvider};

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

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    session_uuid: String,
    provider: String,
    model: String,
    prompt: String,
    cli_session_id: Option<String>,
) -> Result<(), String> {
    let (exe, args) = match provider.as_str() {
        "claude" => ClaudeProvider::build_command(&model, cli_session_id.as_deref(), &prompt),
        "codex" => CodexProvider::build_command(&model, cli_session_id.as_deref(), &prompt),
        _ => return Err(format!("Unknown provider: {provider}")),
    };

    let mut child = Command::new(&exe)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn {exe}: {e}"))?;

    let stdout = child.stdout.take().unwrap();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();

        let mut full_output = String::new();
        let mut found_cli_session_id = String::new();
        let mut latest_text = String::new();

        while let Ok(Some(line)) = reader.next_line().await {
            full_output.push_str(&line);
            full_output.push('\n');

            // Extract session ID from each line
            let sid = match provider.as_str() {
                "claude" => ClaudeProvider::extract_session_id(&line),
                "codex" => CodexProvider::extract_session_id(&line),
                _ => None,
            };
            if let Some(s) = sid {
                if !s.is_empty() { found_cli_session_id = s; }
            }

            // Extract and stream text chunks
            if let Some(text) = try_extract_stream_text(&line) {
                if !text.is_empty() {
                    latest_text = text.clone();
                    let _ = app.emit("stream-chunk", StreamChunk {
                        session_uuid: session_uuid.clone(),
                        text,
                    });
                }
            }
        }

        // If no streaming text was found, try full output
        if latest_text.is_empty() {
            latest_text = match provider.as_str() {
                "claude" => ClaudeProvider::extract_text(&full_output).unwrap_or_default(),
                "codex" => CodexProvider::extract_text(&full_output).unwrap_or_default(),
                _ => full_output.clone(),
            };
        }

        if found_cli_session_id.is_empty() {
            found_cli_session_id = match provider.as_str() {
                "claude" => ClaudeProvider::extract_session_id(&full_output).unwrap_or_default(),
                "codex" => CodexProvider::extract_session_id(&full_output).unwrap_or_default(),
                _ => String::new(),
            };
        }

        let _ = app.emit("message-done", MessageDone {
            session_uuid,
            full_text: latest_text,
            cli_session_id: found_cli_session_id,
        });
    });

    Ok(())
}

fn try_extract_stream_text(line: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(line).ok()?;
    // Claude streaming: message with content array
    if let Some(msg) = val.get("message") {
        if let Some(content) = msg.get("content") {
            if let Some(arr) = content.as_array() {
                for item in arr {
                    if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                        if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                            if !text.is_empty() {
                                return Some(text.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    // Final result field (both providers)
    if let Some(result) = val.get("result") {
        let s = result.as_str().unwrap_or("").to_string();
        if !s.is_empty() { return Some(s); }
    }
    None
}

pub struct CodexProvider;

impl CodexProvider {
    pub fn build_command(
        model: &str,
        session_id: Option<&str>,
        _prompt: &str,
    ) -> (String, Vec<String>) {
        let mut args = vec!["exec".to_string()];
        let mut option_args = vec![
            "--skip-git-repo-check".to_string(),
            "--full-auto".to_string(),
            "--json".to_string(),
        ];
        let (actual_model, reasoning_effort) = split_model_and_reasoning_effort(model);

        if let Some(model) = actual_model {
            option_args.push("--model".to_string());
            option_args.push(model.to_string());
        }
        if let Some(reasoning_effort) = reasoning_effort {
            option_args.push("-c".to_string());
            option_args.push(format!("model_reasoning_effort={reasoning_effort}"));
        }
        if let Some(sid) = session_id.and_then(normalize_session_id) {
            if !sid.is_empty() {
                args.push("resume".to_string());
                args.append(&mut option_args);
                args.push(sid.to_string());
                args.push("-".to_string());
                return ("codex".to_string(), args);
            }
        }
        args.append(&mut option_args);
        args.push("-".to_string());
        ("codex".to_string(), args)
    }

    pub fn extract_session_id(json_str: &str) -> Option<String> {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
            return find_thread_id(&val)
                .as_deref()
                .and_then(normalize_session_id)
                .map(str::to_string);
        }
        None
    }

    pub fn extract_text(json_str: &str) -> Option<String> {
        let mut final_messages = Vec::new();
        let mut fallback_messages = Vec::new();

        for line in json_str.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) else {
                continue;
            };

            let Some(message) = extract_codex_message(&val) else {
                continue;
            };

            let event_type = val
                .get("type")
                .and_then(|item| item.as_str())
                .unwrap_or_default()
                .to_ascii_lowercase();

            if matches!(
                event_type.as_str(),
                "result" | "message" | "final_message" | "assistant_message"
            ) {
                final_messages.push(message);
            } else if event_type.contains("assistant") || event_type.contains("completed") {
                fallback_messages.push(message);
            }
        }

        final_messages
            .pop()
            .or_else(|| fallback_messages.pop())
    }
}

fn split_model_and_reasoning_effort(model: &str) -> (Option<&str>, Option<&str>) {
    if model.is_empty() {
        return (None, None);
    }

    if let Some((actual_model, reasoning_effort)) = model.split_once(':') {
        let actual_model = (!actual_model.is_empty()).then_some(actual_model);
        let reasoning_effort = (!reasoning_effort.is_empty()).then_some(reasoning_effort);
        return (actual_model, reasoning_effort);
    }

    (Some(model), None)
}

fn normalize_session_id(session_id: &str) -> Option<&str> {
    let trimmed = session_id.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.contains(['\r', '\n', '\0']) {
        return None;
    }

    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("error:")
        || lower.starts_with("warning:")
        || lower.starts_with("usage:")
        || lower.starts_with("for more information")
    {
        return None;
    }

    Some(trimmed)
}

fn extract_codex_message(val: &serde_json::Value) -> Option<String> {
    if let Some(item) = val.get("item").and_then(|item| item.as_object()) {
        let item_type = item
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        if matches!(
            item_type.as_str(),
            "agent_message" | "assistant_message" | "message"
        ) {
            let joined = item
                .get("text")
                .or_else(|| item.get("content"))
                .or_else(|| item.get("output"))
                .or_else(|| item.get("result"))
                .map(flatten_text)
                .unwrap_or_default()
                .join("\n")
                .trim()
                .to_string();

            if !joined.is_empty() {
                return Some(joined);
            }
        }
    }

    for key in [
        "last_message",
        "final_message",
        "message",
        "result",
        "content",
        "output",
    ] {
        let joined = val
            .get(key)
            .map(flatten_text)
            .unwrap_or_default()
            .join("\n")
            .trim()
            .to_string();

        if !joined.is_empty() {
            return Some(joined);
        }
    }

    None
}

fn flatten_text(val: &serde_json::Value) -> Vec<String> {
    match val {
        serde_json::Value::String(text) => vec![text.to_string()],
        serde_json::Value::Array(items) => items.iter().flat_map(flatten_text).collect(),
        serde_json::Value::Object(map) => {
            for key in ["text", "result", "output", "message", "content"] {
                if let Some(value) = map.get(key) {
                    return flatten_text(value);
                }
            }

            Vec::new()
        }
        _ => Vec::new(),
    }
}

fn find_thread_id(val: &serde_json::Value) -> Option<String> {
    match val {
        serde_json::Value::Object(map) => {
            if let Some(tid) = map.get("thread_id") {
                if let Some(s) = tid.as_str() {
                    return Some(s.to_string());
                }
            }
            if let Some(sid) = map.get("session_id") {
                if let Some(s) = sid.as_str() {
                    return Some(s.to_string());
                }
            }
            for v in map.values() {
                if let Some(found) = find_thread_id(v) {
                    return Some(found);
                }
            }
            None
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                if let Some(found) = find_thread_id(v) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_session_id, CodexProvider};

    #[test]
    fn build_command_uses_exec_json_mode() {
        let (_, args) =
            CodexProvider::build_command("gpt-5.4:high", Some("thread-1"), "hello");

        assert_eq!(args[0], "exec");
        assert_eq!(args[1], "resume");
        assert!(args.contains(&"--json".to_string()));
        assert!(args.contains(&"gpt-5.4".to_string()));
        assert!(args.contains(&"model_reasoning_effort=high".to_string()));
        assert_eq!(args.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn build_command_keeps_non_resume_exec_order() {
        let (_, args) = CodexProvider::build_command("gpt-5.4:high", None, "hello");

        assert_eq!(args[0], "exec");
        assert_eq!(args[1], "--skip-git-repo-check");
        assert_eq!(args.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn build_command_skips_invalid_resume_session_id() {
        let (_, args) = CodexProvider::build_command(
            "gpt-5.4:high",
            Some("error: unexpected argument 'keep' found"),
            "hello",
        );

        assert_eq!(args[0], "exec");
        assert_eq!(args[1], "--skip-git-repo-check");
        assert!(!args.contains(&"resume".to_string()));
    }

    #[test]
    fn normalize_session_id_rejects_diagnostic_text() {
        assert_eq!(normalize_session_id("error: bad args"), None);
        assert_eq!(normalize_session_id("warning: stale arg0 temp dirs"), None);
        assert_eq!(normalize_session_id("Usage: codex exec resume"), None);
        assert_eq!(normalize_session_id("thread-123\nerror: extra"), None);
    }

    #[test]
    fn normalize_session_id_accepts_trimmed_thread_id() {
        assert_eq!(normalize_session_id("  thread-123  "), Some("thread-123"));
    }

    #[test]
    fn extract_text_prefers_completed_agent_message() {
        let output = concat!(
            "{\"type\":\"thread.started\",\"thread_id\":\"thread-1\"}\n",
            "{\"type\":\"item.completed\",\"item\":{\"type\":\"agent_message\",\"content\":[{\"type\":\"output_text\",\"text\":\"final answer\"}]}}\n"
        );

        assert_eq!(CodexProvider::extract_text(output).as_deref(), Some("final answer"));
    }
}

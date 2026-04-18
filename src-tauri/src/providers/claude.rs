pub struct ClaudeProvider;

impl ClaudeProvider {
    pub fn build_command(
        model: &str,
        session_id: Option<&str>,
        prompt: &str,
    ) -> (String, Vec<String>) {
        let mut args = vec![
            "--dangerously-skip-permissions".to_string(),
            "--verbose".to_string(),
            "--print".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--include-partial-messages".to_string(),
        ];
        if !model.is_empty() {
            args.push("--model".to_string());
            args.push(model.to_string());
        }
        if let Some(sid) = session_id {
            if !sid.is_empty() {
                args.push("--resume".to_string());
                args.push(sid.to_string());
            }
        }
        args.push(prompt.to_string());
        ("claude".to_string(), args)
    }

    pub fn extract_session_id(json_str: &str) -> Option<String> {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
            return find_session_id(&val);
        }
        None
    }

    pub fn extract_text(json_str: &str) -> Option<String> {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
            if let Some(result) = val.get("result") {
                return Some(result.as_str().unwrap_or("").to_string());
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::ClaudeProvider;

    #[test]
    fn build_command_enables_streaming_output() {
        let (_, args) =
            ClaudeProvider::build_command("claude-sonnet-4-6", Some("session-1"), "hello");

        assert!(args.contains(&"--verbose".to_string()));
        assert!(args.contains(&"--print".to_string()));
        assert!(args.contains(&"stream-json".to_string()));
        assert!(args.contains(&"--include-partial-messages".to_string()));
        assert!(args.contains(&"--resume".to_string()));
    }
}

fn find_session_id(val: &serde_json::Value) -> Option<String> {
    match val {
        serde_json::Value::Object(map) => {
            if let Some(sid) = map.get("session_id") {
                if let Some(s) = sid.as_str() {
                    return Some(s.to_string());
                }
            }
            for v in map.values() {
                if let Some(found) = find_session_id(v) {
                    return Some(found);
                }
            }
            None
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                if let Some(found) = find_session_id(v) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

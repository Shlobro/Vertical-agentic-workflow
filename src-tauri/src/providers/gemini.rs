pub struct GeminiProvider;

impl GeminiProvider {
    pub fn build_command(
        model: &str,
        session_id: Option<&str>,
        _prompt: &str,
    ) -> (String, Vec<String>) {
        let mut args = vec![
            "--yolo".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--prompt".to_string(),
            String::new(),
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
        ("gemini".to_string(), args)
    }

    pub fn extract_session_id(json_str: &str) -> Option<String> {
        for line in json_str.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                if val.get("type").and_then(|t| t.as_str()) == Some("init") {
                    if let Some(sid) = val.get("session_id").and_then(|s| s.as_str()) {
                        if !sid.is_empty() {
                            return Some(sid.to_string());
                        }
                    }
                }
            }
        }
        None
    }

    pub fn try_extract_stream_text(line: &str) -> Option<String> {
        let val: serde_json::Value = serde_json::from_str(line).ok()?;
        if val.get("type").and_then(|t| t.as_str()) == Some("message")
            && val.get("role").and_then(|r| r.as_str()) == Some("assistant")
        {
            if let Some(content) = val.get("content").and_then(|c| c.as_str()) {
                if !content.is_empty() {
                    return Some(content.to_string());
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::GeminiProvider;

    #[test]
    fn build_command_non_interactive_mode() {
        let (exe, args) = GeminiProvider::build_command("gemini-2.5-flash", None, "hello");
        assert_eq!(exe, "gemini");
        assert!(args.contains(&"--yolo".to_string()));
        assert!(args.contains(&"--prompt".to_string()));
        assert!(args.contains(&String::new()));
        assert!(args.contains(&"stream-json".to_string()));
    }

    #[test]
    fn build_command_includes_resume_when_session_id_present() {
        let (_, args) =
            GeminiProvider::build_command("gemini-2.5-flash", Some("abc-123"), "hello");
        assert!(args.contains(&"--resume".to_string()));
        assert!(args.contains(&"abc-123".to_string()));
    }

    #[test]
    fn build_command_omits_resume_when_no_session_id() {
        let (_, args) = GeminiProvider::build_command("gemini-2.5-flash", None, "hello");
        assert!(!args.contains(&"--resume".to_string()));
    }

    #[test]
    fn extracts_session_id_from_init_event() {
        let output = r#"{"type":"init","session_id":"abc-123","model":"gemini-2.5-flash"}"#;
        assert_eq!(
            GeminiProvider::extract_session_id(output).as_deref(),
            Some("abc-123")
        );
    }

    #[test]
    fn extracts_stream_text_from_assistant_message() {
        let line = r#"{"type":"message","role":"assistant","content":"Hello!","delta":true}"#;
        assert_eq!(
            GeminiProvider::try_extract_stream_text(line).as_deref(),
            Some("Hello!")
        );
    }

    #[test]
    fn ignores_user_messages_for_stream_text() {
        let line = r#"{"type":"message","role":"user","content":"say hi"}"#;
        assert!(GeminiProvider::try_extract_stream_text(line).is_none());
    }
}

mod commands;
mod providers;

use commands::chat::{cancel_message, send_message, ActiveProcesses};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveProcesses::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![send_message, cancel_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod commands;
mod providers;

use commands::chat::{cancel_message, send_message, ActiveProcesses};
use commands::persistence::{
    check_missing_companion_files, create_missing_companion_files, delete_project_state,
    list_project_files, load_project_state, load_workspace_state, open_project_in_file_explorer,
    open_project_in_terminal, save_workspace_state,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveProcesses::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            send_message,
            cancel_message,
            check_missing_companion_files,
            create_missing_companion_files,
            list_project_files,
            load_project_state,
            load_workspace_state,
            open_project_in_file_explorer,
            open_project_in_terminal,
            save_workspace_state,
            delete_project_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

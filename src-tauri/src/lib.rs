mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(commands::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            home_dir,
            read_text,
            write_text,
            read_json,
            write_json,
            path_exists,
            list_dir,
            list_dir_recursive,
            find_files_named,
            remove_path,
            ensure_dir,
            rename_path,
            scan_for_projects,
            watch_paths,
            unwatch_all,
            run_command,
            run_claude_cli,
            open_external,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

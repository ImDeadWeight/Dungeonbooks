//! Native shell shared by desktop and mobile: registers the plugins (files,
//! dialogs, one window at a time on desktop) and starts the Tauri app that
//! hosts the web UI.

#[cfg(desktop)]
use tauri::Manager;

/// Builds and runs the app. On mobile this is the platform entry point.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    // Desktop: starting the app again brings the running window forward instead of opening a
    // second copy, so two windows never save over each other's files. Must be the first plugin.
    // Android keeps one copy of an app by itself.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }
    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Dungeon Books");
}

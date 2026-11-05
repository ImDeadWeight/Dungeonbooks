//! Native shell shared by desktop and mobile: registers the plugins (files,
//! dialogs, HTTP for talking to AI models, one window at a time on desktop),
//! the AI connection and updates on desktop, and starts the Tauri app that hosts the web UI.

#[cfg(desktop)]
mod image_file;
#[cfg(desktop)]
mod mcp;
mod network;

#[cfg(desktop)]
use tauri::Manager;

/// Desktop: `--mcp-stdio` runs as an AI app's tool server instead of the app (see mcp.rs). Returns the exit code.
#[cfg(desktop)]
pub fn run_mcp_stdio() -> i32 {
    mcp::run_stdio()
}

/// Builds and runs the app. On mobile this is the platform entry point.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    // Desktop: starting the app again brings the running window forward instead of opening a
    // second copy, so two windows never save over each other's files. Must be the first plugin.
    // Android keeps one copy of an app by itself.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }))
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .setup(|app| {
                mcp::setup(app.handle());
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                network::local_ipv4,
                mcp::mcp_attach,
                mcp::mcp_reply,
                mcp::ai_connection_status,
                mcp::ai_connection_set_enabled,
                mcp::ai_connection_new_token,
                image_file::read_image_file,
            ]);
    }
    // Mobile has no AI connection server, only the network lookup.
    #[cfg(mobile)]
    {
        builder = builder.invoke_handler(tauri::generate_handler![network::local_ipv4]);
    }
    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Dungeon Books");
}

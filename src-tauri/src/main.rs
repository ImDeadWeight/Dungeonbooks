//! Desktop entry point; all setup lives in lib.rs so mobile can share it.

// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // An AI app starting us as its tool server: relay, and never open a window.
    if std::env::args().any(|arg| arg == "--mcp-stdio") {
        std::process::exit(dungeon_books_lib::run_mcp_stdio());
    }
    dungeon_books_lib::run()
}

//! Desktop entry point; all setup lives in lib.rs so mobile can share it.

// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dungeon_books_lib::run()
}

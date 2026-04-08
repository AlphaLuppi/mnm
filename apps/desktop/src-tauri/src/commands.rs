use serde::{Deserialize, Serialize};
use specta::Type;

/// Sprint 1 smoke-test command. Validates the IPC pipeline end-to-end:
/// Rust → tauri-specta → bindings.ts → ui/ → invoke → response.
/// TODO(desktop/sprint-2): remove ping once real commands land.
#[tauri::command]
#[specta::specta]
pub fn ping(name: String) -> String {
    format!("pong: {}", name)
}

/// Returns app metadata. Useful for the desktop debug overlay.
#[derive(Serialize, Deserialize, Type)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub tauri_version: String,
}

#[tauri::command]
#[specta::specta]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
    }
}

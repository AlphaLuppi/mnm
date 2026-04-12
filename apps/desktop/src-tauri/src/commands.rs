use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, State};

use crate::profile::{store_path, Profile, ProfileCreateInput, ProfilePatch, ProfileStore};

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

// ---------------------------------------------------------------------------
// Profile commands
// ---------------------------------------------------------------------------

/// Load (or initialize) the profile store from the given app data directory.
/// Used by `lib.rs::run()` during setup so the store can be `.manage()`'d
/// behind a `Mutex`.
pub fn load_profile_store(app_data_dir: &Path) -> ProfileStore {
    let path = store_path(app_data_dir);
    ProfileStore::load(&path)
}

/// Resolve the app data dir for the running app and persist the store there
/// via the atomic-write path. All mutation commands use this helper so that
/// disk state always mirrors in-memory state before returning Ok.
fn persist(app: &AppHandle, store: &ProfileStore) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create profile dir: {e}"))?;
    let path = store_path(&dir);
    store.save(&path)
}

/// Lock the in-memory store, mapping poison errors to a serializable string.
fn lock_store<'a>(
    state: &'a State<'_, Mutex<ProfileStore>>,
) -> Result<std::sync::MutexGuard<'a, ProfileStore>, String> {
    state
        .lock()
        .map_err(|e| format!("profile store mutex poisoned: {e}"))
}

#[tauri::command]
#[specta::specta]
pub fn profile_list(state: State<'_, Mutex<ProfileStore>>) -> Result<Vec<Profile>, String> {
    let guard = lock_store(&state)?;
    Ok(guard.profiles.clone())
}

#[tauri::command]
#[specta::specta]
pub fn profile_get_active(
    state: State<'_, Mutex<ProfileStore>>,
) -> Result<Option<Profile>, String> {
    let guard = lock_store(&state)?;
    Ok(guard.get_active().cloned())
}

#[tauri::command]
#[specta::specta]
pub fn profile_add(
    app: AppHandle,
    state: State<'_, Mutex<ProfileStore>>,
    input: ProfileCreateInput,
) -> Result<Profile, String> {
    let mut guard = lock_store(&state)?;
    let (next, created) = guard.add(input)?;
    persist(&app, &next)?;
    *guard = next;
    Ok(created)
}

#[tauri::command]
#[specta::specta]
pub fn profile_update(
    app: AppHandle,
    state: State<'_, Mutex<ProfileStore>>,
    id: String,
    patch: ProfilePatch,
) -> Result<Profile, String> {
    let mut guard = lock_store(&state)?;
    let (next, updated) = guard.update(&id, patch)?;
    persist(&app, &next)?;
    *guard = next;
    Ok(updated)
}

#[tauri::command]
#[specta::specta]
pub fn profile_remove(
    app: AppHandle,
    state: State<'_, Mutex<ProfileStore>>,
    id: String,
) -> Result<(), String> {
    let mut guard = lock_store(&state)?;
    let next = guard.remove(&id)?;
    persist(&app, &next)?;
    *guard = next;

    // Cascade: wipe any keychain entries associated with this profile.
    crate::secrets::secret_delete(id)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn profile_set_active(
    app: AppHandle,
    state: State<'_, Mutex<ProfileStore>>,
    id: String,
) -> Result<Profile, String> {
    let mut guard = lock_store(&state)?;
    let (next, touched) = guard.set_active(&id)?;
    persist(&app, &next)?;
    *guard = next;
    Ok(touched)
}

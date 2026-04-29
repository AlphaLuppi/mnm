//! Keychain-backed secret storage for connection profiles.
//!
//! Secrets are stored in the macOS Keychain (or platform equivalent) via the
//! `keyring` crate. Each secret is keyed by `{profile_id}:{key_name}` under
//! the service name that matches the app identifier (`com.mnm.desktop`).
//!
//! This module is deliberately decoupled from `profile.rs`: profiles live in
//! a JSON file, secrets live in the OS keychain. The only coupling point is
//! `profile_remove` in `commands.rs`, which cascades deletion to keychain.

/// Service name registered in the OS credential store.
/// Matches the `identifier` field in `tauri.conf.json`.
const SERVICE: &str = "com.mnm.desktop";

/// All known secret key names for a single profile.
/// Used by `secret_delete` to wipe every entry when a profile is removed.
const KNOWN_KEYS: &[&str] = &["session_token"];

/// Build the account string stored in the keychain entry.
/// Format: `"{profile_id}:{key_name}"`.
fn account(profile_id: &str, key: &str) -> String {
    format!("{profile_id}:{key}")
}

/// Store a secret value in the OS keychain.
#[tauri::command]
#[specta::specta]
pub fn secret_set(profile_id: String, key: String, value: String) -> Result<(), String> {
    let acct = account(&profile_id, &key);
    keyring::Entry::new(SERVICE, &acct)
        .map_err(|e| format!("keyring entry error: {e}"))?
        .set_password(&value)
        .map_err(|e| format!("keyring set error: {e}"))
}

/// Retrieve a secret from the OS keychain.
/// Returns `None` when the entry does not exist (rather than erroring).
#[tauri::command]
#[specta::specta]
pub fn secret_get(profile_id: String, key: String) -> Result<Option<String>, String> {
    let acct = account(&profile_id, &key);
    let entry = keyring::Entry::new(SERVICE, &acct)
        .map_err(|e| format!("keyring entry error: {e}"))?;

    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring get error: {e}")),
    }
}

/// Delete ALL known keychain entries for a given profile.
/// Silently ignores entries that do not exist (`NoEntry`).
/// Called from `profile_remove` to cascade-clean keychain data.
#[tauri::command]
#[specta::specta]
pub fn secret_delete(profile_id: String) -> Result<(), String> {
    for key_name in KNOWN_KEYS {
        let acct = account(&profile_id, key_name);
        let entry = keyring::Entry::new(SERVICE, &acct)
            .map_err(|e| format!("keyring entry error: {e}"))?;

        match entry.delete_credential() {
            Ok(()) => {}
            Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("keyring delete error: {e}")),
        }
    }
    Ok(())
}

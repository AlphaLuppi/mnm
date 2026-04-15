//! Connection profile storage for MnM Desktop.
//!
//! Profiles let users configure which backend the desktop app should talk to.
//! The store is persisted to `{app_data_dir}/profiles.json` as a versioned
//! JSON document and held in memory behind a `Mutex` managed by Tauri.
//!
//! Mutations follow the immutability rule from `CLAUDE.md`: every change
//! clones the store, applies the mutation to the clone, persists the clone,
//! and swaps it into the mutex. Pure logic lives on `ProfileStore` methods
//! so that it can be unit-tested without touching Tauri.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;

/// Name of the persistent store file inside `app_data_dir`.
pub const PROFILES_FILE: &str = "profiles.json";
/// Temporary file used for atomic writes.
pub const PROFILES_TMP_FILE: &str = "profiles.json.tmp";
/// Prefix used when renaming a corrupt store aside.
pub const PROFILES_BACKUP_PREFIX: &str = "profiles.json.bak.";

/// Current store schema version. Bump when introducing a breaking change.
pub const STORE_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub display_name: String,
    pub api_base_url: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStore {
    pub version: u32,
    pub active_profile_id: Option<String>,
    pub profiles: Vec<Profile>,
}

impl Default for ProfileStore {
    fn default() -> Self {
        Self {
            version: STORE_VERSION,
            active_profile_id: None,
            profiles: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProfileCreateInput {
    pub display_name: String,
    pub api_base_url: String,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePatch {
    pub display_name: Option<String>,
    pub api_base_url: Option<String>,
}

/// Resolve the store file path given its parent directory.
pub fn store_path(dir: &Path) -> PathBuf {
    dir.join(PROFILES_FILE)
}

/// Resolve the temporary file path given the store's parent directory.
pub fn tmp_path(dir: &Path) -> PathBuf {
    dir.join(PROFILES_TMP_FILE)
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn validate_url(candidate: &str) -> Result<(), String> {
    url::Url::parse(candidate)
        .map(|_| ())
        .map_err(|e| format!("invalid url: {e}"))
}

impl ProfileStore {
    /// Resilient read from disk:
    /// - missing file → `ProfileStore::default()`
    /// - corrupt file → back it up under `profiles.json.bak.{unix_ts}` and
    ///   return a default store. The caller will persist the default on the
    ///   next successful mutation.
    pub fn load(path: &Path) -> Self {
        match fs::read_to_string(path) {
            Ok(contents) => match serde_json::from_str::<ProfileStore>(&contents) {
                Ok(store) => store,
                Err(err) => {
                    eprintln!("profile store: corrupt json at {path:?}: {err}. backing up.");
                    Self::backup_corrupt(path);
                    Self::default()
                }
            },
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Self::default(),
            Err(err) => {
                eprintln!("profile store: failed to read {path:?}: {err}. using defaults.");
                Self::default()
            }
        }
    }

    fn backup_corrupt(path: &Path) {
        let Some(parent) = path.parent() else {
            return;
        };
        let backup_name = format!("{}{}", PROFILES_BACKUP_PREFIX, unix_timestamp());
        let backup_path = parent.join(backup_name);
        if let Err(err) = fs::rename(path, &backup_path) {
            eprintln!("profile store: failed to back up corrupt file: {err}");
        }
    }

    /// Atomic write: serialize to a temp file then `rename` over the target.
    /// On success the temp file no longer exists on disk.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let Some(parent) = path.parent() else {
            return Err("profile store path has no parent directory".to_string());
        };
        fs::create_dir_all(parent).map_err(|e| format!("failed to create profile dir: {e}"))?;

        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("failed to serialize profile store: {e}"))?;

        let tmp = tmp_path(parent);
        fs::write(&tmp, json.as_bytes())
            .map_err(|e| format!("failed to write temp profile file: {e}"))?;

        fs::rename(&tmp, path).map_err(|e| {
            // Best-effort cleanup of the temp file on rename failure.
            let _ = fs::remove_file(&tmp);
            format!("failed to rename temp profile file: {e}")
        })?;

        Ok(())
    }

    /// Add a new profile. Returns a new store plus the newly created profile.
    /// If the store was empty before the add the new profile becomes active.
    pub fn add(&self, input: ProfileCreateInput) -> Result<(Self, Profile), String> {
        validate_url(&input.api_base_url)?;

        let was_empty = self.profiles.is_empty();
        let profile = Profile {
            id: uuid::Uuid::new_v4().to_string(),
            display_name: input.display_name,
            api_base_url: input.api_base_url,
            created_at: now_rfc3339(),
            last_used_at: None,
        };

        let mut next = self.clone();
        next.profiles.push(profile.clone());
        if was_empty {
            next.active_profile_id = Some(profile.id.clone());
        }
        Ok((next, profile))
    }

    /// Partially update a profile. `None` fields are left alone.
    pub fn update(&self, id: &str, patch: ProfilePatch) -> Result<(Self, Profile), String> {
        if let Some(new_url) = patch.api_base_url.as_deref() {
            validate_url(new_url)?;
        }

        let idx = self
            .profiles
            .iter()
            .position(|p| p.id == id)
            .ok_or_else(|| "profile not found".to_string())?;

        let mut next = self.clone();
        let existing = &self.profiles[idx];
        let updated = Profile {
            id: existing.id.clone(),
            display_name: patch
                .display_name
                .clone()
                .unwrap_or_else(|| existing.display_name.clone()),
            api_base_url: patch
                .api_base_url
                .clone()
                .unwrap_or_else(|| existing.api_base_url.clone()),
            created_at: existing.created_at.clone(),
            last_used_at: existing.last_used_at.clone(),
        };
        next.profiles[idx] = updated.clone();
        Ok((next, updated))
    }

    /// Remove a profile by id. Clears the active id if it was the target.
    pub fn remove(&self, id: &str) -> Result<Self, String> {
        let idx = self
            .profiles
            .iter()
            .position(|p| p.id == id)
            .ok_or_else(|| "profile not found".to_string())?;

        let mut next = self.clone();
        next.profiles.remove(idx);
        if next.active_profile_id.as_deref() == Some(id) {
            next.active_profile_id = None;
        }
        Ok(next)
    }

    /// Mark a profile as active and bump its `last_used_at`.
    pub fn set_active(&self, id: &str) -> Result<(Self, Profile), String> {
        let idx = self
            .profiles
            .iter()
            .position(|p| p.id == id)
            .ok_or_else(|| "profile not found".to_string())?;

        let mut next = self.clone();
        let existing = &self.profiles[idx];
        let touched = Profile {
            id: existing.id.clone(),
            display_name: existing.display_name.clone(),
            api_base_url: existing.api_base_url.clone(),
            created_at: existing.created_at.clone(),
            last_used_at: Some(now_rfc3339()),
        };
        next.profiles[idx] = touched.clone();
        next.active_profile_id = Some(touched.id.clone());
        Ok((next, touched))
    }

    /// Get the currently active profile if any.
    pub fn get_active(&self) -> Option<&Profile> {
        let id = self.active_profile_id.as_deref()?;
        self.profiles.iter().find(|p| p.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    struct TestEnv {
        _dir: TempDir,
        path: PathBuf,
    }

    fn fresh_env() -> TestEnv {
        let dir = TempDir::new().expect("tempdir");
        let path = store_path(dir.path());
        TestEnv { _dir: dir, path }
    }

    fn sample_input(name: &str, url: &str) -> ProfileCreateInput {
        ProfileCreateInput {
            display_name: name.to_string(),
            api_base_url: url.to_string(),
        }
    }

    #[test]
    fn roundtrip_serialize_empty_store() {
        let env = fresh_env();
        let store = ProfileStore::default();
        store.save(&env.path).expect("save");
        let loaded = ProfileStore::load(&env.path);
        assert_eq!(loaded, store);
        assert_eq!(loaded.version, STORE_VERSION);
        assert!(loaded.profiles.is_empty());
        assert!(loaded.active_profile_id.is_none());
    }

    #[test]
    fn roundtrip_serialize_with_profiles() {
        let env = fresh_env();
        let store = ProfileStore::default();
        let (store, _) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let (store, _) = store
            .add(sample_input("Staging", "https://staging.example.com"))
            .unwrap();
        store.save(&env.path).expect("save");
        let loaded = ProfileStore::load(&env.path);
        assert_eq!(loaded, store);
        assert_eq!(loaded.profiles.len(), 2);
    }

    #[test]
    fn atomic_write_leaves_no_tmp_on_success() {
        let env = fresh_env();
        let store = ProfileStore::default();
        store.save(&env.path).expect("save");
        let tmp = tmp_path(env.path.parent().unwrap());
        assert!(
            !tmp.exists(),
            "tmp file should not linger after a successful save"
        );
        assert!(env.path.exists(), "final store file must exist");
    }

    #[test]
    fn corrupt_file_triggers_backup_and_fresh_start() {
        let env = fresh_env();
        fs::create_dir_all(env.path.parent().unwrap()).unwrap();
        fs::write(&env.path, b"not json{").unwrap();

        let loaded = ProfileStore::load(&env.path);
        assert_eq!(loaded, ProfileStore::default());

        // Find the backup file.
        let parent = env.path.parent().unwrap();
        let mut found_backup = false;
        for entry in fs::read_dir(parent).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with(PROFILES_BACKUP_PREFIX) {
                found_backup = true;
                break;
            }
        }
        assert!(found_backup, "a backup file must exist after corruption");
        // Original path should no longer exist (it was renamed).
        assert!(!env.path.exists());
    }

    #[test]
    fn add_to_empty_store_sets_active() {
        let store = ProfileStore::default();
        let (next, profile) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        assert_eq!(next.profiles.len(), 1);
        assert_eq!(next.active_profile_id.as_deref(), Some(profile.id.as_str()));
        assert_eq!(profile.last_used_at, None);
        assert!(!profile.created_at.is_empty());
        assert!(!profile.id.is_empty());
    }

    #[test]
    fn add_to_nonempty_store_keeps_existing_active() {
        let store = ProfileStore::default();
        let (store, first) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let (store, second) = store
            .add(sample_input("Staging", "https://staging.example.com"))
            .unwrap();
        assert_eq!(store.profiles.len(), 2);
        assert_eq!(store.active_profile_id.as_deref(), Some(first.id.as_str()));
        assert_ne!(first.id, second.id, "each add must generate a fresh uuid");
    }

    #[test]
    fn remove_active_profile_clears_active_id() {
        let store = ProfileStore::default();
        let (store, first) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let next = store.remove(&first.id).unwrap();
        assert!(next.profiles.is_empty());
        assert!(next.active_profile_id.is_none());
    }

    #[test]
    fn remove_non_active_profile_keeps_active() {
        let store = ProfileStore::default();
        let (store, first) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let (store, second) = store
            .add(sample_input("Staging", "https://staging.example.com"))
            .unwrap();
        let next = store.remove(&second.id).unwrap();
        assert_eq!(next.profiles.len(), 1);
        assert_eq!(next.active_profile_id.as_deref(), Some(first.id.as_str()));
    }

    #[test]
    fn reject_invalid_url() {
        let store = ProfileStore::default();
        let err = store
            .add(sample_input("Bad", "not a url"))
            .expect_err("invalid url must error");
        assert!(err.starts_with("invalid url:"), "got: {err}");
    }

    #[test]
    fn update_unknown_id_returns_error() {
        let store = ProfileStore::default();
        let err = store
            .update(
                "00000000-0000-0000-0000-000000000000",
                ProfilePatch {
                    display_name: Some("x".into()),
                    api_base_url: None,
                },
            )
            .expect_err("unknown id must error");
        assert_eq!(err, "profile not found");
    }

    #[test]
    fn set_active_updates_last_used_at() {
        let store = ProfileStore::default();
        let (store, first) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let (store, second) = store
            .add(sample_input("Staging", "https://staging.example.com"))
            .unwrap();

        // Initially first is active and last_used_at is None.
        assert_eq!(store.active_profile_id.as_deref(), Some(first.id.as_str()));
        let second_before = store
            .profiles
            .iter()
            .find(|p| p.id == second.id)
            .unwrap()
            .clone();
        assert_eq!(second_before.last_used_at, None);

        let (store, touched) = store.set_active(&second.id).unwrap();
        assert_eq!(store.active_profile_id.as_deref(), Some(second.id.as_str()));
        assert!(touched.last_used_at.is_some());
        // The stored profile reflects the new timestamp.
        let stored = store.get_active().unwrap();
        assert_eq!(stored.id, second.id);
        assert_eq!(stored.last_used_at, touched.last_used_at);
    }

    #[test]
    fn update_applies_only_provided_fields() {
        let store = ProfileStore::default();
        let (store, first) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let (next, updated) = store
            .update(
                &first.id,
                ProfilePatch {
                    display_name: Some("Renamed".into()),
                    api_base_url: None,
                },
            )
            .unwrap();
        assert_eq!(updated.display_name, "Renamed");
        assert_eq!(updated.api_base_url, "http://localhost:3000");
        assert_eq!(next.profiles[0].display_name, "Renamed");
    }

    #[test]
    fn update_rejects_invalid_url_patch() {
        let store = ProfileStore::default();
        let (store, first) = store
            .add(sample_input("Local", "http://localhost:3000"))
            .unwrap();
        let err = store
            .update(
                &first.id,
                ProfilePatch {
                    display_name: None,
                    api_base_url: Some("nope".into()),
                },
            )
            .expect_err("invalid url patch must error");
        assert!(err.starts_with("invalid url:"));
    }

    #[test]
    fn remove_unknown_id_returns_error() {
        let store = ProfileStore::default();
        let err = store.remove("missing").expect_err("unknown id");
        assert_eq!(err, "profile not found");
    }

    #[test]
    fn set_active_unknown_id_returns_error() {
        let store = ProfileStore::default();
        let err = store.set_active("missing").expect_err("unknown id");
        assert_eq!(err, "profile not found");
    }
}

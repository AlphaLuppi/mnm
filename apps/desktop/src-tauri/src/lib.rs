mod commands;
mod csp;
mod profile;
mod secrets;

use std::sync::Mutex;

use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::ping,
        commands::app_info,
        commands::profile_list,
        commands::profile_get_active,
        commands::profile_add,
        commands::profile_update,
        commands::profile_remove,
        commands::profile_set_active,
        secrets::secret_set,
        secrets::secret_get,
        secrets::secret_delete,
        csp::csp_for_active_profile,
    ]);

    // In debug builds, export TS bindings on every compile.
    // In release builds, the bindings file is committed and used as-is.
    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            // Load or initialize the profile store and manage it behind a Mutex.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir unavailable: {e}"))?;
            std::fs::create_dir_all(&app_data_dir).ok();
            let store = commands::load_profile_store(&app_data_dir);
            app.manage(Mutex::new(store));

            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

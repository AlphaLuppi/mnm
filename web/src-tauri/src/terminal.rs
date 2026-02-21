use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

/// Terminal session state
pub struct TerminalSession {
    pub id: String,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub running: Arc<Mutex<bool>>,
}

unsafe impl Send for TerminalSession {}
unsafe impl Sync for TerminalSession {}

/// Global terminal manager
pub struct TerminalManager {
    pub sessions: Mutex<HashMap<String, Arc<TerminalSession>>>,
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Clone, Serialize)]
pub struct TerminalOutput {
    pub session_id: String,
    pub data: String,
}

#[derive(Clone, Serialize)]
pub struct TerminalExit {
    pub session_id: String,
    pub exit_code: i32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

/// Create a new terminal session
#[tauri::command]
pub async fn terminal_create(
    app: AppHandle,
    cols: Option<u16>,
    rows: Option<u16>,
    launch_claude: Option<bool>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let cols = cols.unwrap_or(120);
    let rows = rows.unwrap_or(30);
    let launch_claude = launch_claude.unwrap_or(false);

    log::info!("Creating terminal session {} ({}x{})", session_id, cols, rows);

    // Create PTY
    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to create PTY: {}", e))?;

    // Get shell command based on OS
    let mut cmd = if cfg!(target_os = "windows") {
        // Use cmd.exe - it doesn't have PowerShell's script execution policy issues
        CommandBuilder::new("cmd.exe")
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    };

    // Pass through ALL user environment variables (critical for Claude auth)
    // Claude Code stores auth in APPDATA on Windows, HOME on Unix
    for (key, value) in std::env::vars() {
        cmd.env(key, value);
    }

    // Explicitly ensure critical paths are set for Claude
    if cfg!(target_os = "windows") {
        // APPDATA is where Claude stores settings on Windows
        if let Ok(appdata) = std::env::var("APPDATA") {
            cmd.env("APPDATA", &appdata);
            log::info!("Setting APPDATA: {}", appdata);
        }
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            cmd.env("LOCALAPPDATA", &localappdata);
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            cmd.env("USERPROFILE", &userprofile);
            cmd.env("HOME", &userprofile);
        }
        // Ensure PATH includes npm global bin
        if let Ok(path) = std::env::var("PATH") {
            cmd.env("PATH", &path);
        }
    } else {
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", &home);
        }
    }

    // Set working directory to the project
    if let Ok(cwd) = std::env::current_dir() {
        cmd.cwd(cwd);
    }

    // Spawn shell process
    let mut child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    log::info!("Shell process spawned for session {}", session_id);

    // Get writer for input
    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;
    let writer = Arc::new(Mutex::new(writer));

    // Get reader for output
    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    // Keep master alive by storing it
    let master: Box<dyn MasterPty + Send> = pty_pair.master;
    let master = Arc::new(Mutex::new(master));

    let running = Arc::new(Mutex::new(true));

    // Create session
    let session = Arc::new(TerminalSession {
        id: session_id.clone(),
        writer: writer.clone(),
        master,
        running: running.clone(),
    });

    // Store session before spawning threads
    {
        let manager = app.state::<TerminalManager>();
        manager.sessions.lock().insert(session_id.clone(), session.clone());
    }

    // Spawn thread to read PTY output
    let session_id_reader = session_id.clone();
    let app_reader = app.clone();
    let running_reader = running.clone();
    thread::spawn(move || {
        log::info!("Reader thread started for session {}", session_id_reader);
        let mut buf = [0u8; 4096];
        loop {
            if !*running_reader.lock() {
                log::info!("Reader thread stopping (running=false) for session {}", session_id_reader);
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) => {
                    log::info!("Reader got EOF for session {}", session_id_reader);
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_reader.emit(
                        "terminal:output",
                        TerminalOutput {
                            session_id: session_id_reader.clone(),
                            data,
                        },
                    );
                }
                Err(e) => {
                    log::error!("PTY read error for session {}: {}", session_id_reader, e);
                    break;
                }
            }
        }
        log::info!("Reader thread ended for session {}", session_id_reader);
    });

    // Spawn thread to wait for process exit
    let session_id_exit = session_id.clone();
    let app_exit = app.clone();
    let running_exit = running.clone();
    thread::spawn(move || {
        log::info!("Exit watcher thread started for session {}", session_id_exit);
        let exit_status = child.wait();
        *running_exit.lock() = false;

        let exit_code = match exit_status {
            Ok(status) => {
                log::info!("Process exited with status {:?} for session {}", status, session_id_exit);
                if status.success() { 0 } else { 1 }
            }
            Err(e) => {
                log::error!("Process wait error for session {}: {}", session_id_exit, e);
                -1
            }
        };

        let _ = app_exit.emit(
            "terminal:exit",
            TerminalExit {
                session_id: session_id_exit,
                exit_code,
            },
        );
    });

    // Auto-launch Claude after a delay if requested
    if launch_claude {
        let writer_claude = writer.clone();
        thread::spawn(move || {
            // Wait for shell to be ready (PowerShell takes longer)
            thread::sleep(std::time::Duration::from_millis(2000));
            // Use \r\n for Windows line endings
            let cmd = "claude\r\n";
            if let Err(e) = writer_claude.lock().write_all(cmd.as_bytes()) {
                log::error!("Failed to auto-launch claude: {}", e);
            }
        });
    }

    log::info!("Terminal session {} created successfully", session_id);
    Ok(session_id)
}

/// Write input to terminal
#[tauri::command]
pub async fn terminal_write(
    app: AppHandle,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let manager = app.state::<TerminalManager>();
    let sessions = manager.sessions.lock();

    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    if !*session.running.lock() {
        return Err("Terminal session is not running".to_string());
    }

    session
        .writer
        .lock()
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to terminal: {}", e))?;

    Ok(())
}

/// Resize terminal
#[tauri::command]
pub async fn terminal_resize(
    app: AppHandle,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = app.state::<TerminalManager>();
    let sessions = manager.sessions.lock();

    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    session
        .master
        .lock()
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize terminal: {}", e))?;

    Ok(())
}

/// Close terminal session
#[tauri::command]
pub async fn terminal_close(app: AppHandle, session_id: String) -> Result<(), String> {
    let manager = app.state::<TerminalManager>();
    let mut sessions = manager.sessions.lock();

    if let Some(session) = sessions.remove(&session_id) {
        log::info!("Closing terminal session {}", session_id);
        *session.running.lock() = false;
    }

    Ok(())
}

/// List active terminal sessions
#[tauri::command]
pub async fn terminal_list(app: AppHandle) -> Result<Vec<String>, String> {
    let manager = app.state::<TerminalManager>();
    let sessions = manager.sessions.lock();
    Ok(sessions.keys().cloned().collect())
}

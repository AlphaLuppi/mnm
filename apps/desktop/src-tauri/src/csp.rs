//! Dynamic Content-Security-Policy derived from the active connection profile.
//!
//! The packaged desktop app cannot know at build time which backend URL a
//! given user will talk to, so the static CSP field in `tauri.conf.json`
//! would either be too loose (a wildcard) or forbid legitimate hosts. We
//! instead keep the static CSP null and inject a strict meta-tag CSP at
//! boot, with `connect-src` pinned to the active profile's origin plus its
//! WebSocket counterpart. On profile switch the window reloads (see
//! `NoProfileGate`), which rebuilds the CSP from scratch.
//!
//! Pure functions (`build_csp`, `derive_ws_origin`) live here with unit
//! tests; the Tauri command `csp_for_active_profile` binds them to the
//! in-memory profile store.

use std::sync::Mutex;

use tauri::State;
use url::Url;

use crate::profile::ProfileStore;

/// Tauri-internal origins that must always be allowed so that IPC, the
/// custom protocol, and the asset loader keep working across platforms.
/// - `ipc:` / `http://ipc.localhost` cover macOS/Linux and Windows respectively.
/// - `tauri:` / `https://tauri.localhost` cover the webview bootstrap origin.
/// - `asset:` / `https://asset.localhost` are listed so future use of the
///   asset protocol does not silently break if someone enables it later.
const TAURI_CONNECT: &[&str] = &[
    "ipc:",
    "http://ipc.localhost",
    "tauri:",
    "https://tauri.localhost",
    "asset:",
    "https://asset.localhost",
];

/// Build the origin string (scheme://host[:port]) from a parsed URL.
/// `url::Url::origin()` returns an `Origin` enum; for http(s) URLs its
/// `ascii_serialization()` already has the exact form we want, minus the
/// trailing path. For opaque origins we fall back to the raw URL string.
fn origin_of(url: &Url) -> String {
    url.origin().ascii_serialization()
}

/// Convert an http(s) origin into the matching ws(s) origin. Returns an
/// error if the URL is not http or https (CSP `connect-src` only makes
/// sense for those schemes on our stack).
pub fn derive_ws_origin(api_base_url: &str) -> Result<String, String> {
    let url = Url::parse(api_base_url).map_err(|e| format!("invalid url: {e}"))?;
    let scheme = url.scheme();
    let ws_scheme = match scheme {
        "http" => "ws",
        "https" => "wss",
        other => return Err(format!("unsupported scheme for ws derivation: {other}")),
    };
    let host = url
        .host_str()
        .ok_or_else(|| "url has no host".to_string())?;

    let port_segment = match url.port() {
        Some(p) => format!(":{p}"),
        None => String::new(),
    };
    Ok(format!("{ws_scheme}://{host}{port_segment}"))
}

/// Assemble the strict CSP string for a given backend URL.
///
/// The returned value is suitable for a `<meta http-equiv="Content-Security-Policy">`
/// tag. It intentionally keeps `'unsafe-inline'` in `script-src` and
/// `style-src` because Tauri 2 and our Tailwind/React pipeline still emit
/// inline markers; tightening to nonces is tracked as a follow-up on the
/// `strict-csp` desktop-native feature.
pub fn build_csp(api_base_url: &str) -> Result<String, String> {
    let url = Url::parse(api_base_url).map_err(|e| format!("invalid url: {e}"))?;
    match url.scheme() {
        "http" | "https" => {}
        other => return Err(format!("unsupported scheme: {other}")),
    }
    if url.host_str().is_none() {
        return Err("url has no host".to_string());
    }

    let api_origin = origin_of(&url);
    let ws_origin = derive_ws_origin(api_base_url)?;

    let mut connect_sources: Vec<String> = Vec::with_capacity(TAURI_CONNECT.len() + 3);
    connect_sources.push("'self'".to_string());
    for src in TAURI_CONNECT {
        connect_sources.push((*src).to_string());
    }
    connect_sources.push(api_origin);
    connect_sources.push(ws_origin);

    let connect_src = connect_sources.join(" ");

    // Directives separated by "; " as per the CSP grammar. No trailing ";"
    // required but harmless; we omit it so tests can pattern-match cleanly.
    let directives = [
        "default-src 'self'".to_string(),
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'".to_string(),
        "style-src 'self' 'unsafe-inline'".to_string(),
        "img-src 'self' data: blob: https:".to_string(),
        "font-src 'self' data:".to_string(),
        format!("connect-src {connect_src}"),
        "worker-src 'self' blob:".to_string(),
        "frame-src 'none'".to_string(),
        "object-src 'none'".to_string(),
        "base-uri 'self'".to_string(),
        "form-action 'self'".to_string(),
    ];

    Ok(directives.join("; "))
}

/// Tauri command: build a CSP string from the currently active connection
/// profile. Returns an error if no profile is active so the TS side can
/// decide whether to block the boot sequence.
#[tauri::command]
#[specta::specta]
pub fn csp_for_active_profile(state: State<'_, Mutex<ProfileStore>>) -> Result<String, String> {
    let guard = state
        .lock()
        .map_err(|e| format!("profile store mutex poisoned: {e}"))?;
    let profile = guard
        .get_active()
        .ok_or_else(|| "no active profile".to_string())?;
    build_csp(&profile.api_base_url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_ws_from_http_localhost_with_port() {
        let ws = derive_ws_origin("http://localhost:3100").unwrap();
        assert_eq!(ws, "ws://localhost:3100");
    }

    #[test]
    fn derive_ws_from_https_default_port() {
        let ws = derive_ws_origin("https://api.example.com").unwrap();
        assert_eq!(ws, "wss://api.example.com");
    }

    #[test]
    fn derive_ws_from_https_with_path_ignores_path() {
        let ws = derive_ws_origin("https://api.example.com/v1/").unwrap();
        assert_eq!(ws, "wss://api.example.com");
    }

    #[test]
    fn derive_ws_from_http_with_custom_port() {
        let ws = derive_ws_origin("http://10.0.0.5:8080").unwrap();
        assert_eq!(ws, "ws://10.0.0.5:8080");
    }

    #[test]
    fn derive_ws_rejects_invalid_url() {
        let err = derive_ws_origin("not a url").expect_err("invalid");
        assert!(err.starts_with("invalid url:"), "got: {err}");
    }

    #[test]
    fn derive_ws_rejects_non_http_scheme() {
        let err = derive_ws_origin("ftp://example.com").expect_err("unsupported");
        assert!(err.contains("unsupported scheme"), "got: {err}");
    }

    #[test]
    fn build_csp_contains_api_and_ws_origins() {
        let csp = build_csp("http://localhost:3100").unwrap();
        assert!(csp.contains("http://localhost:3100"));
        assert!(csp.contains("ws://localhost:3100"));
    }

    #[test]
    fn build_csp_contains_tauri_internal_schemes() {
        let csp = build_csp("https://api.example.com").unwrap();
        for scheme in TAURI_CONNECT {
            assert!(csp.contains(scheme), "missing {scheme} in: {csp}");
        }
    }

    #[test]
    fn build_csp_locks_down_frames_and_objects() {
        let csp = build_csp("https://api.example.com").unwrap();
        assert!(csp.contains("frame-src 'none'"));
        assert!(csp.contains("object-src 'none'"));
    }

    #[test]
    fn build_csp_contains_every_mandatory_directive() {
        let csp = build_csp("https://api.example.com").unwrap();
        for directive in [
            "default-src",
            "script-src",
            "style-src",
            "img-src",
            "font-src",
            "connect-src",
            "worker-src",
            "frame-src",
            "object-src",
            "base-uri",
            "form-action",
        ] {
            assert!(
                csp.contains(directive),
                "CSP missing directive {directive}: {csp}"
            );
        }
    }

    #[test]
    fn build_csp_uses_self_for_default_src() {
        let csp = build_csp("https://api.example.com").unwrap();
        assert!(csp.contains("default-src 'self'"));
    }

    #[test]
    fn build_csp_rejects_invalid_url() {
        let err = build_csp("definitely not a url").expect_err("invalid");
        assert!(err.starts_with("invalid url:"), "got: {err}");
    }

    #[test]
    fn build_csp_rejects_non_http_scheme() {
        let err = build_csp("file:///etc/passwd").expect_err("unsupported");
        assert!(err.contains("unsupported scheme"), "got: {err}");
    }

    #[test]
    fn build_csp_does_not_include_other_profile_hosts() {
        // Sanity: CSP for profile A must not accidentally leak a hard-coded
        // domain from profile B.
        let csp = build_csp("https://staging.example.com").unwrap();
        assert!(!csp.contains("api.example.com"));
        assert!(csp.contains("https://staging.example.com"));
        assert!(csp.contains("wss://staging.example.com"));
    }

    #[test]
    fn build_csp_https_does_not_introduce_plain_ws() {
        let csp = build_csp("https://api.example.com").unwrap();
        // We must use wss:// for https backends, never ws://.
        // Guard against a regression that picks the wrong scheme.
        let connect_src_start = csp
            .find("connect-src ")
            .expect("CSP has no connect-src directive");
        let connect_src_rest = &csp[connect_src_start..];
        let connect_src_end = connect_src_rest
            .find(';')
            .map(|i| connect_src_start + i)
            .unwrap_or(csp.len());
        let connect_src = &csp[connect_src_start..connect_src_end];
        assert!(
            !connect_src.contains("ws://api.example.com"),
            "connect-src must not contain plain ws:// for an https backend: {connect_src}"
        );
        assert!(connect_src.contains("wss://api.example.com"));
    }
}

//! Desktop till app. It shows the retail system's own web pages full-screen, and adds what a browser
//! can't do well: printing receipts straight to the printer (ESC/POS), opening the cash drawer,
//! starting with Windows, and staying locked to the till.

mod printing;

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_opener::OpenerExt as _;

const MAIN: &str = "main";

/// Saved on this PC only (app config folder), never sent to the server.
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
struct Config {
    server_url: String,
    receipt_printer: Option<String>,
    /// Characters per line: 48 for 80 mm paper, 32 for 58 mm.
    paper_width: u8,
    cash_drawer: bool,
    kiosk: bool,
    autostart: bool,
    /// Needed to open settings or exit while in kiosk mode. Empty = no PIN.
    exit_pin: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            receipt_printer: None,
            paper_width: 48,
            cash_drawer: true,
            kiosk: true,
            autostart: true,
            exit_pin: String::new(),
        }
    }
}

/// What pages are allowed to see: everything except the PIN itself.
#[derive(Serialize)]
struct ConfigView {
    server_url: String,
    receipt_printer: Option<String>,
    paper_width: u8,
    cash_drawer: bool,
    kiosk: bool,
    autostart: bool,
    has_exit_pin: bool,
}

#[derive(Deserialize)]
struct ConfigInput {
    server_url: String,
    receipt_printer: Option<String>,
    paper_width: u8,
    cash_drawer: bool,
    kiosk: bool,
    autostart: bool,
    /// None keeps the current PIN; Some("") removes it.
    exit_pin: Option<String>,
}

struct AppState {
    config: Mutex<Config>,
    allow_close: Mutex<bool>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("till-config.json"))
}

fn load_config(app: &AppHandle) -> Config {
    config_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// The bundled settings page.
fn settings_url() -> Url {
    let base = if cfg!(windows) { "http://tauri.localhost/index.html" } else { "tauri://localhost/index.html" };
    Url::parse(base).expect("valid settings url")
}

fn till_url(config: &Config) -> Option<Url> {
    Url::parse(&config.server_url).ok()?.join("/app/pos").ok()
}

/// Only the configured server and the bundled settings page may load in the window.
fn navigation_allowed(app: &AppHandle, url: &Url) -> bool {
    if url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") || url.as_str() == "about:blank" {
        return true;
    }
    let state = app.state::<AppState>();
    let config = state.config.lock().unwrap();
    match Url::parse(&config.server_url) {
        Ok(server) => server.origin() == url.origin(),
        Err(_) => false,
    }
}

fn check_pin(state: &State<AppState>, pin: Option<String>) -> Result<(), String> {
    let config = state.config.lock().unwrap();
    if config.kiosk && !config.exit_pin.is_empty() && pin.as_deref() != Some(config.exit_pin.as_str()) {
        return Err("Wrong PIN.".into());
    }
    Ok(())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> ConfigView {
    let c = state.config.lock().unwrap();
    ConfigView {
        server_url: c.server_url.clone(),
        receipt_printer: c.receipt_printer.clone(),
        paper_width: c.paper_width,
        cash_drawer: c.cash_drawer,
        kiosk: c.kiosk,
        autostart: c.autostart,
        has_exit_pin: !c.exit_pin.is_empty(),
    }
}

#[tauri::command]
fn save_config(app: AppHandle, state: State<AppState>, config: ConfigInput) -> Result<(), String> {
    let server = Url::parse(config.server_url.trim())
        .map_err(|_| "Enter the full server address, e.g. https://shop.example.com".to_string())?;
    if server.scheme() != "https" && server.host_str() != Some("localhost") && server.host_str() != Some("127.0.0.1") {
        return Err("The server address must start with https:// (http:// is only allowed for localhost).".into());
    }
    if config.paper_width != 48 && config.paper_width != 32 {
        return Err("Choose 80 mm or 58 mm paper.".into());
    }

    let mut current = state.config.lock().unwrap();
    current.server_url = server.origin().ascii_serialization();
    current.receipt_printer = config.receipt_printer.filter(|p| !p.is_empty());
    current.paper_width = config.paper_width;
    current.cash_drawer = config.cash_drawer;
    current.kiosk = config.kiosk;
    current.autostart = config.autostart;
    if let Some(pin) = config.exit_pin {
        if !pin.is_empty() && (pin.len() < 4 || !pin.chars().all(|c| c.is_ascii_digit())) {
            return Err("The PIN must be at least 4 digits.".into());
        }
        current.exit_pin = pin;
    }

    let json = serde_json::to_string_pretty(&*current).map_err(|e| e.to_string())?;
    fs::write(config_path(&app)?, json).map_err(|e| format!("Couldn't save settings: {e}"))?;

    let autolaunch = app.autolaunch();
    let _ = if current.autostart { autolaunch.enable() } else { autolaunch.disable() };
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.set_fullscreen(current.kiosk);
    }
    Ok(())
}

#[tauri::command]
fn list_printers() -> Result<Vec<String>, String> {
    printing::list_printers()
}

#[tauri::command]
fn print_raw(app: AppHandle, state: State<AppState>, data: Vec<u8>) -> Result<(), String> {
    let printer = state
        .config
        .lock()
        .unwrap()
        .receipt_printer
        .clone()
        .ok_or("No receipt printer is set up. Press Ctrl+Shift+S for till settings.")?;
    printing::print_raw(&printer, &data, app.path().document_dir().ok())
}

#[tauri::command]
fn test_print(app: AppHandle, printer: String, paper_width: u8, cash_drawer: bool) -> Result<(), String> {
    printing::print_raw(&printer, &printing::test_page(paper_width, cash_drawer), app.path().document_dir().ok())
}

#[tauri::command]
fn open_server(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let url = till_url(&state.config.lock().unwrap()).ok_or("Set the server address first.")?;
    let window = app.get_webview_window(MAIN).ok_or("No window")?;
    window.navigate(url).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings(app: AppHandle, state: State<AppState>, pin: Option<String>) -> Result<(), String> {
    check_pin(&state, pin)?;
    let window = app.get_webview_window(MAIN).ok_or("No window")?;
    window.navigate(settings_url()).map_err(|e| e.to_string())
}

#[tauri::command]
fn exit_app(app: AppHandle, state: State<AppState>, pin: Option<String>) -> Result<(), String> {
    check_pin(&state, pin)?;
    *state.allow_close.lock().unwrap() = true;
    app.exit(0);
    Ok(())
}

/// Links to other sites (e.g. WhatsApp) open in the PC's normal browser, never inside the till.
#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Invalid link")?;
    if parsed.scheme() != "https" {
        return Err("Only https links can be opened.".into());
    }
    app.opener().open_url(parsed.as_str(), None::<&str>).map_err(|e| e.to_string())
}

/// Injected into every page: settings/exit shortcuts, and external links sent to the system browser.
const PAGE_SCRIPT: &str = r#"
(() => {
  const invoke = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);
  const withPin = async (cmd) => {
    const config = await invoke("get_config");
    const pin = config.kiosk && config.has_exit_pin ? window.prompt("Manager PIN") : null;
    if (config.kiosk && config.has_exit_pin && pin === null) return;
    try { await invoke(cmd, { pin }); } catch (e) { window.alert(e); }
  };
  document.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || !e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key === "s") { e.preventDefault(); withPin("open_settings"); }
    if (key === "q") { e.preventDefault(); withPin("exit_app"); }
  }, true);
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) {
      e.preventDefault();
      invoke("open_external", { url: url.href }).catch((err) => window.alert(err));
    } else if (a.target === "_blank") {
      e.preventDefault();
      location.href = url.href;
    }
  }, true);
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Starting the till again just brings the existing window forward.
            if let Some(window) = app.get_webview_window(MAIN) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_printers,
            print_raw,
            test_print,
            open_server,
            open_settings,
            exit_app,
            open_external
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let config = load_config(&handle);
            let start = match till_url(&config) {
                Some(url) => WebviewUrl::External(url),
                None => WebviewUrl::App("index.html".into()),
            };
            let kiosk = config.kiosk;
            app.manage(AppState { config: Mutex::new(config), allow_close: Mutex::new(false) });

            let nav_handle = handle.clone();
            let window = WebviewWindowBuilder::new(app, MAIN, start)
                .title("Till")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .fullscreen(kiosk)
                .initialization_script(PAGE_SCRIPT)
                .on_navigation(move |url| navigation_allowed(&nav_handle, url))
                .build()?;

            // In kiosk mode the window can't be closed (Alt+F4, taskbar) except via Ctrl+Shift+Q.
            let close_handle = handle.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let state = close_handle.state::<AppState>();
                    let kiosk = state.config.lock().unwrap().kiosk;
                    if kiosk && !*state.allow_close.lock().unwrap() {
                        api.prevent_close();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the till app");
}

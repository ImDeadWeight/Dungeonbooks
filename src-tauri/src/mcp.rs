//! AI connections: lets AI apps (Claude Code, Claude Desktop and others that
//! speak the Model Context Protocol) use Dungeon Books' tools on the open
//! campaign's notes.
//!
//! The app runs a small HTTP server on 127.0.0.1 (MCP's "Streamable HTTP",
//! plain JSON replies only). Each request is handed to the web UI, which owns
//! the notes and answers it (src/assistant/connection.ts), and the answer goes
//! back as the response. Only requests from this computer that carry the
//! connection's token are accepted, and none from web pages (which send an
//! Origin header). The server runs only while connections are switched on.
//!
//! Apps that start their tools as a program reading and writing JSON-RPC lines
//! (Claude Desktop) run this executable with `--mcp-stdio` instead: it relays
//! each line to the running app's server, starting the app if needed.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

/// The app's identifier (tauri.conf.json): its data folder's name.
const IDENTIFIER: &str = "com.dungeonbooks.app";
/// Settings file in the app's data folder.
const CONFIG_FILE: &str = "ai-connection.json";
const DEFAULT_PORT: u16 = 47615;
/// Longest a tool call may take before the AI app is told it timed out.
const REPLY_TIMEOUT: Duration = Duration::from_secs(120);
/// Largest request accepted.
const MAX_BODY: u64 = 4 * 1024 * 1024;

/// What is saved: switched on or not, the port, and the token AI apps must send.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    enabled: bool,
    port: u16,
    token: String,
}

/// Where the settings live; the same path Tauri's app_data_dir gives, worked out without Tauri for `--mcp-stdio`.
fn config_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("APPDATA").map(PathBuf::from);
    #[cfg(target_os = "macos")]
    let base = std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Application Support"));
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")));
    base.map(|b| b.join(IDENTIFIER).join(CONFIG_FILE))
}

fn new_token() -> String {
    let mut bytes = [0u8; 24];
    getrandom::getrandom(&mut bytes).expect("no random numbers available");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn read_config() -> Option<Config> {
    let text = std::fs::read_to_string(config_path()?).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_config(config: &Config) -> Result<(), String> {
    let path = config_path().ok_or("no data folder")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| e.to_string())
}

/// The connection's state in the running app.
pub struct Mcp {
    config: Mutex<Config>,
    server: Mutex<Option<Arc<tiny_http::Server>>>,
    /// Why the server isn't running although switched on (e.g. the port is taken).
    error: Mutex<Option<String>>,
    /// Requests waiting for the web UI's answer, by number.
    pending: Mutex<HashMap<u64, mpsc::Sender<String>>>,
    next_id: AtomicU64,
    /// The web UI is listening for requests (it has loaded).
    attached: AtomicBool,
}

/// What the Connect AI dialog shows.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    enabled: bool,
    running: bool,
    port: u16,
    token: String,
    error: Option<String>,
    /// This program, for setting up apps that start it with --mcp-stdio.
    executable: String,
}

/// A request handed to the web UI.
#[derive(Serialize, Clone)]
struct McpRequest {
    id: u64,
    body: String,
}

impl Mcp {
    /// Loads the settings (making them on first use) and starts the server if switched on.
    pub fn start(app: &AppHandle) -> Self {
        let config = read_config().unwrap_or_else(|| Config { enabled: false, port: DEFAULT_PORT, token: new_token() });
        let _ = write_config(&config);
        let mcp = Mcp {
            config: Mutex::new(config),
            server: Mutex::new(None),
            error: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            attached: AtomicBool::new(false),
        };
        mcp.restart(app);
        mcp
    }

    /// Stops the server, and starts it again with the current settings if switched on.
    fn restart(&self, app: &AppHandle) {
        if let Some(old) = self.server.lock().unwrap().take() {
            old.unblock();
        }
        *self.error.lock().unwrap() = None;
        let config = self.config.lock().unwrap().clone();
        if !config.enabled {
            return;
        }
        match tiny_http::Server::http(("127.0.0.1", config.port)) {
            Ok(server) => {
                let server = Arc::new(server);
                *self.server.lock().unwrap() = Some(server.clone());
                let app = app.clone();
                std::thread::spawn(move || serve(app, server, config));
            }
            Err(e) => *self.error.lock().unwrap() = Some(format!("Couldn't use port {}: {e}", config.port)),
        }
    }

    fn status(&self) -> Status {
        let config = self.config.lock().unwrap();
        Status {
            enabled: config.enabled,
            running: self.server.lock().unwrap().is_some(),
            port: config.port,
            token: config.token.clone(),
            error: self.error.lock().unwrap().clone(),
            executable: std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_default(),
        }
    }

    /// Hands a request body to the web UI and waits for its answer.
    fn dispatch(&self, app: &AppHandle, body: String) -> Result<String, &'static str> {
        if !self.attached.load(Ordering::SeqCst) {
            return Err("Dungeon Books is still starting");
        }
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = mpsc::channel();
        self.pending.lock().unwrap().insert(id, tx);
        let sent = app.emit_to("main", "mcp-request", McpRequest { id, body });
        let reply = match sent {
            Ok(()) => rx.recv_timeout(REPLY_TIMEOUT).map_err(|_| "Dungeon Books took too long to answer"),
            Err(_) => Err("Dungeon Books' window isn't open"),
        };
        self.pending.lock().unwrap().remove(&id);
        reply
    }
}

/// Answers requests until the server is stopped; each on its own thread, as it waits for the web UI.
fn serve(app: AppHandle, server: Arc<tiny_http::Server>, config: Config) {
    for request in server.incoming_requests() {
        let app = app.clone();
        let config = config.clone();
        std::thread::spawn(move || handle(&app, request, &config));
    }
}

fn header(request: &tiny_http::Request, name: &'static str) -> Option<String> {
    request.headers().iter().find(|h| h.field.equiv(name)).map(|h| h.value.as_str().to_string())
}

fn respond(request: tiny_http::Request, status: u16, body: &str) {
    let json = tiny_http::Header::from_bytes("Content-Type", "application/json").unwrap();
    let response = tiny_http::Response::from_string(body).with_status_code(status).with_header(json);
    let _ = request.respond(response);
}

/// A JSON-RPC error body (id unknown at this level).
fn rpc_error(message: &str) -> String {
    serde_json::json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32000, "message": message } }).to_string()
}

fn handle(app: &AppHandle, mut request: tiny_http::Request, config: &Config) {
    // Web pages send an Origin; AI apps don't. Refusing them keeps websites out (with the Host check, also via DNS rebinding).
    if header(&request, "Origin").is_some() {
        return respond(request, 403, &rpc_error("Requests from web pages are not accepted"));
    }
    let host_ok = header(&request, "Host")
        .map(|h| h == format!("127.0.0.1:{}", config.port) || h == format!("localhost:{}", config.port))
        .unwrap_or(false);
    if !host_ok {
        return respond(request, 403, &rpc_error("Wrong host"));
    }
    if header(&request, "Authorization").as_deref() != Some(&format!("Bearer {}", config.token)) {
        return respond(request, 401, &rpc_error("Missing or wrong token: copy the setup from Dungeon Books' Connect AI dialog"));
    }
    if request.url().split('?').next() != Some("/mcp") {
        return respond(request, 404, &rpc_error("The endpoint is /mcp"));
    }
    if *request.method() != tiny_http::Method::Post {
        // No server-sent event streams: every answer comes back as the POST's response.
        let allow = tiny_http::Header::from_bytes("Allow", "POST").unwrap();
        let _ = request.respond(tiny_http::Response::empty(405).with_header(allow));
        return;
    }
    let mut body = String::new();
    if request.as_reader().take(MAX_BODY).read_to_string(&mut body).is_err() {
        return respond(request, 400, &rpc_error("Unreadable request"));
    }
    let mcp = app.state::<Mcp>();
    match mcp.dispatch(app, body) {
        // Notifications and responses get no answer.
        Ok(reply) if reply.is_empty() => {
            let _ = request.respond(tiny_http::Response::empty(202));
        }
        Ok(reply) => respond(request, 200, &reply),
        Err(message) => respond(request, 503, &rpc_error(message)),
    }
}

/// The web UI is ready for requests (it calls this once it is listening).
#[tauri::command]
pub fn mcp_attach(mcp: State<Mcp>) {
    mcp.attached.store(true, Ordering::SeqCst);
}

/// The web UI's answer to a request.
#[tauri::command]
pub fn mcp_reply(mcp: State<Mcp>, id: u64, body: String) {
    if let Some(tx) = mcp.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(body);
    }
}

#[tauri::command]
pub fn ai_connection_status(mcp: State<Mcp>) -> Status {
    mcp.status()
}

/// Switches connections on or off.
#[tauri::command]
pub fn ai_connection_set_enabled(app: AppHandle, mcp: State<Mcp>, enabled: bool) -> Result<Status, String> {
    {
        let mut config = mcp.config.lock().unwrap();
        config.enabled = enabled;
        write_config(&config)?;
    }
    mcp.restart(&app);
    Ok(mcp.status())
}

/// Makes a new token, so apps set up with the old one can no longer connect.
#[tauri::command]
pub fn ai_connection_new_token(app: AppHandle, mcp: State<Mcp>) -> Result<Status, String> {
    {
        let mut config = mcp.config.lock().unwrap();
        config.token = new_token();
        write_config(&config)?;
    }
    mcp.restart(&app);
    Ok(mcp.status())
}

// ---- --mcp-stdio ---------------------------------------------------------------

/// How long to wait for the app to start and switch its server on.
const START_TIMEOUT: Duration = Duration::from_secs(30);

/// Writes a JSON-RPC error for the request on `line` (nothing for notifications).
fn stdio_error(out: &mut impl Write, line: &str, message: &str) {
    let Ok(message_json) = serde_json::from_str::<serde_json::Value>(line) else { return };
    let Some(id) = message_json.get("id").filter(|id| !id.is_null()) else { return };
    let error = serde_json::json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32000, "message": message } });
    let _ = writeln!(out, "{error}");
    let _ = out.flush();
}

/// Sends one message to the running app; Err(None) when the app isn't there to answer.
fn post(config: &Config, line: &str) -> Result<String, Option<String>> {
    let url = format!("http://127.0.0.1:{}/mcp", config.port);
    let result = ureq::post(&url)
        .set("Authorization", &format!("Bearer {}", config.token))
        .set("Content-Type", "application/json")
        .set("Accept", "application/json, text/event-stream")
        .timeout(REPLY_TIMEOUT + Duration::from_secs(5))
        .send_string(line);
    match result {
        Ok(response) if response.status() == 202 => Ok(String::new()),
        Ok(response) => response.into_string().map_err(|e| Some(e.to_string())),
        Err(ureq::Error::Status(503, _)) => Err(None),
        Err(ureq::Error::Status(_, response)) => Err(Some(response.into_string().unwrap_or_default())),
        Err(_) => Err(None),
    }
}

/// Starts the app (it shows its window as usual) without passing it this program's input and output.
fn start_app() {
    let Ok(exe) = std::env::current_exe() else { return };
    // Windows hands a started program every inheritable handle, so the app would keep the AI app's pipe
    // open after this relay ends. `start` launches it through the shell, which passes none on.
    #[cfg(target_os = "windows")]
    let mut command = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut command = std::process::Command::new("cmd");
        command.args(["/C", "start", ""]).arg(exe).creation_flags(CREATE_NO_WINDOW);
        command
    };
    #[cfg(not(target_os = "windows"))]
    let mut command = std::process::Command::new(exe);
    let _ = command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
}

/// Relays JSON-RPC lines between stdin/stdout and the running app until stdin closes. Returns the exit code.
pub fn run_stdio() -> i32 {
    let stdin = std::io::stdin();
    let mut out = std::io::stdout();
    let mut started = false;
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let deadline = Instant::now() + START_TIMEOUT;
        loop {
            let Some(config) = read_config() else {
                stdio_error(&mut out, &line, "Dungeon Books hasn't been set up for AI connections: open it and use Connect AI.");
                break;
            };
            if !config.enabled {
                stdio_error(&mut out, &line, "AI connections are switched off in Dungeon Books: switch them on in its Connect AI dialog.");
                break;
            }
            match post(&config, &line) {
                Ok(reply) => {
                    if !reply.is_empty() {
                        let _ = writeln!(out, "{reply}");
                        let _ = out.flush();
                    }
                    break;
                }
                Err(Some(error)) => {
                    // The app refused it; its body is a JSON-RPC error when it could make one.
                    let message = serde_json::from_str::<serde_json::Value>(&error)
                        .ok()
                        .and_then(|v| v["error"]["message"].as_str().map(str::to_string))
                        .unwrap_or(error);
                    stdio_error(&mut out, &line, &message);
                    break;
                }
                Err(None) => {
                    if !started {
                        start_app();
                        started = true;
                    }
                    if Instant::now() > deadline {
                        stdio_error(&mut out, &line, "Dungeon Books isn't answering: open it, and check that AI connections are on.");
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
            }
        }
    }
    0
}

/// Registers the connection with the app (called from setup).
pub fn setup(app: &AppHandle) {
    let mcp = Mcp::start(app);
    app.manage(mcp);
}

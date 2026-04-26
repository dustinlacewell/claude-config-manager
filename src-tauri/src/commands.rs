use ignore::{WalkBuilder, WalkState};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};

#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    /// mtime in milliseconds since UNIX epoch; 0 if unavailable.
    pub mtime: u64,
    /// File size in bytes; 0 if unavailable or if this is a directory.
    pub size: u64,
}

async fn stamp_for(e: &tokio::fs::DirEntry, is_file: bool) -> (u64, u64) {
    let meta = match e.metadata().await {
        Ok(m) => m,
        Err(_) => return (0, 0),
    };
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let size = if is_file { meta.len() } else { 0 };
    (mtime, size)
}

#[derive(Serialize, Clone)]
pub struct FsChange {
    pub kind: String,
    pub paths: Vec<String>,
}

#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

fn to_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "home directory not found".into())
}

#[tauri::command]
pub async fn read_text(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await.map_err(to_err)
}

#[tauri::command]
pub async fn write_text(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(to_err)?;
    }
    tokio::fs::write(&path, contents).await.map_err(to_err)
}

#[tauri::command]
pub async fn read_json(path: String) -> Result<serde_json::Value, String> {
    let text = tokio::fs::read_to_string(&path).await.map_err(to_err)?;
    serde_json::from_str(&text).map_err(to_err)
}

#[tauri::command]
pub async fn write_json(path: String, value: serde_json::Value) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(to_err)?;
    }
    let text = serde_json::to_string_pretty(&value).map_err(to_err)?;
    tokio::fs::write(&path, text).await.map_err(to_err)
}

#[tauri::command]
pub async fn path_exists(path: String) -> Result<bool, String> {
    Ok(tokio::fs::try_exists(&path).await.unwrap_or(false))
}

#[tauri::command]
pub async fn ensure_dir(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path).await.map_err(to_err)
}

#[tauri::command]
pub async fn remove_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        tokio::fs::remove_dir_all(&p).await.map_err(to_err)
    } else {
        tokio::fs::remove_file(&p).await.map_err(to_err)
    }
}

#[tauri::command]
pub async fn rename_path(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(to_err)?;
    }
    tokio::fs::rename(&from, &to).await.map_err(to_err)
}

#[tauri::command]
pub async fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let mut rd = match tokio::fs::read_dir(&path).await {
        Ok(rd) => rd,
        Err(_) => return Ok(entries),
    };
    while let Ok(Some(e)) = rd.next_entry().await {
        let ft = match e.file_type().await {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        let (mtime, size) = stamp_for(&e, ft.is_file()).await;
        entries.push(DirEntry {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            is_dir: ft.is_dir(),
            is_file: ft.is_file(),
            mtime,
            size,
        });
    }
    Ok(entries)
}

#[tauri::command]
pub async fn list_dir_recursive(
    path: String,
    max_depth: Option<usize>,
) -> Result<Vec<DirEntry>, String> {
    let mut out = Vec::new();
    let root = PathBuf::from(&path);
    let max = max_depth.unwrap_or(8);
    walk(&root, 0, max, &mut out).await;
    Ok(out)
}

fn walk<'a>(
    dir: &'a Path,
    depth: usize,
    max: usize,
    out: &'a mut Vec<DirEntry>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        if depth > max {
            return;
        }
        let mut rd = match tokio::fs::read_dir(dir).await {
            Ok(rd) => rd,
            Err(_) => return,
        };
        while let Ok(Some(e)) = rd.next_entry().await {
            let ft = match e.file_type().await {
                Ok(ft) => ft,
                Err(_) => continue,
            };
            let p = e.path();
            let (mtime, size) = stamp_for(&e, ft.is_file()).await;
            out.push(DirEntry {
                name: e.file_name().to_string_lossy().into_owned(),
                path: p.to_string_lossy().into_owned(),
                is_dir: ft.is_dir(),
                is_file: ft.is_file(),
                mtime,
                size,
            });
            if ft.is_dir() {
                walk(&p, depth + 1, max, out).await;
            }
        }
    })
}

/// Directories we never descend into during tree walks. Consolidated here so
/// the two walkers (`scan_for_projects`, `find_files_named`) stay in lockstep.
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    ".git",
    ".next",
    ".cache",
    ".deleted",
    "__pycache__",
];

fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIRS.iter().any(|d| *d == name)
}

/// Parallel, gitignore-aware walk that collects every file whose name matches
/// `name`. Each hit carries its stamp (`mtime`, `size`) so adapters can
/// cache-hit without a follow-up stat.
///
/// Dramatically faster than the generic `list_dir_recursive` for targeted
/// lookups (e.g. finding every `CLAUDE.md` in a project) because it skips
/// `node_modules/`, `target/`, gitignored paths, etc. at the walker level
/// rather than filtering after the fact.
#[tauri::command]
pub async fn find_files_named(
    root: String,
    name: String,
    max_depth: Option<usize>,
) -> Result<Vec<DirEntry>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.exists() {
        return Ok(Vec::new());
    }
    let depth = max_depth.unwrap_or(8);
    let target = Arc::new(name);
    let hits: Arc<Mutex<Vec<DirEntry>>> = Arc::new(Mutex::new(Vec::new()));

    let walker = WalkBuilder::new(&root_path)
        .max_depth(Some(depth))
        .hidden(false)
        .follow_links(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(false)
        .require_git(false)
        .filter_entry(|e| {
            let n = e.file_name().to_str().unwrap_or("");
            !is_ignored_dir(n)
        })
        .build_parallel();

    walker.run(|| {
        let hits = Arc::clone(&hits);
        let target = Arc::clone(&target);
        Box::new(move |result| {
            let entry = match result {
                Ok(e) => e,
                Err(_) => return WalkState::Continue,
            };
            let path = entry.path();
            let fname = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n,
                None => return WalkState::Continue,
            };
            if fname != target.as_str() {
                return WalkState::Continue;
            }
            let ft = match entry.file_type() {
                Some(ft) => ft,
                None => return WalkState::Continue,
            };
            if !ft.is_file() {
                return WalkState::Continue;
            }
            let meta = entry.metadata().ok();
            let mtime = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let hit = DirEntry {
                name: fname.to_string(),
                path: path.to_string_lossy().into_owned(),
                is_dir: false,
                is_file: true,
                mtime,
                size,
            };
            if let Ok(mut m) = hits.lock() {
                m.push(hit);
            }
            WalkState::Continue
        })
    });

    let mut guard = hits.lock().map_err(|e| e.to_string())?;
    Ok(std::mem::take(&mut *guard))
}

#[derive(Serialize)]
pub struct ProjectHit {
    pub path: String,
    pub has_claude_md: bool,
    pub has_claude_dir: bool,
}

#[tauri::command]
pub async fn scan_for_projects(
    root: String,
    max_depth: Option<usize>,
) -> Result<Vec<ProjectHit>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.exists() {
        return Err(format!("path does not exist: {root}"));
    }
    let depth = max_depth.unwrap_or(8);
    let hits: Arc<Mutex<HashMap<PathBuf, (bool, bool)>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let walker = WalkBuilder::new(&root_path)
        .max_depth(Some(depth))
        .hidden(false)
        .follow_links(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(false)
        .require_git(false)
        .filter_entry(|e| {
            let name = e.file_name().to_str().unwrap_or("");
            !is_ignored_dir(name)
        })
        .build_parallel();

    walker.run(|| {
        let hits = Arc::clone(&hits);
        Box::new(move |result| {
            let entry = match result {
                Ok(e) => e,
                Err(_) => return WalkState::Continue,
            };
            let path = entry.path();
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n,
                None => return WalkState::Continue,
            };
            let ft = match entry.file_type() {
                Some(ft) => ft,
                None => return WalkState::Continue,
            };

            if name == ".claude" && ft.is_dir() {
                if let Some(parent) = path.parent() {
                    let mut m = hits.lock().unwrap();
                    let e = m.entry(parent.to_path_buf()).or_insert((false, false));
                    e.1 = true;
                }
                return WalkState::Skip;
            }
            if name == "CLAUDE.md" && ft.is_file() {
                if let Some(parent) = path.parent() {
                    let mut m = hits.lock().unwrap();
                    let e = m.entry(parent.to_path_buf()).or_insert((false, false));
                    e.0 = true;
                }
            }
            WalkState::Continue
        })
    });

    let guard = hits.lock().map_err(|e| e.to_string())?;
    let mut out: Vec<ProjectHit> = guard
        .iter()
        .map(|(p, (md, dir))| ProjectHit {
            path: p.to_string_lossy().into_owned(),
            has_claude_md: *md,
            has_claude_dir: *dir,
        })
        .collect();
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

#[tauri::command]
pub fn watch_paths(
    paths: Vec<String>,
    state: State<'_, WatcherState>,
    window: tauri::Window,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(to_err)?;
    *guard = None;
    let win = window.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(ev) = res {
                let kind = match ev.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "remove",
                    _ => "other",
                };
                let change = FsChange {
                    kind: kind.into(),
                    paths: ev
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().into_owned())
                        .collect(),
                };
                let _ = win.emit("fs:change", change);
            }
        },
        Config::default(),
    )
    .map_err(to_err)?;
    for p in &paths {
        let path = Path::new(p);
        if path.exists() {
            let _ = watcher.watch(path, RecursiveMode::Recursive);
        }
    }
    *guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_all(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(to_err)?;
    *guard = None;
    Ok(())
}

/// Open a URL or file path in the user's default handler (browser, etc.).
/// Platform-specific: uses `cmd /C start` on Windows, `open` on macOS, `xdg-open` on Linux.
#[tauri::command]
pub async fn open_external(target: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // `start` treats the first quoted arg as a window title, so pass an empty "".
        let status = std::process::Command::new("cmd")
            .args(["/C", "start", "", &target])
            .status()
            .map_err(to_err)?;
        if !status.success() {
            return Err(format!("cmd start exited with {}", status));
        }
    }
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("open")
            .arg(&target)
            .status()
            .map_err(to_err)?;
        if !status.success() {
            return Err(format!("open exited with {}", status));
        }
    }
    #[cfg(target_os = "linux")]
    {
        let status = std::process::Command::new("xdg-open")
            .arg(&target)
            .status()
            .map_err(to_err)?;
        if !status.success() {
            return Err(format!("xdg-open exited with {}", status));
        }
    }
    Ok(())
}

#[derive(Serialize)]
pub struct CliResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Spawn an arbitrary program with the given arguments.
///
/// On Windows programs are invoked via `cmd /C` so that `.cmd` shims and
/// PATH-resolved binaries work. On other platforms the binary is exec'd
/// directly.
#[tauri::command]
pub async fn run_command(
    program: String,
    args: Vec<String>,
    timeout_ms: Option<u64>,
) -> Result<CliResult, String> {
    let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(300_000));

    let mut command = if cfg!(target_os = "windows") {
        let mut c = tokio::process::Command::new("cmd");
        c.arg("/C").arg(&program);
        for a in &args {
            c.arg(a);
        }
        c
    } else {
        let mut c = tokio::process::Command::new(&program);
        for a in &args {
            c.arg(a);
        }
        c
    };

    let child = command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn {program}: {e}"))?;

    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| format!("{program} timed out after {}ms", timeout.as_millis()))?
        .map_err(|e| format!("failed to read {program} output: {e}"))?;

    Ok(CliResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Spawn the `claude` CLI with the given arguments.
///
/// On Windows the CLI is typically installed as a `.cmd` shim, so we invoke
/// it via `cmd /C` to let the shell resolve the binary. On other platforms
/// we exec the binary directly.
#[tauri::command]
pub async fn run_claude_cli(
    args: Vec<String>,
    timeout_ms: Option<u64>,
) -> Result<CliResult, String> {
    let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(300_000));

    let mut command = if cfg!(target_os = "windows") {
        let mut c = tokio::process::Command::new("cmd");
        c.arg("/C").arg("claude");
        for a in &args {
            c.arg(a);
        }
        c
    } else {
        let mut c = tokio::process::Command::new("claude");
        for a in &args {
            c.arg(a);
        }
        c
    };

    let child = command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn claude CLI: {e}"))?;

    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| format!("claude CLI timed out after {}ms", timeout.as_millis()))?
        .map_err(|e| format!("failed to read claude CLI output: {e}"))?;

    Ok(CliResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

mod ics;
mod recur;
mod reminders;
mod store;
mod tts;

use chrono::Local;
use rusqlite::{Connection, OpenFlags, MAIN_DB};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Condvar, Mutex};
use std::time::Duration as StdDuration;
use store::{err, Res};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Paths {
    pub data: String,
    pub db: String,
    pub attachments: String,
    pub backups: String,
    pub exports: String,
}

pub struct AppState {
    conn: Mutex<Connection>,
    paths: Paths,
    wake: (Mutex<bool>, Condvar),
}

impl AppState {
    fn db(&self) -> Res<std::sync::MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|_| "The database is busy. Try again.".to_string())
    }
    /// Ask the reminder engine to look again straight away (after an edit).
    fn nudge(&self) {
        if let Ok(mut w) = self.wake.0.lock() {
            *w = true;
            self.wake.1.notify_all();
        }
    }
}

/// The Windows sound played with each notification, chosen in Settings.
/// Without one, Windows shows the notification silently. "off" means silent on purpose.
fn notify_sound(conn: &Connection) -> Option<String> {
    match store::get_setting(conn, "notifySound").and_then(|v| v.as_str().map(str::to_string)) {
        Some(s) if s == "off" => None,
        Some(s) if !s.is_empty() => Some(s),
        _ => Some("Reminder".into()),
    }
}

/// On Linux, the Windows sound names become the matching freedesktop sound-theme names.
fn system_sound(name: &str) -> String {
    if cfg!(target_os = "linux") {
        match name {
            "Reminder" | "Alarm" | "Call" => "alarm-clock-elapsed",
            "Mail" => "message-new-email",
            _ => "message-new-instant",
        }
        .to_string()
    } else {
        name.to_string()
    }
}

fn send_notification(app: &AppHandle, title: &str, body: &str, sound: Option<&str>) -> Result<(), String> {
    let mut n = app.notification().builder().title(title).body(body);
    if let Some(s) = sound {
        n = n.sound(system_sound(s));
    }
    n.show().map_err(|e| e.to_string())
}

struct AppNotifier {
    app: AppHandle,
    sound: Option<String>,
}
impl reminders::Notifier for AppNotifier {
    fn notify(&self, title: &str, body: &str) {
        if let Err(e) = send_notification(&self.app, title, body, self.sound.as_deref()) {
            eprintln!("notification failed: {e}");
        }
    }
}

fn now() -> chrono::NaiveDateTime {
    Local::now().naive_local()
}

// ---------------- commands ----------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Boot {
    settings: serde_json::Map<String, Value>,
    categories: Vec<store::Category>,
    paths: Paths,
    version: String,
    timezone: String,
}

#[tauri::command]
fn bootstrap(app: AppHandle, state: State<AppState>) -> Res<Boot> {
    let db = state.db()?;
    Ok(Boot {
        settings: store::all_settings(&db)?,
        categories: store::categories(&db)?,
        paths: state.paths.clone(),
        version: app.package_info().version.to_string(),
        timezone: Local::now().format("%:z").to_string(),
    })
}

#[tauri::command]
fn occurrences(state: State<AppState>, from: String, to: String) -> Res<Vec<store::Occurrence>> {
    store::occurrences_between(&*state.db()?, &from, &to)
}

#[tauri::command]
fn search_events(state: State<AppState>, query: String, category: Option<String>, kind: Option<String>) -> Res<Vec<store::Event>> {
    store::search_events(&*state.db()?, &query, category.as_deref(), kind.as_deref())
}

#[tauri::command]
fn get_event(state: State<AppState>, id: String) -> Res<store::Event> {
    store::get_event(&*state.db()?, &id)
}

#[tauri::command]
fn save_event(state: State<AppState>, event: store::Event) -> Res<store::Event> {
    let r = store::save_event(&*state.db()?, event);
    state.nudge();
    r
}

#[tauri::command]
fn duplicate_event(state: State<AppState>, id: String) -> Res<store::Event> {
    let r = store::duplicate_event(&*state.db()?, &id);
    state.nudge();
    r
}

#[tauri::command]
fn delete_event(state: State<AppState>, id: String) -> Res<()> {
    let r = store::delete_event(&*state.db()?, &id);
    state.nudge();
    r
}

#[tauri::command]
fn move_event(state: State<AppState>, id: String, start: String) -> Res<store::Event> {
    let r = store::move_event(&*state.db()?, &id, &start);
    state.nudge();
    r
}

#[tauri::command]
fn find_conflicts(state: State<AppState>, start: String, end: String, all_day: bool, exclude_id: Option<String>) -> Res<Vec<store::Occurrence>> {
    store::find_conflicts(&*state.db()?, &start, &end, all_day, exclude_id.as_deref())
}

#[tauri::command]
fn featured(state: State<AppState>) -> Res<Option<store::Occurrence>> {
    store::next_featured(&*state.db()?, now())
}

#[tauri::command]
fn tasks(state: State<AppState>) -> Res<Vec<store::Task>> {
    store::tasks(&*state.db()?)
}

#[tauri::command]
fn save_task(state: State<AppState>, task: store::Task) -> Res<store::Task> {
    let r = store::save_task(&*state.db()?, task);
    state.nudge();
    r
}

#[tauri::command]
fn set_task_done(state: State<AppState>, id: String, done: bool) -> Res<store::Task> {
    let r = store::set_task_done(&*state.db()?, &id, done);
    state.nudge();
    r
}

#[tauri::command]
fn delete_task(state: State<AppState>, id: String) -> Res<()> {
    let r = store::delete_task(&*state.db()?, &id);
    state.nudge();
    r
}

#[tauri::command]
fn notes(state: State<AppState>) -> Res<Vec<store::Note>> {
    store::notes(&*state.db()?)
}

#[tauri::command]
fn save_note(state: State<AppState>, note: store::Note) -> Res<store::Note> {
    store::save_note(&*state.db()?, note)
}

#[tauri::command]
fn delete_note(state: State<AppState>, id: String) -> Res<()> {
    store::delete_note(&*state.db()?, &id)
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: Value) -> Res<serde_json::Map<String, Value>> {
    let db = state.db()?;
    store::set_setting(&db, &key, &value)?;
    let all = store::all_settings(&db)?;
    drop(db);
    if key == "focus" {
        state.nudge();
    }
    Ok(all)
}

#[tauri::command]
fn reminder_feed(state: State<AppState>) -> Res<Vec<reminders::Item>> {
    reminders::feed(&*state.db()?, now())
}

#[tauri::command]
fn snooze_reminder(state: State<AppState>, item: reminders::Item, minutes: i64) -> Res<()> {
    reminders::snooze(&*state.db()?, &item, minutes, now())?;
    state.nudge();
    Ok(())
}

#[tauri::command]
fn dismiss_reminder(state: State<AppState>, item: reminders::Item) -> Res<()> {
    reminders::dismiss(&*state.db()?, &item)
}

#[tauri::command]
fn complete_reminder(state: State<AppState>, item: reminders::Item) -> Res<()> {
    reminders::complete(&*state.db()?, &item)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Battery {
    percent: f32,
    charging: bool,
}

/// Real battery state from the operating system, or nothing on a desktop
/// without a battery. Never made up.
#[tauri::command]
fn battery() -> Option<Battery> {
    let manager = starship_battery::Manager::new().ok()?;
    let mut list = manager.batteries().ok()?;
    let b = list.next()?.ok()?;
    let percent = b.state_of_charge().get::<starship_battery::units::ratio::percent>();
    let charging = matches!(b.state(), starship_battery::State::Charging | starship_battery::State::Full);
    Some(Battery { percent: percent.round(), charging })
}

fn stamp() -> String {
    Local::now().format("%Y%m%d-%H%M%S").to_string()
}

fn backup_to(conn: &Connection, dir: &str, label: &str) -> Res<String> {
    let path = Path::new(dir).join(format!("schedulr-{label}-{}.db", stamp()));
    conn.backup(MAIN_DB, &path, None::<fn(rusqlite::backup::Progress)>).map_err(err)?;
    prune_backups(dir, 30);
    Ok(path.to_string_lossy().to_string())
}

fn prune_backups(dir: &str, keep: usize) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    let mut files: Vec<_> = rd.flatten().filter(|e| e.path().extension().map_or(false, |x| x == "db")).collect();
    files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    while files.len() > keep {
        let f = files.remove(0);
        let _ = std::fs::remove_file(f.path());
    }
}

#[tauri::command]
fn backup_now(state: State<AppState>) -> Res<String> {
    backup_to(&*state.db()?, &state.paths.backups, "manual")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    path: String,
    name: String,
    size: u64,
    modified: String,
}

#[tauri::command]
fn list_backups(state: State<AppState>) -> Res<Vec<BackupFile>> {
    let mut out = Vec::new();
    for e in std::fs::read_dir(&state.paths.backups).map_err(err)?.flatten() {
        let p = e.path();
        if p.extension().map_or(true, |x| x != "db") {
            continue;
        }
        let meta = e.metadata().map_err(err)?;
        let modified: chrono::DateTime<Local> = meta.modified().map_err(err)?.into();
        out.push(BackupFile {
            path: p.to_string_lossy().to_string(),
            name: p.file_name().unwrap_or_default().to_string_lossy().to_string(),
            size: meta.len(),
            modified: modified.format("%Y-%m-%dT%H:%M").to_string(),
        });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

/// Replaces the current data with a backup. The current data is backed up first.
#[tauri::command]
fn restore_backup(state: State<AppState>, path: String) -> Res<String> {
    {
        let check = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|_| "That file could not be opened.".to_string())?;
        let ok: i64 = check
            .query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('events','tasks','notes','settings')", [], |r| r.get(0))
            .map_err(|_| "That file is not a Schedulr backup.".to_string())?;
        if ok < 4 {
            return Err("That file is not a Schedulr backup.".into());
        }
    }
    let mut db = state.db()?;
    let safety = backup_to(&db, &state.paths.backups, "before-restore")?;
    db.restore(MAIN_DB, &path, None::<fn(rusqlite::backup::Progress)>).map_err(err)?;
    store::configure(&db)?;
    store::migrate(&db)?;
    drop(db);
    state.nudge();
    Ok(safety)
}

#[tauri::command]
fn export_json(state: State<AppState>) -> Res<String> {
    let data = store::export_json(&*state.db()?)?;
    let path = Path::new(&state.paths.exports).join(format!("schedulr-export-{}.json", stamp()));
    std::fs::write(&path, serde_json::to_string_pretty(&data).map_err(err)?).map_err(err)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_ics(state: State<AppState>, event_id: Option<String>) -> Res<String> {
    let db = state.db()?;
    let (events, name) = match event_id {
        Some(id) => {
            let ev = store::get_event(&db, &id)?;
            let slug: String = ev.title.chars().map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' }).collect();
            (vec![ev], format!("{}-{}.ics", slug.trim_matches('-'), stamp()))
        }
        None => (store::all_events(&db)?, format!("schedulr-calendar-{}.ics", stamp())),
    };
    let path = Path::new(&state.paths.exports).join(name);
    std::fs::write(&path, ics::calendar(&events)?).map_err(err)?;
    Ok(path.to_string_lossy().to_string())
}

/// Copies a picture the user chose into the app's own attachments folder.
#[tauri::command]
fn import_attachment(state: State<AppState>, src: String) -> Res<String> {
    let src = PathBuf::from(src);
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    if !["png", "jpg", "jpeg", "webp", "gif", "svg"].contains(&ext.as_str()) {
        return Err("Choose a PNG, JPG, WebP, GIF or SVG image.".into());
    }
    let dest = Path::new(&state.paths.attachments).join(format!("{}.{ext}", uuid::Uuid::new_v4()));
    std::fs::copy(&src, &dest).map_err(err)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn test_notification(app: AppHandle, state: State<'_, AppState>) -> Res<()> {
    let sound = notify_sound(&*state.db()?);
    send_notification(&app, "Schedulr reminders are on", "This is how your reminders will appear and sound.", sound.as_deref())
}

/// Windows speech voices for Pip, with whether each is a woman's voice.
#[tauri::command]
async fn tts_voices() -> Res<Vec<tts::Voice>> {
    tauri::async_runtime::spawn_blocking(tts::voices).await.map_err(err)?
}

/// One line of Pip's speech as WAV audio, sent back as raw bytes.
#[tauri::command]
async fn tts_render(text: String, voice_id: Option<String>, pitch: f64, rate: f64) -> Res<tauri::ipc::Response> {
    let wav = tauri::async_runtime::spawn_blocking(move || tts::render(&text, voice_id.as_deref(), pitch, rate))
        .await
        .map_err(err)??;
    Ok(tauri::ipc::Response::new(wav))
}

// ---------------- app ----------------

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    // Lets the window check for updates (and other fresh things) when it comes back from the tray.
    let _ = app.emit("window-shown", ());
}

fn start_engine(app: AppHandle) {
    std::thread::spawn(move || loop {
        let state = app.state::<AppState>();
        let changed = match state.db() {
            Ok(db) => match reminders::tick(&db, now(), &AppNotifier { app: app.clone(), sound: notify_sound(&db) }) {
                Ok(report) => report.changed(),
                Err(e) => {
                    eprintln!("reminder engine: {e}");
                    false
                }
            },
            Err(_) => false,
        };
        if changed {
            let _ = app.emit("reminders-changed", ());
        }
        // Wake at the next minute boundary, every 15 s at most, or when nudged.
        let secs_into_minute = Local::now().timestamp() % 60;
        let wait = StdDuration::from_secs(((60 - secs_into_minute) as u64).clamp(1, 15));
        let (lock, cvar) = &state.wake;
        let Ok(guard) = lock.lock() else { continue };
        let Ok((mut woken, _)) = cvar.wait_timeout_while(guard, wait, |w| !*w) else { continue };
        *woken = false;
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            // %APPDATA%\com.schedulr.app on Windows.
            let data = app.path().app_data_dir()?;
            let sub = |name: &str| -> std::io::Result<String> {
                let p = data.join(name);
                std::fs::create_dir_all(&p)?;
                Ok(p.to_string_lossy().to_string())
            };
            std::fs::create_dir_all(&data)?;
            let paths = Paths {
                data: data.to_string_lossy().to_string(),
                db: data.join("schedulr.db").to_string_lossy().to_string(),
                attachments: sub("attachments")?,
                backups: sub("backups")?,
                exports: sub("exports")?,
            };
            let conn = store::open(Path::new(&paths.db)).map_err(|e| format!("Could not open the database: {e}"))?;
            // A quiet daily safety backup.
            let last_auto = store::get_setting(&conn, "lastAutoBackup").and_then(|v| v.as_str().map(String::from)).unwrap_or_default();
            let today = Local::now().format("%Y-%m-%d").to_string();
            if last_auto != today && backup_to(&conn, &paths.backups, "auto").is_ok() {
                let _ = store::set_setting(&conn, "lastAutoBackup", &Value::String(today));
            }
            app.manage(AppState { conn: Mutex::new(conn), paths, wake: (Mutex::new(false), Condvar::new()) });

            let open = MenuItem::with_id(app, "open", "Open Schedulr", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Schedulr", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("Schedulr: reminders are running")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            if !std::env::args().any(|a| a == "--minimized") {
                show_main(app.handle());
            }
            start_engine(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let to_tray = state.db().ok().and_then(|db| store::get_setting(&db, "closeToTray")).and_then(|v| v.as_bool()).unwrap_or(true);
                if to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap, occurrences, search_events, get_event, save_event, duplicate_event, delete_event, move_event,
            find_conflicts, featured, tasks, save_task, set_task_done, delete_task, notes, save_note, delete_note,
            set_setting, reminder_feed, snooze_reminder, dismiss_reminder, complete_reminder, battery, backup_now,
            list_backups, restore_backup, export_json, export_ics, import_attachment, test_notification,
            tts_voices, tts_render
        ])
        .run(tauri::generate_context!())
        .expect("error while running Schedulr");
}

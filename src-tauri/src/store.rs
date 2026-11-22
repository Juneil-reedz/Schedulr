//! SQLite schema and data access. Everything here is plain Rust so it can be
//! unit-tested without a running Tauri app.

use crate::recur::{self, Freq, Rule};
use chrono::{Duration, Local, NaiveDate, NaiveDateTime};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

pub type Res<T> = Result<T, String>;

pub fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

pub const DT_FMT: &str = "%Y-%m-%dT%H:%M";
pub const D_FMT: &str = "%Y-%m-%d";

pub fn now_str() -> String {
    Local::now().naive_local().format(DT_FMT).to_string()
}

pub fn parse_dt(s: &str) -> Res<NaiveDateTime> {
    if s.len() == 10 {
        return NaiveDate::parse_from_str(s, D_FMT)
            .map(|d| d.and_hms_opt(0, 0, 0).unwrap())
            .map_err(|e| format!("bad date '{s}': {e}"));
    }
    NaiveDateTime::parse_from_str(&s[..16.min(s.len())], DT_FMT).map_err(|e| format!("bad time '{s}': {e}"))
}

pub fn fmt_dt(d: NaiveDateTime) -> String {
    d.format(DT_FMT).to_string()
}

// ---------- schema ----------

const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'personal', sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'event',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  location_type TEXT NOT NULL DEFAULT 'none',
  location TEXT NOT NULL DEFAULT '',
  meeting_url TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '[]',
  agenda TEXT NOT NULL DEFAULT '',
  recur_freq TEXT NOT NULL DEFAULT 'none',
  recur_interval INTEGER NOT NULL DEFAULT 1,
  recur_weekdays TEXT NOT NULL DEFAULT '',
  recur_until TEXT,
  recur_count INTEGER,
  important INTEGER NOT NULL DEFAULT 0,
  image_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_start ON events(start);
CREATE TABLE IF NOT EXISTS event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  offset_minutes INTEGER,
  at TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  due TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  recur_freq TEXT NOT NULL DEFAULT 'none',
  recur_interval INTEGER NOT NULL DEFAULT 1,
  remind_offset INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminder_log (
  key TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  fire_at TEXT NOT NULL,
  status TEXT NOT NULL,
  snooze_until TEXT,
  updated_at TEXT NOT NULL
);
"#;

pub fn open(path: &Path) -> Res<Connection> {
    let conn = Connection::open(path).map_err(err)?;
    configure(&conn)?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn configure(conn: &Connection) -> Res<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=4000;").map_err(err)
}

pub fn migrate(conn: &Connection) -> Res<()> {
    let v: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)?;
    if v < 1 {
        conn.execute_batch(SCHEMA_V1).map_err(err)?;
        let cats = [
            ("work", "Work", "#234B38", "work", 0),
            ("meetings", "Meetings", "#BB6545", "work", 1),
            ("personal", "Personal", "#D97878", "personal", 2),
            ("health", "Health", "#8D9C73", "personal", 3),
            ("family", "Family & friends", "#E5A72E", "personal", 4),
        ];
        for (id, name, color, scope, sort) in cats {
            conn.execute(
                "INSERT OR IGNORE INTO categories(id,name,color,scope,sort) VALUES (?1,?2,?3,?4,?5)",
                params![id, name, color, scope, sort],
            )
            .map_err(err)?;
        }
        conn.execute_batch("PRAGMA user_version = 1").map_err(err)?;
    }
    Ok(())
}

// ---------- models ----------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Participant {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Recurrence {
    pub freq: String,
    pub interval: u32,
    pub weekdays: Vec<u32>,
    pub until: Option<String>,
    pub count: Option<u32>,
}

impl Default for Recurrence {
    fn default() -> Self {
        Recurrence { freq: "none".into(), interval: 1, weekdays: vec![], until: None, count: None }
    }
}

impl Recurrence {
    pub fn rule(&self) -> Rule {
        Rule {
            freq: Freq::parse(&self.freq),
            interval: self.interval.max(1),
            weekdays: self.weekdays.clone(),
            until: self.until.as_deref().and_then(|u| NaiveDate::parse_from_str(&u[..10.min(u.len())], D_FMT).ok()),
            count: self.count.filter(|c| *c > 0),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ReminderSpec {
    pub id: String,
    /// Minutes before the start. 0 means "at event time".
    pub offset_minutes: Option<i64>,
    /// A custom absolute time, "YYYY-MM-DDTHH:MM".
    pub at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Event {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub description: String,
    pub category_id: Option<String>,
    pub start: String,
    pub end: String,
    pub all_day: bool,
    pub location_type: String,
    pub location: String,
    pub meeting_url: String,
    pub participants: Vec<Participant>,
    pub agenda: String,
    pub recur: Recurrence,
    pub important: bool,
    pub image_path: Option<String>,
    pub reminders: Vec<ReminderSpec>,
    pub created_at: String,
    pub updated_at: String,
}

impl Event {
    /// Start and exclusive end of the first occurrence.
    pub fn span(&self) -> Res<(NaiveDateTime, NaiveDateTime)> {
        let s = parse_dt(&self.start)?;
        let mut e = parse_dt(&self.end)?;
        if self.all_day {
            e += Duration::days(1); // all-day end dates are inclusive
        }
        if e < s {
            e = s;
        }
        Ok((s, e))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Occurrence {
    pub key: String,
    pub event: Event,
    pub start: String,
    pub end: String,
    pub conflict: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub category_id: Option<String>,
    pub due: Option<String>,
    pub priority: i64,
    pub done: bool,
    pub done_at: Option<String>,
    pub event_id: Option<String>,
    pub recur: Recurrence,
    pub remind_offset: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Note {
    pub id: String,
    pub kind: String,
    pub body: String,
    pub author: String,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ---------- categories & settings ----------

pub fn categories(conn: &Connection) -> Res<Vec<Category>> {
    let mut st = conn.prepare("SELECT id,name,color,scope FROM categories ORDER BY sort, name").map_err(err)?;
    let rows = st
        .query_map([], |r| Ok(Category { id: r.get(0)?, name: r.get(1)?, color: r.get(2)?, scope: r.get(3)? }))
        .map_err(err)?;
    rows.collect::<Result<_, _>>().map_err(err)
}

pub fn category_scope(conn: &Connection, id: Option<&str>) -> Option<String> {
    let id = id?;
    conn.query_row("SELECT scope FROM categories WHERE id=?1", [id], |r| r.get(0)).optional().ok().flatten()
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<Value> {
    let s: Option<String> = conn.query_row("SELECT value FROM settings WHERE key=?1", [key], |r| r.get(0)).optional().ok().flatten();
    s.and_then(|s| serde_json::from_str(&s).ok())
}

pub fn set_setting(conn: &Connection, key: &str, value: &Value) -> Res<()> {
    conn.execute(
        "INSERT INTO settings(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value.to_string()],
    )
    .map_err(err)?;
    Ok(())
}

pub fn all_settings(conn: &Connection) -> Res<serde_json::Map<String, Value>> {
    let mut st = conn.prepare("SELECT key,value FROM settings").map_err(err)?;
    let mut map = serde_json::Map::new();
    let rows = st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map_err(err)?;
    for row in rows {
        let (k, v) = row.map_err(err)?;
        map.insert(k, serde_json::from_str(&v).unwrap_or(Value::Null));
    }
    Ok(map)
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Focus {
    pub dnd: bool,
    pub work: bool,
    pub personal: bool,
    pub sleep: bool,
}

pub fn focus(conn: &Connection) -> Focus {
    get_setting(conn, "focus").and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()
}

// ---------- events ----------

const EVENT_COLS: &str = "id,kind,title,description,category_id,start,end,all_day,location_type,location,meeting_url,participants,agenda,recur_freq,recur_interval,recur_weekdays,recur_until,recur_count,important,image_path,created_at,updated_at";

fn row_event(r: &Row) -> rusqlite::Result<Event> {
    let participants: String = r.get(11)?;
    let weekdays: String = r.get(15)?;
    Ok(Event {
        id: r.get(0)?,
        kind: r.get(1)?,
        title: r.get(2)?,
        description: r.get(3)?,
        category_id: r.get(4)?,
        start: r.get(5)?,
        end: r.get(6)?,
        all_day: r.get::<_, i64>(7)? != 0,
        location_type: r.get(8)?,
        location: r.get(9)?,
        meeting_url: r.get(10)?,
        participants: serde_json::from_str(&participants).unwrap_or_default(),
        agenda: r.get(12)?,
        recur: Recurrence {
            freq: r.get(13)?,
            interval: r.get::<_, i64>(14)?.max(1) as u32,
            weekdays: weekdays.split(',').filter_map(|s| s.trim().parse().ok()).collect(),
            until: r.get(16)?,
            count: r.get::<_, Option<i64>>(17)?.map(|c| c as u32),
        },
        important: r.get::<_, i64>(18)? != 0,
        image_path: r.get(19)?,
        reminders: vec![],
        created_at: r.get(20)?,
        updated_at: r.get(21)?,
    })
}

fn load_reminders(conn: &Connection, ev: &mut Event) -> Res<()> {
    let mut st = conn
        .prepare("SELECT id,offset_minutes,at FROM event_reminders WHERE event_id=?1 ORDER BY COALESCE(offset_minutes, 0) DESC, at")
        .map_err(err)?;
    let rows = st
        .query_map([&ev.id], |r| Ok(ReminderSpec { id: r.get(0)?, offset_minutes: r.get(1)?, at: r.get(2)? }))
        .map_err(err)?;
    ev.reminders = rows.collect::<Result<_, _>>().map_err(err)?;
    Ok(())
}

pub fn all_events(conn: &Connection) -> Res<Vec<Event>> {
    let mut st = conn.prepare(&format!("SELECT {EVENT_COLS} FROM events ORDER BY start")).map_err(err)?;
    let mut evs: Vec<Event> = st.query_map([], row_event).map_err(err)?.collect::<Result<_, _>>().map_err(err)?;
    for e in evs.iter_mut() {
        load_reminders(conn, e)?;
    }
    Ok(evs)
}

pub fn get_event(conn: &Connection, id: &str) -> Res<Event> {
    let mut ev = conn
        .query_row(&format!("SELECT {EVENT_COLS} FROM events WHERE id=?1"), [id], row_event)
        .map_err(|_| format!("Event {id} was not found"))?;
    load_reminders(conn, &mut ev)?;
    Ok(ev)
}

fn validate_event(ev: &Event) -> Res<()> {
    if ev.title.trim().is_empty() {
        return Err("Give the event a title.".into());
    }
    if parse_dt(&ev.end)? < parse_dt(&ev.start)? {
        return Err("The event ends before it starts.".into());
    }
    if let Some(u) = &ev.recur.until {
        if !u.is_empty() {
            NaiveDate::parse_from_str(&u[..10.min(u.len())], D_FMT).map_err(|_| "The repeat end date is not valid.".to_string())?;
        }
    }
    for r in &ev.reminders {
        if let Some(at) = &r.at {
            parse_dt(at)?;
        }
    }
    Ok(())
}

pub fn save_event(conn: &Connection, mut ev: Event) -> Res<Event> {
    validate_event(&ev)?;
    let now = now_str();
    if ev.kind.is_empty() {
        ev.kind = "event".into();
    }
    if ev.location_type.is_empty() {
        ev.location_type = "none".into();
    }
    if ev.recur.freq.is_empty() {
        ev.recur.freq = "none".into();
    }
    let is_new = ev.id.is_empty() || conn.query_row("SELECT 1 FROM events WHERE id=?1", [&ev.id], |_| Ok(())).optional().map_err(err)?.is_none();
    if ev.id.is_empty() {
        ev.id = new_id();
    }
    if is_new {
        ev.created_at = now.clone();
    }
    ev.updated_at = now;
    let weekdays = ev.recur.weekdays.iter().map(|d| d.to_string()).collect::<Vec<_>>().join(",");
    let until = ev.recur.until.clone().filter(|u| !u.is_empty());
    conn.execute(
        &format!(
            "INSERT INTO events({EVENT_COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)
             ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,description=excluded.description,
             category_id=excluded.category_id,start=excluded.start,end=excluded.end,all_day=excluded.all_day,
             location_type=excluded.location_type,location=excluded.location,meeting_url=excluded.meeting_url,
             participants=excluded.participants,agenda=excluded.agenda,recur_freq=excluded.recur_freq,
             recur_interval=excluded.recur_interval,recur_weekdays=excluded.recur_weekdays,recur_until=excluded.recur_until,
             recur_count=excluded.recur_count,important=excluded.important,image_path=excluded.image_path,updated_at=excluded.updated_at"
        ),
        params![
            ev.id, ev.kind, ev.title.trim(), ev.description, ev.category_id, ev.start, ev.end, ev.all_day as i64,
            ev.location_type, ev.location, ev.meeting_url, serde_json::to_string(&ev.participants).map_err(err)?,
            ev.agenda, ev.recur.freq, ev.recur.interval.max(1) as i64, weekdays, until,
            ev.recur.count.map(|c| c as i64), ev.important as i64, ev.image_path, ev.created_at, ev.updated_at
        ],
    )
    .map_err(err)?;
    conn.execute("DELETE FROM event_reminders WHERE event_id=?1", [&ev.id]).map_err(err)?;
    let mut seen = Vec::new();
    for r in &ev.reminders {
        let key = (r.offset_minutes, r.at.clone());
        if (r.offset_minutes.is_none() && r.at.is_none()) || seen.contains(&key) {
            continue;
        }
        seen.push(key);
        conn.execute(
            "INSERT INTO event_reminders(id,event_id,offset_minutes,at) VALUES (?1,?2,?3,?4)",
            params![new_id(), ev.id, r.offset_minutes, r.at],
        )
        .map_err(err)?;
    }
    // Reminders that have not fired yet are recomputed from the new times.
    conn.execute(
        "DELETE FROM reminder_log WHERE source_id=?1 AND status IN ('dismissed','snoozed') AND fire_at > ?2",
        params![ev.id, now_str()],
    )
    .map_err(err)?;
    get_event(conn, &ev.id)
}

pub fn duplicate_event(conn: &Connection, id: &str) -> Res<Event> {
    let mut ev = get_event(conn, id)?;
    ev.id = String::new();
    ev.title = format!("{} (copy)", ev.title);
    for r in ev.reminders.iter_mut() {
        r.id.clear();
    }
    save_event(conn, ev)
}

pub fn delete_event(conn: &Connection, id: &str) -> Res<()> {
    conn.execute("DELETE FROM events WHERE id=?1", [id]).map_err(err)?;
    conn.execute("DELETE FROM reminder_log WHERE source_id=?1 AND status NOT IN ('fired','missed')", [id]).map_err(err)?;
    Ok(())
}

/// Moves the whole series so its first start lands on `new_start`, keeping its length.
pub fn move_event(conn: &Connection, id: &str, new_start: &str) -> Res<Event> {
    let mut ev = get_event(conn, id)?;
    let old = parse_dt(&ev.start)?;
    let new = parse_dt(new_start)?;
    let delta = new - old;
    if ev.all_day {
        let shift = Duration::days(delta.num_days());
        ev.start = (old + shift).format(D_FMT).to_string();
        ev.end = (parse_dt(&ev.end)? + shift).format(D_FMT).to_string();
    } else {
        ev.start = fmt_dt(new);
        ev.end = fmt_dt(parse_dt(&ev.end)? + delta);
    }
    for r in ev.reminders.iter_mut() {
        if let Some(at) = &r.at {
            r.at = Some(fmt_dt(parse_dt(at)? + delta));
        }
    }
    save_event(conn, ev)
}

fn occ_key(ev: &Event, start: NaiveDateTime) -> String {
    format!("{}@{}", ev.id, fmt_dt(start))
}

fn fmt_occ(ev: &Event, s: NaiveDateTime, e: NaiveDateTime) -> (String, String) {
    if ev.all_day {
        (s.format(D_FMT).to_string(), (e - Duration::days(1)).format(D_FMT).to_string())
    } else {
        (fmt_dt(s), fmt_dt(e))
    }
}

pub fn expand(ev: &Event, from: NaiveDateTime, to: NaiveDateTime) -> Res<Vec<(NaiveDateTime, NaiveDateTime)>> {
    let (s, e) = ev.span()?;
    let dur = e - s;
    Ok(recur::occurrences(s, dur, &ev.recur.rule(), from, to).into_iter().map(|o| (o, o + dur)).collect())
}

pub fn occurrences_between(conn: &Connection, from: &str, to: &str) -> Res<Vec<Occurrence>> {
    let (f, t) = (parse_dt(from)?, parse_dt(to)?);
    let mut out = Vec::new();
    let mut spans = Vec::new();
    for ev in all_events(conn)? {
        for (s, e) in expand(&ev, f, t)? {
            let (ss, es) = fmt_occ(&ev, s, e);
            spans.push((s, e, ev.all_day));
            out.push(Occurrence { key: occ_key(&ev, s), event: ev.clone(), start: ss, end: es, conflict: false });
        }
    }
    // Timed occurrences that overlap another timed occurrence are conflicts.
    for i in 0..out.len() {
        if spans[i].2 {
            continue;
        }
        for j in 0..out.len() {
            if i != j && !spans[j].2 && spans[i].0 < spans[j].1 && spans[j].0 < spans[i].1 {
                out[i].conflict = true;
                break;
            }
        }
    }
    out.sort_by(|a, b| a.start.cmp(&b.start).then(b.event.all_day.cmp(&a.event.all_day)));
    Ok(out)
}

/// Timed occurrences of other events that overlap the proposed time.
pub fn find_conflicts(conn: &Connection, start: &str, end: &str, all_day: bool, exclude: Option<&str>) -> Res<Vec<Occurrence>> {
    if all_day {
        return Ok(vec![]);
    }
    let (s, e) = (parse_dt(start)?, parse_dt(end)?);
    if e <= s {
        return Ok(vec![]);
    }
    let out = occurrences_between(conn, &fmt_dt(s), &fmt_dt(e))?;
    Ok(out
        .into_iter()
        .filter(|o| !o.event.all_day && Some(o.event.id.as_str()) != exclude)
        .filter(|o| match (parse_dt(&o.start), parse_dt(&o.end)) {
            (Ok(os), Ok(oe)) => os < e && s < oe,
            _ => false,
        })
        .map(|mut o| {
            o.conflict = true;
            o
        })
        .collect())
}

pub fn search_events(conn: &Connection, query: &str, category: Option<&str>, kind: Option<&str>) -> Res<Vec<Event>> {
    let q = query.trim().to_lowercase();
    Ok(all_events(conn)?
        .into_iter()
        .filter(|e| category.map_or(true, |c| e.category_id.as_deref() == Some(c)))
        .filter(|e| kind.map_or(true, |k| e.kind == k))
        .filter(|e| {
            q.is_empty()
                || [&e.title, &e.description, &e.location, &e.agenda, &e.meeting_url].iter().any(|f| f.to_lowercase().contains(&q))
                || e.participants.iter().any(|p| p.name.to_lowercase().contains(&q) || p.email.to_lowercase().contains(&q))
        })
        .collect())
}

/// The next important occurrence within 60 days, or else the next one of any kind.
pub fn next_featured(conn: &Connection, now: NaiveDateTime) -> Res<Option<Occurrence>> {
    let horizon = now + Duration::days(60);
    let occ = occurrences_between(conn, &fmt_dt(now), &fmt_dt(horizon))?;
    let upcoming: Vec<Occurrence> = occ
        .into_iter()
        .filter(|o| parse_dt(&o.end).map(|e| if o.event.all_day { e + Duration::days(1) > now } else { e > now }).unwrap_or(false))
        .collect();
    let pick = upcoming.iter().find(|o| o.event.important).or_else(|| upcoming.first());
    Ok(pick.cloned())
}

// ---------- tasks ----------

const TASK_COLS: &str = "id,title,notes,category_id,due,priority,done,done_at,event_id,recur_freq,recur_interval,remind_offset,created_at,updated_at";

fn row_task(r: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        title: r.get(1)?,
        notes: r.get(2)?,
        category_id: r.get(3)?,
        due: r.get(4)?,
        priority: r.get(5)?,
        done: r.get::<_, i64>(6)? != 0,
        done_at: r.get(7)?,
        event_id: r.get(8)?,
        recur: Recurrence { freq: r.get(9)?, interval: r.get::<_, i64>(10)?.max(1) as u32, ..Default::default() },
        remind_offset: r.get(11)?,
        created_at: r.get(12)?,
        updated_at: r.get(13)?,
    })
}

pub fn tasks(conn: &Connection) -> Res<Vec<Task>> {
    let mut st = conn
        .prepare(&format!("SELECT {TASK_COLS} FROM tasks ORDER BY done, due IS NULL, due, priority DESC, created_at"))
        .map_err(err)?;
    let rows = st.query_map([], row_task).map_err(err)?;
    rows.collect::<Result<_, _>>().map_err(err)
}

pub fn get_task(conn: &Connection, id: &str) -> Res<Task> {
    conn.query_row(&format!("SELECT {TASK_COLS} FROM tasks WHERE id=?1"), [id], row_task).map_err(|_| format!("Task {id} was not found"))
}

pub fn save_task(conn: &Connection, mut t: Task) -> Res<Task> {
    if t.title.trim().is_empty() {
        return Err("Give the task a title.".into());
    }
    if let Some(d) = &t.due {
        if d.is_empty() {
            t.due = None;
        } else {
            parse_dt(d)?;
        }
    }
    if t.recur.freq.is_empty() {
        t.recur.freq = "none".into();
    }
    if t.recur.freq != "none" && t.due.is_none() {
        return Err("A repeating task needs a due date.".into());
    }
    let now = now_str();
    let exists = !t.id.is_empty() && conn.query_row("SELECT 1 FROM tasks WHERE id=?1", [&t.id], |_| Ok(())).optional().map_err(err)?.is_some();
    if t.id.is_empty() {
        t.id = new_id();
    }
    if !exists {
        t.created_at = now.clone();
    }
    t.updated_at = now;
    conn.execute(
        &format!(
            "INSERT INTO tasks({TASK_COLS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
             ON CONFLICT(id) DO UPDATE SET title=excluded.title,notes=excluded.notes,category_id=excluded.category_id,
             due=excluded.due,priority=excluded.priority,done=excluded.done,done_at=excluded.done_at,event_id=excluded.event_id,
             recur_freq=excluded.recur_freq,recur_interval=excluded.recur_interval,remind_offset=excluded.remind_offset,
             updated_at=excluded.updated_at"
        ),
        params![
            t.id, t.title.trim(), t.notes, t.category_id, t.due, t.priority.clamp(0, 3), t.done as i64, t.done_at,
            t.event_id, t.recur.freq, t.recur.interval.max(1) as i64, t.remind_offset, t.created_at, t.updated_at
        ],
    )
    .map_err(err)?;
    get_task(conn, &t.id)
}

/// Completing a repeating task moves it to its next due date instead of closing it.
pub fn set_task_done(conn: &Connection, id: &str, done: bool) -> Res<Task> {
    let mut t = get_task(conn, id)?;
    let now = Local::now().naive_local();
    if done && t.recur.freq != "none" {
        if let Some(d) = &t.due {
            let due = parse_dt(d)?;
            let rule = Rule { freq: Freq::parse(&t.recur.freq), interval: t.recur.interval, weekdays: vec![], until: None, count: None };
            let after = if due > now { due } else { now };
            if let Some(next) = recur::next_after(due, &rule, after) {
                t.due = Some(if d.len() == 10 { next.format(D_FMT).to_string() } else { fmt_dt(next) });
                t.done = false;
                t.done_at = Some(fmt_dt(now));
                return save_task(conn, t);
            }
        }
    }
    t.done = done;
    t.done_at = if done { Some(fmt_dt(now)) } else { None };
    save_task(conn, t)
}

pub fn delete_task(conn: &Connection, id: &str) -> Res<()> {
    conn.execute("DELETE FROM tasks WHERE id=?1", [id]).map_err(err)?;
    conn.execute("DELETE FROM reminder_log WHERE source_id=?1 AND status NOT IN ('fired','missed')", [id]).map_err(err)?;
    Ok(())
}

// ---------- notes ----------

pub fn notes(conn: &Connection) -> Res<Vec<Note>> {
    let mut st = conn
        .prepare("SELECT id,kind,body,author,pinned,created_at,updated_at FROM notes ORDER BY pinned DESC, updated_at DESC")
        .map_err(err)?;
    let rows = st
        .query_map([], |r| {
            Ok(Note {
                id: r.get(0)?,
                kind: r.get(1)?,
                body: r.get(2)?,
                author: r.get(3)?,
                pinned: r.get::<_, i64>(4)? != 0,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
            })
        })
        .map_err(err)?;
    rows.collect::<Result<_, _>>().map_err(err)
}

pub fn save_note(conn: &Connection, mut n: Note) -> Res<Note> {
    if n.body.trim().is_empty() {
        return Err("Write something first.".into());
    }
    if n.kind != "quote" {
        n.kind = "note".into();
    }
    let now = now_str();
    if n.id.is_empty() {
        n.id = new_id();
        n.created_at = now.clone();
    }
    if n.created_at.is_empty() {
        n.created_at = now.clone();
    }
    n.updated_at = now;
    conn.execute(
        "INSERT INTO notes(id,kind,body,author,pinned,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,body=excluded.body,author=excluded.author,pinned=excluded.pinned,updated_at=excluded.updated_at",
        params![n.id, n.kind, n.body.trim(), n.author.trim(), n.pinned as i64, n.created_at, n.updated_at],
    )
    .map_err(err)?;
    Ok(n)
}

pub fn delete_note(conn: &Connection, id: &str) -> Res<()> {
    conn.execute("DELETE FROM notes WHERE id=?1", [id]).map_err(err)?;
    Ok(())
}

// ---------- export ----------

pub fn export_json(conn: &Connection) -> Res<Value> {
    Ok(serde_json::json!({
        "app": "Schedulr",
        "exportedAt": now_str(),
        "categories": categories(conn)?,
        "events": all_events(conn)?,
        "tasks": tasks(conn)?,
        "notes": notes(conn)?,
    }))
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        configure(&c).unwrap();
        migrate(&c).unwrap();
        c
    }

    pub fn event(title: &str, start: &str, end: &str) -> Event {
        Event { title: title.into(), start: start.into(), end: end.into(), category_id: Some("work".into()), ..Default::default() }
    }

    #[test]
    fn save_and_reload_event_with_reminders() {
        let c = mem();
        let mut e = event("Design review", "2026-08-15T10:00", "2026-08-15T11:00");
        e.kind = "meeting".into();
        e.participants = vec![Participant { name: "Ana".into(), email: "ana@example.com".into() }];
        e.reminders = vec![
            ReminderSpec { offset_minutes: Some(15), ..Default::default() },
            ReminderSpec { offset_minutes: Some(15), ..Default::default() },
            ReminderSpec { offset_minutes: Some(1440), ..Default::default() },
        ];
        let saved = save_event(&c, e).unwrap();
        let back = get_event(&c, &saved.id).unwrap();
        assert_eq!(back.kind, "meeting");
        assert_eq!(back.participants.len(), 1);
        assert_eq!(back.reminders.len(), 2, "duplicate reminders are dropped");
        assert_eq!(back.reminders[0].offset_minutes, Some(1440));
    }

    #[test]
    fn rejects_bad_events() {
        let c = mem();
        assert!(save_event(&c, event("", "2026-08-15T10:00", "2026-08-15T11:00")).is_err());
        assert!(save_event(&c, event("Backwards", "2026-08-15T10:00", "2026-08-15T09:00")).is_err());
    }

    #[test]
    fn conflicts_and_moves() {
        let c = mem();
        let a = save_event(&c, event("A", "2026-08-15T10:00", "2026-08-15T11:00")).unwrap();
        save_event(&c, event("B", "2026-08-15T10:30", "2026-08-15T12:00")).unwrap();
        let occ = occurrences_between(&c, "2026-08-15", "2026-08-16").unwrap();
        assert!(occ.iter().all(|o| o.conflict));
        let clash = find_conflicts(&c, "2026-08-15T11:30", "2026-08-15T12:30", false, None).unwrap();
        assert_eq!(clash.len(), 1);
        assert_eq!(clash[0].event.title, "B");
        let moved = move_event(&c, &a.id, "2026-08-16T09:00").unwrap();
        assert_eq!((moved.start.as_str(), moved.end.as_str()), ("2026-08-16T09:00", "2026-08-16T10:00"));
        let occ = occurrences_between(&c, "2026-08-15", "2026-08-17").unwrap();
        assert!(occ.iter().all(|o| !o.conflict));
    }

    #[test]
    fn all_day_multi_day_and_recurring_expand() {
        let c = mem();
        let mut trip = event("Trip", "2026-08-14", "2026-08-16");
        trip.all_day = true;
        save_event(&c, trip).unwrap();
        let mut standup = event("Stand-up", "2026-08-03T09:00", "2026-08-03T09:15");
        standup.recur = Recurrence { freq: "weekly".into(), interval: 1, weekdays: vec![1, 2, 3, 4, 5], ..Default::default() };
        save_event(&c, standup).unwrap();
        let occ = occurrences_between(&c, "2026-08-15", "2026-08-16").unwrap();
        assert_eq!(occ.len(), 1, "Saturday has the trip but no stand-up");
        assert_eq!((occ[0].start.as_str(), occ[0].end.as_str()), ("2026-08-14", "2026-08-16"));
        let week = occurrences_between(&c, "2026-08-10", "2026-08-17").unwrap();
        assert_eq!(week.iter().filter(|o| o.event.title == "Stand-up").count(), 5);
    }

    #[test]
    fn search_and_duplicate() {
        let c = mem();
        let mut m = event("Budget sync", "2026-08-15T10:00", "2026-08-15T11:00");
        m.participants = vec![Participant { name: "Marisol".into(), email: String::new() }];
        let m = save_event(&c, m).unwrap();
        assert_eq!(search_events(&c, "marisol", None, None).unwrap().len(), 1);
        assert_eq!(search_events(&c, "budget", Some("personal"), None).unwrap().len(), 0);
        let copy = duplicate_event(&c, &m.id).unwrap();
        assert_ne!(copy.id, m.id);
        assert_eq!(copy.title, "Budget sync (copy)");
        delete_event(&c, &m.id).unwrap();
        assert_eq!(all_events(&c).unwrap().len(), 1);
    }

    #[test]
    fn recurring_task_rolls_forward() {
        let c = mem();
        let t = save_task(
            &c,
            Task {
                title: "Water the plants".into(),
                due: Some("2020-01-06T08:00".into()),
                recur: Recurrence { freq: "weekly".into(), interval: 1, ..Default::default() },
                ..Default::default()
            },
        )
        .unwrap();
        let t = set_task_done(&c, &t.id, true).unwrap();
        assert!(!t.done);
        assert!(parse_dt(t.due.as_deref().unwrap()).unwrap() > Local::now().naive_local());
        assert!(t.done_at.is_some());
        let once = save_task(&c, Task { title: "File taxes".into(), ..Default::default() }).unwrap();
        assert!(set_task_done(&c, &once.id, true).unwrap().done);
    }

    #[test]
    fn data_survives_reopening_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("schedulr.db");
        {
            let c = open(&path).unwrap();
            save_event(&c, event("Persisted", "2026-08-15T10:00", "2026-08-15T11:00")).unwrap();
            save_note(&c, Note { kind: "quote".into(), body: "Keep going.".into(), pinned: true, ..Default::default() }).unwrap();
            set_setting(&c, "focus", &serde_json::json!({"dnd": true})).unwrap();
        }
        let c = open(&path).unwrap();
        assert_eq!(all_events(&c).unwrap()[0].title, "Persisted");
        assert!(notes(&c).unwrap()[0].pinned);
        assert!(focus(&c).dnd);
    }
}

//! The reminder engine: works out when reminders are due, fires them through a
//! `Notifier`, records every outcome in `reminder_log`, and catches the ones
//! that came due while the app was not running.

use crate::store::{self, err, fmt_dt, parse_dt, Focus, Res};
use chrono::{Duration, NaiveDateTime, NaiveTime};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

/// A reminder older than this when the engine first sees it is "missed",
/// not shown as if it were on time.
pub const LATE_AFTER_MIN: i64 = 5;
/// Furthest back the engine looks after a long shutdown.
pub const LOOKBACK_DAYS: i64 = 14;

pub trait Notifier {
    fn notify(&self, title: &str, body: &str);
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Item {
    pub key: String,
    /// "event", "task" or "overdue".
    pub source_kind: String,
    pub source_id: String,
    pub title: String,
    pub body: String,
    pub fire_at: String,
    /// upcoming, fired, missed, silenced, snoozed, dismissed, done
    pub status: String,
    pub snooze_until: Option<String>,
    pub category_id: Option<String>,
    /// Start of the event occurrence, or the task's due time.
    pub starts_at: Option<String>,
}

/// Whether notification text uses the 24-hour clock (Settings > 24-hour clock; off by default).
static CLOCK_24: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn clock(d: NaiveDateTime) -> String {
    if CLOCK_24.load(std::sync::atomic::Ordering::Relaxed) {
        d.format("%H:%M").to_string()
    } else {
        d.format("%-I:%M %p").to_string()
    }
}

fn when_phrase(offset: i64, start: NaiveDateTime, all_day: bool) -> String {
    if all_day {
        return match offset {
            o if o >= 1440 => "Tomorrow, all day".into(),
            _ => "Today, all day".into(),
        };
    }
    match offset {
        0 => format!("Starting now, at {}", clock(start)),
        o if o < 60 => format!("Starts in {o} minutes, at {}", clock(start)),
        60 => format!("Starts in 1 hour, at {}", clock(start)),
        o if o % 1440 == 0 && o / 1440 == 1 => format!("Tomorrow at {}", clock(start)),
        o if o % 60 == 0 && o < 1440 => format!("Starts in {} hours, at {}", o / 60, clock(start)),
        _ => format!("{} at {}", start.format("%a %-d %b"), clock(start)),
    }
}

/// Every reminder instance whose fire time falls in `[from, to)`.
pub fn instances(conn: &Connection, from: NaiveDateTime, to: NaiveDateTime) -> Res<Vec<Item>> {
    let h24 = crate::store::get_setting(conn, "clock24h").and_then(|v| v.as_bool()).unwrap_or(false);
    CLOCK_24.store(h24, std::sync::atomic::Ordering::Relaxed);
    let mut out = Vec::new();
    for ev in store::all_events(conn)? {
        if ev.reminders.is_empty() {
            continue;
        }
        let max_offset = ev.reminders.iter().filter_map(|r| r.offset_minutes).max().unwrap_or(0).max(0);
        let occ = store::expand(&ev, from, to + Duration::minutes(max_offset) + Duration::days(1))?;
        let place = if !ev.location.is_empty() { format!(". {}", ev.location) } else { String::new() };
        for r in &ev.reminders {
            if let Some(off) = r.offset_minutes {
                for (s, _) in &occ {
                    // All-day reminders count back from 9 in the morning.
                    let base = if ev.all_day { s.date().and_time(NaiveTime::from_hms_opt(9, 0, 0).unwrap()) } else { *s };
                    let fire = base - Duration::minutes(off.max(0));
                    if fire >= from && fire < to {
                        out.push(Item {
                            key: format!("ev:{}:{}:{}", ev.id, fmt_dt(*s), off),
                            source_kind: "event".into(),
                            source_id: ev.id.clone(),
                            title: ev.title.clone(),
                            body: format!("{}{}", when_phrase(off, *s, ev.all_day), place),
                            fire_at: fmt_dt(fire),
                            status: "upcoming".into(),
                            snooze_until: None,
                            category_id: ev.category_id.clone(),
                            starts_at: Some(fmt_dt(*s)),
                        });
                    }
                }
            } else if let Some(at) = &r.at {
                let fire = parse_dt(at)?;
                if fire >= from && fire < to {
                    let (s, _) = ev.span()?;
                    out.push(Item {
                        key: format!("ev:{}:at:{}", ev.id, at),
                        source_kind: "event".into(),
                        source_id: ev.id.clone(),
                        title: ev.title.clone(),
                        body: format!("{} at {}{}", s.format("%a %-d %b"), clock(s), place),
                        fire_at: fmt_dt(fire),
                        status: "upcoming".into(),
                        snooze_until: None,
                        category_id: ev.category_id.clone(),
                        starts_at: Some(fmt_dt(s)),
                    });
                }
            }
        }
    }
    for t in store::tasks(conn)? {
        if t.done {
            continue;
        }
        let Some(due_s) = &t.due else { continue };
        let due = parse_dt(due_s)?;
        let due = if due_s.len() == 10 { due.date().and_time(NaiveTime::from_hms_opt(17, 0, 0).unwrap()) } else { due };
        if let Some(off) = t.remind_offset {
            let fire = due - Duration::minutes(off.max(0));
            if fire >= from && fire < to {
                out.push(Item {
                    key: format!("task:{}:{}:{}", t.id, due_s, off),
                    source_kind: "task".into(),
                    source_id: t.id.clone(),
                    title: t.title.clone(),
                    body: format!("Due {} at {}", due.format("%a %-d %b"), clock(due)),
                    fire_at: fmt_dt(fire),
                    status: "upcoming".into(),
                    snooze_until: None,
                    category_id: t.category_id.clone(),
                    starts_at: Some(fmt_dt(due)),
                });
            }
        }
        if due >= from && due < to {
            out.push(Item {
                key: format!("overdue:{}:{}", t.id, due_s),
                source_kind: "overdue".into(),
                source_id: t.id.clone(),
                title: t.title.clone(),
                body: "This task is now overdue.".into(),
                fire_at: fmt_dt(due),
                status: "upcoming".into(),
                snooze_until: None,
                category_id: t.category_id.clone(),
                starts_at: Some(fmt_dt(due)),
            });
        }
    }
    out.sort_by(|a, b| a.fire_at.cmp(&b.fire_at));
    Ok(out)
}

pub fn suppressed(focus: &Focus, scope: Option<&str>) -> bool {
    focus.dnd || focus.sleep || (focus.work && scope == Some("personal")) || (focus.personal && scope == Some("work"))
}

fn upsert(conn: &Connection, it: &Item, status: &str, snooze_until: Option<String>) -> Res<()> {
    conn.execute(
        "INSERT INTO reminder_log(key,source_kind,source_id,title,body,fire_at,status,snooze_until,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(key) DO UPDATE SET status=excluded.status, snooze_until=excluded.snooze_until, updated_at=excluded.updated_at",
        params![it.key, it.source_kind, it.source_id, it.title, it.body, it.fire_at, status, snooze_until, store::now_str()],
    )
    .map_err(err)?;
    Ok(())
}

fn logged(conn: &Connection, key: &str) -> Res<Option<String>> {
    conn.query_row("SELECT status FROM reminder_log WHERE key=?1", [key], |r| r.get(0)).optional().map_err(err)
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickReport {
    pub fired: Vec<Item>,
    pub missed: Vec<Item>,
    pub silenced: Vec<Item>,
}

impl TickReport {
    pub fn changed(&self) -> bool {
        !(self.fired.is_empty() && self.missed.is_empty() && self.silenced.is_empty())
    }
}

/// One pass of the engine. Safe to call as often as you like: every instance
/// is recorded in `reminder_log`, so nothing fires twice.
pub fn tick(conn: &Connection, now: NaiveDateTime, notifier: &dyn Notifier) -> Res<TickReport> {
    let focus = store::focus(conn);
    let last_seen = store::get_setting(conn, "lastSeen")
        .and_then(|v| v.as_str().and_then(|s| parse_dt(s).ok()))
        .unwrap_or(now - Duration::minutes(1));
    let from = (last_seen - Duration::minutes(1)).max(now - Duration::days(LOOKBACK_DAYS));
    let mut report = TickReport::default();

    for mut it in instances(conn, from, now + Duration::seconds(1))? {
        if logged(conn, &it.key)?.is_some() {
            continue;
        }
        let fire = parse_dt(&it.fire_at)?;
        let scope = store::category_scope(conn, it.category_id.as_deref());
        if now - fire > Duration::minutes(LATE_AFTER_MIN) {
            upsert(conn, &it, "missed", None)?;
            it.status = "missed".into();
            report.missed.push(it);
        } else if suppressed(&focus, scope.as_deref()) {
            upsert(conn, &it, "silenced", None)?;
            it.status = "silenced".into();
            report.silenced.push(it);
        } else {
            notifier.notify(&it.title, &it.body);
            upsert(conn, &it, "fired", None)?;
            it.status = "fired".into();
            report.fired.push(it);
        }
    }

    // Snoozed reminders whose snooze has run out come back.
    let due_snoozes: Vec<Item> = {
        let mut st = conn
            .prepare("SELECT key,source_kind,source_id,title,body,fire_at,snooze_until FROM reminder_log WHERE status='snoozed' AND snooze_until <= ?1")
            .map_err(err)?;
        let rows = st
            .query_map([fmt_dt(now)], |r| {
                Ok(Item {
                    key: r.get(0)?,
                    source_kind: r.get(1)?,
                    source_id: r.get(2)?,
                    title: r.get(3)?,
                    body: r.get(4)?,
                    fire_at: r.get(5)?,
                    snooze_until: r.get(6)?,
                    ..Default::default()
                })
            })
            .map_err(err)?;
        rows.collect::<Result<_, _>>().map_err(err)?
    };
    for mut it in due_snoozes {
        let cat: Option<String> = match it.source_kind.as_str() {
            "event" => conn.query_row("SELECT category_id FROM events WHERE id=?1", [&it.source_id], |r| r.get(0)).optional().map_err(err)?.flatten(),
            _ => conn.query_row("SELECT category_id FROM tasks WHERE id=?1", [&it.source_id], |r| r.get(0)).optional().map_err(err)?.flatten(),
        };
        let scope = store::category_scope(conn, cat.as_deref());
        if suppressed(&focus, scope.as_deref()) {
            upsert(conn, &it, "silenced", None)?;
            it.status = "silenced".into();
            report.silenced.push(it);
        } else {
            notifier.notify(&it.title, &format!("Snoozed reminder. {}", it.body));
            upsert(conn, &it, "fired", None)?;
            it.status = "fired".into();
            report.fired.push(it);
        }
    }

    if !report.missed.is_empty() && !(focus.dnd || focus.sleep) {
        let n = report.missed.len();
        let title = if n == 1 { "You missed a reminder".to_string() } else { format!("You missed {n} reminders") };
        let names: Vec<&str> = report.missed.iter().take(3).map(|i| i.title.as_str()).collect();
        notifier.notify(&title, &format!("While Schedulr was closed or asleep: {}", names.join(", ")));
    }
    store::set_setting(conn, "lastSeen", &serde_json::json!(fmt_dt(now)))?;
    Ok(report)
}

/// What the app shows: reminders waiting for you, then the next 7 days.
pub fn feed(conn: &Connection, now: NaiveDateTime) -> Res<Vec<Item>> {
    let since = fmt_dt(now - Duration::days(LOOKBACK_DAYS));
    let mut items: Vec<Item> = {
        let mut st = conn
            .prepare(
                "SELECT key,source_kind,source_id,title,body,fire_at,status,snooze_until FROM reminder_log
                 WHERE status IN ('fired','missed','silenced','snoozed') AND fire_at >= ?1 ORDER BY fire_at DESC",
            )
            .map_err(err)?;
        let rows = st
            .query_map([since], |r| {
                Ok(Item {
                    key: r.get(0)?,
                    source_kind: r.get(1)?,
                    source_id: r.get(2)?,
                    title: r.get(3)?,
                    body: r.get(4)?,
                    fire_at: r.get(5)?,
                    status: r.get(6)?,
                    snooze_until: r.get(7)?,
                    ..Default::default()
                })
            })
            .map_err(err)?;
        rows.collect::<Result<_, _>>().map_err(err)?
    };
    // Only keep reminders whose source still exists.
    items.retain(|it| {
        let table = if it.source_kind == "event" { "events" } else { "tasks" };
        conn.query_row(&format!("SELECT 1 FROM {table} WHERE id=?1"), [&it.source_id], |_| Ok(())).optional().ok().flatten().is_some()
    });
    for it in items.iter_mut() {
        if it.source_kind == "event" {
            it.category_id = conn.query_row("SELECT category_id FROM events WHERE id=?1", [&it.source_id], |r| r.get(0)).optional().ok().flatten().flatten();
        } else {
            it.category_id = conn.query_row("SELECT category_id FROM tasks WHERE id=?1", [&it.source_id], |r| r.get(0)).optional().ok().flatten().flatten();
        }
    }
    for it in instances(conn, now, now + Duration::days(7))? {
        if logged(conn, &it.key)?.is_none() {
            items.push(it);
        }
    }
    Ok(items)
}

pub fn snooze(conn: &Connection, it: &Item, minutes: i64, now: NaiveDateTime) -> Res<()> {
    let base = parse_dt(&it.fire_at).map(|f| f.max(now)).unwrap_or(now);
    let base = if it.status == "upcoming" { base } else { now };
    upsert(conn, it, "snoozed", Some(fmt_dt(base + Duration::minutes(minutes.clamp(1, 24 * 60)))))
}

pub fn dismiss(conn: &Connection, it: &Item) -> Res<()> {
    upsert(conn, it, "dismissed", None)
}

pub fn complete(conn: &Connection, it: &Item) -> Res<()> {
    if it.source_kind == "task" || it.source_kind == "overdue" {
        store::set_task_done(conn, &it.source_id, true)?;
    }
    upsert(conn, it, "done", None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::tests::{event, mem};
    use crate::store::{save_event, save_task, set_setting, ReminderSpec, Task};
    use std::cell::RefCell;

    #[derive(Default)]
    struct Spy(RefCell<Vec<String>>);
    impl Notifier for Spy {
        fn notify(&self, title: &str, _body: &str) {
            self.0.borrow_mut().push(title.to_string());
        }
    }

    fn at(s: &str) -> NaiveDateTime {
        parse_dt(s).unwrap()
    }

    fn with_reminders(title: &str, start: &str, end: &str, offsets: &[i64]) -> store::Event {
        let mut e = event(title, start, end);
        e.reminders = offsets.iter().map(|o| ReminderSpec { offset_minutes: Some(*o), ..Default::default() }).collect();
        e
    }

    #[test]
    fn fires_once_at_the_right_time() {
        let c = mem();
        save_event(&c, with_reminders("Dentist", "2026-08-15T10:00", "2026-08-15T11:00", &[15, 0])).unwrap();
        let spy = Spy::default();
        set_setting(&c, "lastSeen", &serde_json::json!("2026-08-15T09:40")).unwrap();
        assert!(tick(&c, at("2026-08-15T09:44"), &spy).unwrap().fired.is_empty());
        let r = tick(&c, at("2026-08-15T09:45"), &spy).unwrap();
        assert_eq!(r.fired.len(), 1);
        assert!(r.fired[0].body.starts_with("Starts in 15 minutes"));
        assert!(tick(&c, at("2026-08-15T09:46"), &spy).unwrap().fired.is_empty(), "no duplicates");
        assert_eq!(tick(&c, at("2026-08-15T10:00"), &spy).unwrap().fired.len(), 1);
        assert_eq!(spy.0.borrow().len(), 2);
    }

    #[test]
    fn detects_missed_reminders_after_a_restart() {
        let c = mem();
        save_event(&c, with_reminders("Board meeting", "2026-08-15T10:00", "2026-08-15T11:00", &[60, 10])).unwrap();
        set_setting(&c, "lastSeen", &serde_json::json!("2026-08-15T08:00")).unwrap();
        let spy = Spy::default();
        // App was closed from 08:00 until 12:00.
        let r = tick(&c, at("2026-08-15T12:00"), &spy).unwrap();
        assert_eq!(r.missed.len(), 2);
        assert!(r.fired.is_empty());
        assert_eq!(spy.0.borrow().as_slice(), ["You missed 2 reminders"]);
        let f = feed(&c, at("2026-08-15T12:00")).unwrap();
        assert_eq!(f.iter().filter(|i| i.status == "missed").count(), 2);
    }

    #[test]
    fn focus_modes_silence_the_right_reminders() {
        let c = mem();
        let mut personal = with_reminders("Yoga", "2026-08-15T10:00", "2026-08-15T11:00", &[0]);
        personal.category_id = Some("personal".into());
        save_event(&c, personal).unwrap();
        save_event(&c, with_reminders("Sprint review", "2026-08-15T10:00", "2026-08-15T11:00", &[0])).unwrap();
        set_setting(&c, "focus", &serde_json::json!({"work": true})).unwrap();
        set_setting(&c, "lastSeen", &serde_json::json!("2026-08-15T09:58")).unwrap();
        let spy = Spy::default();
        let r = tick(&c, at("2026-08-15T10:00"), &spy).unwrap();
        assert_eq!(r.fired.iter().map(|i| i.title.as_str()).collect::<Vec<_>>(), ["Sprint review"]);
        assert_eq!(r.silenced[0].title, "Yoga");
    }

    #[test]
    fn snooze_brings_a_reminder_back() {
        let c = mem();
        save_event(&c, with_reminders("Call the bank", "2026-08-15T10:00", "2026-08-15T10:15", &[0])).unwrap();
        set_setting(&c, "lastSeen", &serde_json::json!("2026-08-15T09:59")).unwrap();
        let spy = Spy::default();
        let fired = tick(&c, at("2026-08-15T10:00"), &spy).unwrap().fired.remove(0);
        snooze(&c, &fired, 10, at("2026-08-15T10:01")).unwrap();
        assert!(tick(&c, at("2026-08-15T10:05"), &spy).unwrap().fired.is_empty());
        let back = tick(&c, at("2026-08-15T10:11"), &spy).unwrap();
        assert_eq!(back.fired.len(), 1);
        dismiss(&c, &back.fired[0]).unwrap();
        assert!(feed(&c, at("2026-08-15T10:12")).unwrap().iter().all(|i| i.key != fired.key));
    }

    #[test]
    fn task_reminders_overdue_alerts_and_completion() {
        let c = mem();
        let t = save_task(&c, Task { title: "Send invoice".into(), due: Some("2026-08-15T17:00".into()), remind_offset: Some(30), ..Default::default() }).unwrap();
        set_setting(&c, "lastSeen", &serde_json::json!("2026-08-15T16:29")).unwrap();
        let spy = Spy::default();
        assert_eq!(tick(&c, at("2026-08-15T16:30"), &spy).unwrap().fired[0].source_kind, "task");
        let overdue = tick(&c, at("2026-08-15T17:00"), &spy).unwrap().fired.remove(0);
        assert_eq!(overdue.source_kind, "overdue");
        complete(&c, &overdue).unwrap();
        assert!(store::get_task(&c, &t.id).unwrap().done);
    }

    #[test]
    fn upcoming_feed_lists_next_week_and_honours_dismissal() {
        let c = mem();
        save_event(&c, with_reminders("Flight", "2026-08-20T06:00", "2026-08-20T09:00", &[1440])).unwrap();
        let f = feed(&c, at("2026-08-15T12:00")).unwrap();
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].status, "upcoming");
        assert_eq!(f[0].fire_at, "2026-08-19T06:00");
        dismiss(&c, &f[0]).unwrap();
        assert!(feed(&c, at("2026-08-15T12:00")).unwrap().is_empty());
        let spy = Spy::default();
        set_setting(&c, "lastSeen", &serde_json::json!("2026-08-19T05:59")).unwrap();
        assert!(tick(&c, at("2026-08-19T06:00"), &spy).unwrap().fired.is_empty(), "dismissed in advance");
    }

    #[test]
    fn notification_times_use_the_12_hour_clock_by_default() {
        let t = chrono::NaiveDate::from_ymd_opt(2026, 11, 22).unwrap().and_hms_opt(21, 5, 0).unwrap();
        CLOCK_24.store(false, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(clock(t), "9:05 PM");
        CLOCK_24.store(true, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(clock(t), "21:05");
        CLOCK_24.store(false, std::sync::atomic::Ordering::Relaxed);
    }
}

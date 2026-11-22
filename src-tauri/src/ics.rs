//! iCalendar (.ics) export, so events can be sent as invitations or opened in
//! another calendar app.

use crate::store::{parse_dt, Event, Res};
use chrono::Local;

fn esc(s: &str) -> String {
    s.replace('\\', "\\\\").replace(';', "\\;").replace(',', "\\,").replace("\r\n", "\\n").replace('\n', "\\n")
}

/// Lines longer than 75 octets are folded, as RFC 5545 asks.
fn fold(line: &str) -> String {
    let mut out = String::new();
    let mut len = 0;
    for ch in line.chars() {
        let w = ch.len_utf8();
        if len + w > 74 {
            out.push_str("\r\n ");
            len = 1;
        }
        out.push(ch);
        len += w;
    }
    out
}

fn vevent(ev: &Event) -> Res<Vec<String>> {
    let mut l = vec!["BEGIN:VEVENT".to_string()];
    l.push(format!("UID:{}@schedulr.local", ev.id));
    l.push(format!("DTSTAMP:{}", chrono::Utc::now().format("%Y%m%dT%H%M%SZ")));
    let (s, e) = ev.span()?;
    if ev.all_day {
        l.push(format!("DTSTART;VALUE=DATE:{}", s.format("%Y%m%d")));
        l.push(format!("DTEND;VALUE=DATE:{}", e.format("%Y%m%d")));
    } else {
        // Floating local times: the event happens at this wall-clock time.
        l.push(format!("DTSTART:{}", s.format("%Y%m%dT%H%M00")));
        l.push(format!("DTEND:{}", e.format("%Y%m%dT%H%M00")));
    }
    l.push(format!("SUMMARY:{}", esc(&ev.title)));
    let mut desc = ev.description.clone();
    if !ev.agenda.is_empty() {
        if !desc.is_empty() {
            desc.push_str("\n\n");
        }
        desc.push_str("Agenda:\n");
        desc.push_str(&ev.agenda);
    }
    if !ev.meeting_url.is_empty() {
        if !desc.is_empty() {
            desc.push_str("\n\n");
        }
        desc.push_str("Join: ");
        desc.push_str(&ev.meeting_url);
        l.push(format!("URL:{}", ev.meeting_url));
    }
    if !desc.is_empty() {
        l.push(format!("DESCRIPTION:{}", esc(&desc)));
    }
    if !ev.location.is_empty() {
        l.push(format!("LOCATION:{}", esc(&ev.location)));
    } else if !ev.meeting_url.is_empty() {
        l.push(format!("LOCATION:{}", esc(&ev.meeting_url)));
    }
    if ev.recur.freq != "none" && !ev.recur.freq.is_empty() {
        let mut rule = format!("RRULE:FREQ={};INTERVAL={}", ev.recur.freq.to_uppercase(), ev.recur.interval.max(1));
        if ev.recur.freq == "weekly" && !ev.recur.weekdays.is_empty() {
            let names = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
            let days: Vec<&str> = ev.recur.weekdays.iter().filter_map(|d| names.get((*d as usize).wrapping_sub(1)).copied()).collect();
            rule.push_str(&format!(";BYDAY={}", days.join(",")));
        }
        if let Some(c) = ev.recur.count.filter(|c| *c > 0) {
            rule.push_str(&format!(";COUNT={c}"));
        } else if let Some(u) = ev.recur.until.as_deref().filter(|u| !u.is_empty()) {
            rule.push_str(&format!(";UNTIL={}T235959", u[..10].replace('-', "")));
        }
        l.push(rule);
    }
    for p in &ev.participants {
        if p.email.is_empty() {
            continue;
        }
        l.push(format!("ATTENDEE;CN={};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:{}", esc(&p.name), p.email));
    }
    for r in &ev.reminders {
        let trigger = if let Some(off) = r.offset_minutes {
            format!("TRIGGER:-PT{}M", off.max(0))
        } else if let Some(at) = &r.at {
            let d = parse_dt(at)? - s;
            let mins = d.num_minutes();
            if mins <= 0 { format!("TRIGGER:-PT{}M", -mins) } else { format!("TRIGGER:PT{mins}M") }
        } else {
            continue;
        };
        l.extend(["BEGIN:VALARM".into(), "ACTION:DISPLAY".into(), format!("DESCRIPTION:{}", esc(&ev.title)), trigger, "END:VALARM".into()]);
    }
    l.push("END:VEVENT".into());
    Ok(l)
}

pub fn calendar(events: &[Event]) -> Res<String> {
    let mut lines = vec![
        "BEGIN:VCALENDAR".to_string(),
        "VERSION:2.0".into(),
        "PRODID:-//Schedulr//Desktop Scheduler//EN".into(),
        "CALSCALE:GREGORIAN".into(),
        format!("X-WR-CALNAME:Schedulr export {}", Local::now().format("%Y-%m-%d")),
    ];
    if events.len() == 1 && !events[0].participants.is_empty() {
        lines.push("METHOD:REQUEST".into());
    }
    for ev in events {
        lines.extend(vevent(ev)?);
    }
    lines.push("END:VCALENDAR".into());
    Ok(lines.iter().map(|l| fold(l)).collect::<Vec<_>>().join("\r\n") + "\r\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::{Participant, Recurrence, ReminderSpec};

    #[test]
    fn writes_a_valid_invitation() {
        let ev = Event {
            id: "abc".into(),
            title: "Planning, Q3".into(),
            start: "2026-08-15T10:00".into(),
            end: "2026-08-15T11:00".into(),
            meeting_url: "https://meet.example.com/xyz".into(),
            participants: vec![Participant { name: "Ana".into(), email: "ana@example.com".into() }],
            recur: Recurrence { freq: "weekly".into(), interval: 1, weekdays: vec![1, 3], count: Some(4), until: None },
            reminders: vec![ReminderSpec { offset_minutes: Some(10), ..Default::default() }],
            ..Default::default()
        };
        let ics = calendar(&[ev]).unwrap();
        assert!(ics.contains("SUMMARY:Planning\\, Q3"));
        assert!(ics.contains("DTSTART:20260815T100000"));
        assert!(ics.contains("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE;COUNT=4"));
        assert!(ics.contains("ATTENDEE;CN=Ana"));
        assert!(ics.contains("METHOD:REQUEST"));
        assert!(ics.contains("TRIGGER:-PT10M"));
        assert!(ics.lines().all(|l| l.len() <= 76));
    }
}

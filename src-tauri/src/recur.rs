//! Recurrence expansion for events and tasks.
//!
//! Times are local wall-clock times (`NaiveDateTime`) interpreted in the
//! operating system's time zone, which is what a desktop planner expects.

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, Weekday};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Freq {
    None,
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

impl Freq {
    pub fn parse(s: &str) -> Freq {
        match s {
            "daily" => Freq::Daily,
            "weekly" => Freq::Weekly,
            "monthly" => Freq::Monthly,
            "yearly" => Freq::Yearly,
            _ => Freq::None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Rule {
    pub freq: Freq,
    pub interval: u32,
    /// ISO weekdays, 1 = Monday … 7 = Sunday. Only used for weekly rules.
    pub weekdays: Vec<u32>,
    /// Last date (inclusive) on which an occurrence may start.
    pub until: Option<NaiveDate>,
    /// Total number of occurrences, counted from the first.
    pub count: Option<u32>,
}

impl Rule {
    #[cfg(test)]
    pub fn none() -> Rule {
        Rule { freq: Freq::None, interval: 1, weekdays: vec![], until: None, count: None }
    }
}

/// Hard ceiling so a bad rule can never spin forever.
const MAX_STEPS: usize = 20_000;

fn add_months(d: NaiveDate, months: i32) -> Option<NaiveDate> {
    let total = d.year() * 12 + d.month0() as i32 + months;
    let (y, m0) = (total.div_euclid(12), total.rem_euclid(12));
    NaiveDate::from_ymd_opt(y, m0 as u32 + 1, d.day())
}

fn weekday_num(w: Weekday) -> u32 {
    w.number_from_monday()
}

/// Every occurrence start, in order, calling `visit` until it returns false.
fn walk(start: NaiveDateTime, rule: &Rule, mut visit: impl FnMut(NaiveDateTime) -> bool) {
    let interval = rule.interval.max(1) as i64;
    let time = start.time();
    let mut emitted: u32 = 0;
    let mut emit = |dt: NaiveDateTime, visit: &mut dyn FnMut(NaiveDateTime) -> bool| -> bool {
        if let Some(u) = rule.until {
            if dt.date() > u {
                return false;
            }
        }
        if let Some(c) = rule.count {
            if emitted >= c {
                return false;
            }
        }
        emitted += 1;
        visit(dt)
    };
    match rule.freq {
        Freq::None => {
            emit(start, &mut visit);
        }
        Freq::Daily => {
            for i in 0..MAX_STEPS as i64 {
                let dt = start + Duration::days(i * interval);
                if !emit(dt, &mut visit) {
                    break;
                }
            }
        }
        Freq::Weekly => {
            let mut days: Vec<u32> = rule.weekdays.iter().copied().filter(|d| (1..=7).contains(d)).collect();
            if days.is_empty() {
                days.push(weekday_num(start.weekday()));
            }
            days.sort_unstable();
            days.dedup();
            let week0 = start.date() - Duration::days(weekday_num(start.weekday()) as i64 - 1);
            'outer: for w in 0..(MAX_STEPS as i64) {
                let monday = week0 + Duration::weeks(w * interval);
                for d in &days {
                    let date = monday + Duration::days(*d as i64 - 1);
                    if date < start.date() {
                        continue;
                    }
                    if !emit(date.and_time(time), &mut visit) {
                        break 'outer;
                    }
                }
            }
        }
        Freq::Monthly | Freq::Yearly => {
            let step = if rule.freq == Freq::Monthly { interval as i32 } else { 12 * interval as i32 };
            for i in 0..MAX_STEPS as i32 {
                // Months without that day (31st, Feb 29) are skipped, as most calendars do.
                let Some(date) = add_months(start.date(), i * step) else { continue };
                if let Some(u) = rule.until {
                    if date > u {
                        break;
                    }
                }
                if !emit(date.and_time(time), &mut visit) {
                    break;
                }
            }
        }
    }
}

/// Occurrence starts whose span `[start, start + dur)` overlaps `[from, to)`.
pub fn occurrences(
    start: NaiveDateTime,
    dur: Duration,
    rule: &Rule,
    from: NaiveDateTime,
    to: NaiveDateTime,
) -> Vec<NaiveDateTime> {
    let mut out = Vec::new();
    let dur = if dur < Duration::zero() { Duration::zero() } else { dur };
    walk(start, rule, |s| {
        if s >= to {
            return false;
        }
        let e = if dur.is_zero() { s + Duration::seconds(1) } else { s + dur };
        if e > from {
            out.push(s);
        }
        true
    });
    out
}

/// The first occurrence strictly after `after`, used to roll recurring tasks forward.
pub fn next_after(start: NaiveDateTime, rule: &Rule, after: NaiveDateTime) -> Option<NaiveDateTime> {
    let mut found = None;
    walk(start, rule, |s| {
        if s > after {
            found = Some(s);
            return false;
        }
        true
    });
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").unwrap()
    }

    #[test]
    fn single_event_in_and_out_of_range() {
        let r = Rule::none();
        let s = dt("2026-08-15T10:00");
        assert_eq!(occurrences(s, Duration::hours(1), &r, dt("2026-08-15T00:00"), dt("2026-08-16T00:00")).len(), 1);
        assert!(occurrences(s, Duration::hours(1), &r, dt("2026-08-16T00:00"), dt("2026-08-17T00:00")).is_empty());
        // An event that started before the window but is still running overlaps it.
        assert_eq!(occurrences(s, Duration::hours(3), &r, dt("2026-08-15T12:00"), dt("2026-08-15T18:00")).len(), 1);
    }

    #[test]
    fn daily_with_interval_and_count() {
        let r = Rule { freq: Freq::Daily, interval: 2, weekdays: vec![], until: None, count: Some(3) };
        let occ = occurrences(dt("2026-08-01T09:00"), Duration::minutes(30), &r, dt("2026-07-01T00:00"), dt("2026-09-01T00:00"));
        assert_eq!(occ, vec![dt("2026-08-01T09:00"), dt("2026-08-03T09:00"), dt("2026-08-05T09:00")]);
    }

    #[test]
    fn weekly_on_chosen_days_until() {
        // 2026-08-03 is a Monday.
        let r = Rule { freq: Freq::Weekly, interval: 1, weekdays: vec![1, 3, 5], until: NaiveDate::from_ymd_opt(2026, 8, 12), count: None };
        let occ = occurrences(dt("2026-08-03T08:30"), Duration::hours(1), &r, dt("2026-08-01T00:00"), dt("2026-09-01T00:00"));
        let days: Vec<u32> = occ.iter().map(|d| d.day()).collect();
        assert_eq!(days, vec![3, 5, 7, 10, 12]);
    }

    #[test]
    fn monthly_skips_missing_days() {
        let r = Rule { freq: Freq::Monthly, interval: 1, weekdays: vec![], until: None, count: Some(4) };
        let occ = occurrences(dt("2026-01-31T12:00"), Duration::hours(1), &r, dt("2026-01-01T00:00"), dt("2027-01-01T00:00"));
        let months: Vec<u32> = occ.iter().map(|d| d.month()).collect();
        assert_eq!(months, vec![1, 3, 5, 7]);
    }

    #[test]
    fn next_after_rolls_forward() {
        let r = Rule { freq: Freq::Weekly, interval: 1, weekdays: vec![], until: None, count: None };
        assert_eq!(next_after(dt("2026-08-03T09:00"), &r, dt("2026-08-03T09:00")), Some(dt("2026-08-10T09:00")));
    }
}

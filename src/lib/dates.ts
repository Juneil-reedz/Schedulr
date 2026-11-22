import { addDays, format, startOfMonth, startOfWeek } from "date-fns";

const pad = (n: number) => String(n).padStart(2, "0");

export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dtStr = (d: Date) => `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" as local time. */
export function parse(s: string): Date {
  const [d, t] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, day, hh || 0, mm || 0, 0, 0);
}

export const isDateOnly = (s: string) => s.length === 10;

export function fmtTime(d: Date, h24: boolean) {
  return h24 ? format(d, "HH:mm") : format(d, "h:mm a");
}

export function fmtWhen(s: string, h24: boolean, withDay = true) {
  const d = parse(s);
  if (isDateOnly(s)) return format(d, "EEE d MMM");
  return withDay ? `${format(d, "EEE d MMM")}, ${fmtTime(d, h24)}` : fmtTime(d, h24);
}

export function relDay(d: Date, now = new Date()) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return format(d, "EEEE d MMMM");
}

/** "in 2 h 05 min", "12 min ago" */
export function countdown(target: Date, now: Date) {
  let ms = target.getTime() - now.getTime();
  const past = ms < 0;
  ms = Math.abs(ms);
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  let s: string;
  if (mins < 1) return past ? "just now" : "now";
  if (days > 0) s = `${days} d ${hours} h`;
  else if (hours > 0) s = `${hours} h ${pad(m)} min`;
  else s = `${m} min`;
  return past ? `${s} ago` : `in ${s}`;
}

/** Six-week grid that starts on Monday. */
export function monthGrid(month: Date) {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export const WEEKDAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function minutesLabel(m: number) {
  if (m === 0) return "At start";
  if (m < 60) return `${m} min before`;
  if (m === 60) return "1 hour before";
  if (m % 1440 === 0) return m === 1440 ? "1 day before" : `${m / 1440} days before`;
  if (m % 60 === 0) return `${m / 60} hours before`;
  return `${m} min before`;
}

/** Day-of-year, used to rotate the daily message. */
export function dayOfYear(d = new Date()) {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

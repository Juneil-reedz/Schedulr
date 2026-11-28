/**
 * Browser preview backend. The desktop app talks to Rust and SQLite; when the
 * interface is opened in a plain browser (for design work and tests) this
 * in-memory stand-in answers the same commands. Nothing here is saved.
 */
import { addDays, addMinutes } from "date-fns";
import { dateStr, dtStr, parse } from "./dates";
import type { Boot, Category, Note, Occurrence, ReminderItem, SchedEvent, Settings, Task } from "./types";

const categories: Category[] = [
  { id: "work", name: "Work", color: "#234B38", scope: "work" },
  { id: "meetings", name: "Meetings", color: "#BB6545", scope: "work" },
  { id: "personal", name: "Personal", color: "#D97878", scope: "personal" },
  { id: "health", name: "Health", color: "#8D9C73", scope: "personal" },
  { id: "family", name: "Family & friends", color: "#E5A72E", scope: "personal" },
];

let events: SchedEvent[] = [];
let tasks: Task[] = [];
let notes: Note[] = [];
let settings: Settings = { closeToTray: true, snoozeMinutes: 10, clock24h: false };
const log = new Map<string, ReminderItem>();
let n = 0;
const id = () => `p${Date.now().toString(36)}${(n++).toString(36)}`;
const now = () => dtStr(new Date());

function blankEvent(): SchedEvent {
  return {
    id: "", kind: "event", title: "", description: "", categoryId: null, start: "", end: "", allDay: false,
    locationType: "none", location: "", meetingUrl: "", participants: [], agenda: "",
    recur: { freq: "none", interval: 1, weekdays: [], until: null, count: null }, important: false, imagePath: null,
    reminders: [], createdAt: "", updatedAt: "",
  };
}

function span(e: SchedEvent): [Date, Date] {
  const s = parse(e.start);
  let en = parse(e.end);
  if (e.allDay) en = addDays(en, 1);
  return [s, en < s ? s : en];
}

function walk(e: SchedEvent, to: Date, visit: (d: Date) => void) {
  const [s] = span(e);
  const r = e.recur;
  const until = r.until ? addDays(parse(r.until), 1) : null;
  let count = 0;
  const emit = (d: Date) => {
    if (d >= to || (until && d >= until) || (r.count && count >= r.count)) return false;
    count++;
    visit(d);
    return true;
  };
  const step = Math.max(1, r.interval || 1);
  if (r.freq === "none") return void emit(s);
  for (let i = 0; i < 5000; i++) {
    if (r.freq === "daily") {
      if (!emit(addDays(s, i * step))) return;
    } else if (r.freq === "weekly") {
      const days = r.weekdays.length ? [...r.weekdays].sort() : [((s.getDay() + 6) % 7) + 1];
      const monday = addDays(s, -((s.getDay() + 6) % 7) + i * 7 * step);
      for (const wd of days) {
        const d = addDays(monday, wd - 1);
        d.setHours(s.getHours(), s.getMinutes());
        if (d < s) continue;
        if (!emit(d)) return;
      }
    } else {
      const months = r.freq === "monthly" ? i * step : i * 12 * step;
      const d = new Date(s.getFullYear(), s.getMonth() + months, s.getDate(), s.getHours(), s.getMinutes());
      if (d.getDate() !== s.getDate()) continue;
      if (!emit(d)) return;
    }
  }
}

function occurrences(from: string, to: string): Occurrence[] {
  const f = parse(from), t = parse(to);
  const out: (Occurrence & { s: Date; e: Date })[] = [];
  for (const ev of events) {
    const [s0, e0] = span(ev);
    const dur = e0.getTime() - s0.getTime();
    walk(ev, t, (s) => {
      const e = new Date(s.getTime() + dur);
      if (e <= f) return;
      out.push({
        key: `${ev.id}@${dtStr(s)}`, event: ev, conflict: false, s, e,
        start: ev.allDay ? dateStr(s) : dtStr(s), end: ev.allDay ? dateStr(addDays(e, -1)) : dtStr(e),
      });
    });
  }
  for (const a of out) {
    if (a.event.allDay) continue;
    a.conflict = out.some((b) => b !== a && !b.event.allDay && a.s < b.e && b.s < a.e);
  }
  return out
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(({ s: _s, e: _e, ...o }) => o);
}

function reminderInstances(from: Date, to: Date): ReminderItem[] {
  const out: ReminderItem[] = [];
  for (const ev of events) {
    for (const r of ev.reminders) {
      if (r.offsetMinutes == null) continue;
      walk(ev, addDays(to, 8), (s) => {
        const base = ev.allDay ? new Date(s.getFullYear(), s.getMonth(), s.getDate(), 9) : s;
        const fire = addMinutes(base, -r.offsetMinutes!);
        if (fire < from || fire >= to) return;
        out.push({
          key: `ev:${ev.id}:${dtStr(s)}:${r.offsetMinutes}`, sourceKind: "event", sourceId: ev.id, title: ev.title,
          body: ev.location || (ev.meetingUrl ? "Online" : ""), fireAt: dtStr(fire), status: "upcoming",
          snoozeUntil: null, categoryId: ev.categoryId, startsAt: dtStr(s),
        });
      });
    }
  }
  for (const t of tasks) {
    if (t.done || !t.due) continue;
    const due = parse(t.due);
    if (t.remindOffset != null) {
      const fire = addMinutes(due, -t.remindOffset);
      if (fire >= from && fire < to)
        out.push({ key: `task:${t.id}:${t.due}:${t.remindOffset}`, sourceKind: "task", sourceId: t.id, title: t.title, body: "Task due", fireAt: dtStr(fire), status: "upcoming", snoozeUntil: null, categoryId: t.categoryId, startsAt: t.due });
    }
  }
  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

function seed() {
  // ?sample=clean (for screenshots and the trailer) uses real-looking names without the "Sample" labels.
  const clean = new URLSearchParams(window.location.search).get("sample") === "clean";
  const S = (t: string) => (clean ? t.charAt(0).toUpperCase() + t.slice(1) : `Sample: ${t}`);
  const today = new Date();
  const d = (offset: number, h: number, m = 0) => dtStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, h, m));
  const mk = (p: Partial<SchedEvent>): SchedEvent => ({ ...blankEvent(), id: id(), createdAt: now(), updatedAt: now(), ...p });
  events = [
    mk({ kind: "meeting", title: S("design review"), categoryId: "meetings", start: d(0, 15, 0), end: d(0, 16, 0), important: true, locationType: "online", meetingUrl: "https://meet.example.com/sample", participants: [{ name: clean ? "Jordan" : "Sample person", email: "person@example.com" }], agenda: clean ? "Review the new screens" : "Sample agenda item", reminders: [{ id: "", offsetMinutes: 15, at: null }] }),
    mk({ title: S("stand-up"), categoryId: "work", start: d(-3, 9, 30), end: d(-3, 9, 45), recur: { freq: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5], until: null, count: null }, reminders: [{ id: "", offsetMinutes: 5, at: null }] }),
    mk({ title: S("pottery class"), categoryId: "personal", start: d(2, 18, 0), end: d(2, 20, 0), locationType: "physical", location: clean ? "Clay studio" : "Sample studio", reminders: [{ id: "", offsetMinutes: 60, at: null }] }),
    mk({ title: S("weekend away"), categoryId: "family", allDay: true, start: dateStr(addDays(today, 5)), end: dateStr(addDays(today, 6)) }),
    mk({ title: S("dentist"), categoryId: "health", start: d(1, 15, 30), end: d(1, 16, 15), reminders: [{ id: "", offsetMinutes: 1440, at: null }] }),
  ];
  tasks = [
    { id: id(), title: S("send the slides"), notes: "", categoryId: "work", due: d(0, 17), priority: 2, done: false, doneAt: null, eventId: null, recur: { freq: "none", interval: 1, weekdays: [], until: null, count: null }, remindOffset: 30, createdAt: now(), updatedAt: now() },
    { id: id(), title: S("water the plants"), notes: "", categoryId: "personal", due: d(1, 8), priority: 1, done: false, doneAt: null, eventId: null, recur: { freq: "weekly", interval: 1, weekdays: [], until: null, count: null }, remindOffset: null, createdAt: now(), updatedAt: now() },
    { id: id(), title: S("book flights"), notes: "", categoryId: "family", due: null, priority: 1, done: true, doneAt: now(), eventId: null, recur: { freq: "none", interval: 1, weekdays: [], until: null, count: null }, remindOffset: null, createdAt: now(), updatedAt: now() },
  ];
  notes = [
    { id: id(), kind: "quote", body: clean ? "Plant what you want to see bloom." : "Sample quote: plant what you want to see bloom.", author: clean ? "" : "Sample", pinned: false, createdAt: now(), updatedAt: now() },
    { id: id(), kind: "note", body: "Sample note: bring the blue folder on Friday.", author: "", pinned: true, createdAt: now(), updatedAt: now() },
  ];
  settings = { ...settings, focus: { dnd: false, work: false, personal: false, sleep: false } };
}

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("sample")) seed();

type Args = Record<string, any>;

export async function previewInvoke<T>(cmd: string, a: Args = {}): Promise<T> {
  const r = ((): unknown => {
    switch (cmd) {
      case "bootstrap":
        return { settings, categories, version: "preview", timezone: "", paths: { data: "(browser preview: nothing is saved)", db: "", attachments: "", backups: "", exports: "" } } satisfies Boot;
      case "occurrences":
        return occurrences(a.from, a.to);
      case "search_events": {
        const q = String(a.query || "").toLowerCase();
        return events.filter((e) => (!a.category || e.categoryId === a.category) && (!a.kind || e.kind === a.kind) && (!q || JSON.stringify(e).toLowerCase().includes(q)));
      }
      case "get_event":
        return events.find((e) => e.id === a.id);
      case "save_event": {
        const e: SchedEvent = { ...a.event };
        if (!e.title.trim()) throw "Give the event a title.";
        if (span(e)[1] < span(e)[0] || parse(e.end) < parse(e.start)) throw "The event ends before it starts.";
        if (!e.id) { e.id = id(); e.createdAt = now(); }
        e.updatedAt = now();
        events = [...events.filter((x) => x.id !== e.id), e];
        return e;
      }
      case "duplicate_event": {
        const src = events.find((e) => e.id === a.id)!;
        const e = { ...src, id: id(), title: `${src.title} (copy)` };
        events.push(e);
        return e;
      }
      case "delete_event":
        events = events.filter((e) => e.id !== a.id);
        return null;
      case "move_event": {
        const e = events.find((x) => x.id === a.id)!;
        const delta = parse(a.start).getTime() - parse(e.start).getTime();
        const shift = (s: string) => (e.allDay ? dateStr(new Date(parse(s).getTime() + delta)) : dtStr(new Date(parse(s).getTime() + delta)));
        Object.assign(e, { start: shift(e.start), end: shift(e.end) });
        return e;
      }
      case "find_conflicts": {
        if (a.allDay) return [];
        const s = parse(a.start), en = parse(a.end);
        return occurrences(a.start, a.end).filter((o) => !o.event.allDay && o.event.id !== a.excludeId && parse(o.start) < en && s < parse(o.end));
      }
      case "featured": {
        const occ = occurrences(now(), dtStr(addDays(new Date(), 60))).filter((o) => o.event.allDay || parse(o.end) > new Date());
        return occ.find((o) => o.event.important) ?? occ[0] ?? null;
      }
      case "tasks":
        return [...tasks];
      case "save_task": {
        const t: Task = { ...a.task };
        if (!t.title.trim()) throw "Give the task a title.";
        if (!t.id) { t.id = id(); t.createdAt = now(); }
        tasks = [...tasks.filter((x) => x.id !== t.id), t];
        return t;
      }
      case "set_task_done": {
        const t = tasks.find((x) => x.id === a.id)!;
        Object.assign(t, { done: a.done, doneAt: a.done ? now() : null });
        return t;
      }
      case "delete_task":
        tasks = tasks.filter((t) => t.id !== a.id);
        return null;
      case "notes":
        return [...notes].sort((x, y) => Number(y.pinned) - Number(x.pinned));
      case "save_note": {
        const nn: Note = { ...a.note };
        if (!nn.id) { nn.id = id(); nn.createdAt = now(); }
        nn.updatedAt = now();
        notes = [...notes.filter((x) => x.id !== nn.id), nn];
        return nn;
      }
      case "delete_note":
        notes = notes.filter((x) => x.id !== a.id);
        return null;
      case "set_setting":
        settings = { ...settings, [a.key]: a.value };
        return settings;
      case "reminder_feed": {
        const inst = reminderInstances(new Date(), addDays(new Date(), 7)).filter((i) => !log.has(i.key));
        return [...[...log.values()].filter((i) => ["fired", "missed", "silenced", "snoozed"].includes(i.status)), ...inst];
      }
      case "snooze_reminder":
        log.set(a.item.key, { ...a.item, status: "snoozed", snoozeUntil: dtStr(addMinutes(new Date(), a.minutes)) });
        return null;
      case "dismiss_reminder":
        log.set(a.item.key, { ...a.item, status: "dismissed" });
        return null;
      case "complete_reminder":
        log.set(a.item.key, { ...a.item, status: "done" });
        return null;
      case "battery":
        return null;
      case "list_backups":
        return [];
      case "backup_now":
      case "export_json":
      case "export_ics":
      case "restore_backup":
      case "import_attachment":
      case "test_notification":
        throw "This needs the desktop app. The browser preview cannot save files or show notifications.";
      default:
        throw `Unknown command ${cmd}`;
    }
  })();
  return structuredClone(r) as T;
}

export const isPreviewSample = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("sample");

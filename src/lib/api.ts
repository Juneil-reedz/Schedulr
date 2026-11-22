import { previewInvoke } from "./preview";
import type {
  BackupFile, Battery, Boot, Note, Occurrence, ReminderItem, SchedEvent, Settings, Task,
} from "./types";

export const isDesktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** The computer's system, for wording ("Start with Windows" or "Start when you sign in"). */
export const isLinux = () => typeof navigator !== "undefined" && /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
/** The system's name for messages: Windows or Linux. */
export const systemName = () => (isLinux() ? "Linux" : "Windows");

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isDesktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  return previewInvoke<T>(cmd, args);
}

export function errorText(e: unknown) {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export const api = {
  bootstrap: () => call<Boot>("bootstrap"),
  occurrences: (from: string, to: string) => call<Occurrence[]>("occurrences", { from, to }),
  searchEvents: (query: string, category?: string | null, kind?: string | null) =>
    call<SchedEvent[]>("search_events", { query, category: category ?? null, kind: kind ?? null }),
  getEvent: (id: string) => call<SchedEvent>("get_event", { id }),
  saveEvent: (event: SchedEvent) => call<SchedEvent>("save_event", { event }),
  duplicateEvent: (id: string) => call<SchedEvent>("duplicate_event", { id }),
  deleteEvent: (id: string) => call<void>("delete_event", { id }),
  moveEvent: (id: string, start: string) => call<SchedEvent>("move_event", { id, start }),
  findConflicts: (start: string, end: string, allDay: boolean, excludeId?: string) =>
    call<Occurrence[]>("find_conflicts", { start, end, allDay, excludeId: excludeId || null }),
  featured: () => call<Occurrence | null>("featured"),
  tasks: () => call<Task[]>("tasks"),
  saveTask: (task: Task) => call<Task>("save_task", { task }),
  setTaskDone: (id: string, done: boolean) => call<Task>("set_task_done", { id, done }),
  deleteTask: (id: string) => call<void>("delete_task", { id }),
  notes: () => call<Note[]>("notes"),
  saveNote: (note: Note) => call<Note>("save_note", { note }),
  deleteNote: (id: string) => call<void>("delete_note", { id }),
  setSetting: (key: string, value: unknown) => call<Settings>("set_setting", { key, value }),
  reminderFeed: () => call<ReminderItem[]>("reminder_feed"),
  snooze: (item: ReminderItem, minutes: number) => call<void>("snooze_reminder", { item, minutes }),
  dismiss: (item: ReminderItem) => call<void>("dismiss_reminder", { item }),
  complete: (item: ReminderItem) => call<void>("complete_reminder", { item }),
  battery: () => call<Battery | null>("battery"),
  backupNow: () => call<string>("backup_now"),
  listBackups: () => call<BackupFile[]>("list_backups"),
  restoreBackup: (path: string) => call<string>("restore_backup", { path }),
  exportJson: () => call<string>("export_json"),
  exportIcs: (eventId?: string) => call<string>("export_ics", { eventId: eventId ?? null }),
  importAttachment: (src: string) => call<string>("import_attachment", { src }),
  testNotification: () => call<void>("test_notification"),
};

/** Turns a stored attachment path into something an <img> can show. */
export async function fileSrc(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  if (!isDesktop()) return null;
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(path);
}

/** In the browser preview a chosen picture is kept in memory as a data URL. */
function pickImageInBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function pickImage(): Promise<string | null> {
  if (!isDesktop()) return pickImageInBrowser();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const file = await open({ multiple: false, directory: false, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }] });
  if (!file || Array.isArray(file)) return null;
  return api.importAttachment(file);
}

export async function pickBackupFile(defaultPath?: string): Promise<string | null> {
  if (!isDesktop()) throw "Restoring needs the desktop app.";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const file = await open({ multiple: false, defaultPath, filters: [{ name: "Schedulr backup", extensions: ["db"] }] });
  return typeof file === "string" ? file : null;
}

export async function confirmAsk(message: string, title = "Schedulr"): Promise<boolean> {
  // The hosted preview runs in a frame where confirm() is blocked.
  if (!isDesktop()) return process.env.NEXT_PUBLIC_PREVIEW === "1" ? true : window.confirm(message);
  const { confirm } = await import("@tauri-apps/plugin-dialog");
  return confirm(message, { title, kind: "warning" });
}

export async function openPath(path: string) {
  if (!isDesktop()) return;
  const { openPath: op } = await import("@tauri-apps/plugin-opener");
  await op(path);
}

export async function revealPath(path: string) {
  if (!isDesktop()) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function openUrl(url: string) {
  if (!isDesktop()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const { openUrl: ou } = await import("@tauri-apps/plugin-opener");
  await ou(url);
}

export async function listen(event: string, handler: () => void): Promise<() => void> {
  if (!isDesktop()) return () => {};
  const { listen: l } = await import("@tauri-apps/api/event");
  return l(event, handler);
}

export const autostart = {
  async isEnabled() {
    if (!isDesktop()) return false;
    const m = await import("@tauri-apps/plugin-autostart");
    return m.isEnabled();
  },
  async set(on: boolean) {
    if (!isDesktop()) throw "Launch at login needs the desktop app.";
    const m = await import("@tauri-apps/plugin-autostart");
    return on ? m.enable() : m.disable();
  },
};

export async function ensureNotificationPermission() {
  if (!isDesktop()) return false;
  const n = await import("@tauri-apps/plugin-notification");
  if (await n.isPermissionGranted()) return true;
  return (await n.requestPermission()) === "granted";
}

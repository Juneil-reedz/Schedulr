"use client";
import { create } from "zustand";
import { api, errorText, isDesktop, listen } from "./api";
import type { Battery, Category, Focus, Note, Occurrence, ReminderItem, SchedEvent, Settings, Task } from "./types";

export type EventDraft = Partial<SchedEvent>;
export type TaskDraft = Partial<Task>;

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}

interface AppState {
  ready: boolean;
  bootError: string | null;
  desktop: boolean;
  version: string;
  timezone: string;
  paths: { data: string; db: string; attachments: string; backups: string; exports: string } | null;
  settings: Settings;
  categories: Category[];
  tasks: Task[];
  notes: Note[];
  feed: ReminderItem[];
  featured: Occurrence | null;
  battery: Battery | null;
  rev: number;
  toasts: Toast[];
  eventDialog: { open: boolean; draft: EventDraft | null };
  taskDialog: { open: boolean; draft: TaskDraft | null };
  notesDialog: boolean;
  /** The day picked on the dashboard calendar, "YYYY-MM-DD". */
  calDay: string;
  setCalDay: (d: string) => void;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  bump: () => void;
  setSetting: (key: string, value: unknown) => Promise<void>;
  setFocus: (patch: Partial<Focus>) => Promise<void>;
  toast: (text: string, tone?: Toast["tone"]) => void;
  fail: (e: unknown) => void;
  openEvent: (draft?: EventDraft | null) => void;
  closeEvent: () => void;
  openTask: (draft?: TaskDraft | null) => void;
  closeTask: () => void;
  setNotesDialog: (open: boolean) => void;
}

let toastId = 0;

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  bootError: null,
  desktop: false,
  version: "",
  timezone: "",
  paths: null,
  settings: {},
  categories: [],
  tasks: [],
  notes: [],
  feed: [],
  featured: null,
  battery: null,
  rev: 0,
  toasts: [],
  eventDialog: { open: false, draft: null },
  taskDialog: { open: false, draft: null },
  notesDialog: false,
  calDay: "",
  setCalDay: (calDay) => set({ calDay }),

  init: async () => {
    if (get().ready) return;
    try {
      const boot = await api.bootstrap();
      set({
        desktop: isDesktop(),
        version: boot.version,
        timezone: boot.timezone,
        paths: boot.paths,
        settings: boot.settings,
        categories: boot.categories,
      });
      await get().refresh();
      set({ ready: true });
      document.documentElement.dataset.sleep = String(!!boot.settings.focus?.sleep);
      listen("reminders-changed", () => {
        get().refreshFeed();
        get().refreshTasks();
      });
      // Battery and the featured event change slowly; check every minute.
      setInterval(async () => {
        set({ battery: await api.battery().catch(() => null), featured: await api.featured().catch(() => get().featured) });
        get().refreshFeed();
      }, 60_000);
    } catch (e) {
      set({ bootError: errorText(e) });
    }
  },

  refresh: async () => {
    const [tasks, notes, feed, featured, battery] = await Promise.all([
      api.tasks(), api.notes(), api.reminderFeed(), api.featured(), api.battery().catch(() => null),
    ]);
    set((s) => ({ tasks, notes, feed, featured, battery, rev: s.rev + 1 }));
  },
  refreshTasks: async () => set({ tasks: await api.tasks() }),
  refreshNotes: async () => set({ notes: await api.notes() }),
  refreshFeed: async () => set({ feed: await api.reminderFeed() }),
  bump: () => {
    set((s) => ({ rev: s.rev + 1 }));
    api.featured().then((featured) => set({ featured })).catch(() => {});
    get().refreshFeed().catch(() => {});
  },

  setSetting: async (key, value) => {
    const settings = await api.setSetting(key, value);
    set({ settings });
  },
  setFocus: async (patch) => {
    const cur: Focus = { dnd: false, work: false, personal: false, sleep: false, ...get().settings.focus };
    const next = { ...cur, ...patch };
    // Work and Personal are two sides of one switch.
    if (patch.work) next.personal = false;
    if (patch.personal) next.work = false;
    await get().setSetting("focus", next);
    document.documentElement.dataset.sleep = String(next.sleep);
    get().bump();
  },

  toast: (text, tone = "ok") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === "error" ? 6000 : 3200);
  },
  fail: (e) => get().toast(errorText(e), "error"),

  openEvent: (draft = null) => set({ eventDialog: { open: true, draft } }),
  closeEvent: () => set((s) => ({ eventDialog: { ...s.eventDialog, open: false } })),
  openTask: (draft = null) => set({ taskDialog: { open: true, draft } }),
  closeTask: () => set((s) => ({ taskDialog: { ...s.taskDialog, open: false } })),
  setNotesDialog: (open) => set({ notesDialog: open }),
}));

/** Focus modes decide which categories are shown at all. */
export function useVisible() {
  const focus = useApp((s) => s.settings.focus);
  const categories = useApp((s) => s.categories);
  return (categoryId: string | null | undefined) => {
    if (!focus?.work && !focus?.personal) return true;
    const scope = categories.find((c) => c.id === categoryId)?.scope;
    if (!scope) return true;
    return focus.work ? scope === "work" : scope === "personal";
  };
}

export function useCategory() {
  const categories = useApp((s) => s.categories);
  return (id: string | null | undefined) => categories.find((c) => c.id === id);
}

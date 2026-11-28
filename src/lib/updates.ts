"use client";
/* Checking for, announcing and installing new versions of Schedulr.
   The desktop app reads latest.json from the newest GitHub release (see tauri.conf.json).
   The browser preview has no updates, except with ?update in the address, which fakes one
   so the screens can be tried. */
import { create } from "zustand";
import { errorText, isDesktop, listen } from "./api";
import { useApp } from "./store";
import { useIntro } from "./intro";

export type UpdateStatus = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "offline" | "error";

export interface UpdateInfo {
  version: string;
  notes: string;
  date?: string;
}

interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  /** 0 to 1 while downloading, null when the size is unknown. */
  progress: number | null;
  error: string | null;
  checkedAt: number | null;
  dialog: boolean;
  setDialog: (open: boolean) => void;
  check: (opts?: { quiet?: boolean }) => Promise<void>;
  install: () => Promise<void>;
}

type Pending = { downloadAndInstall: (cb: (e: DownloadEvent) => void) => Promise<void> };
type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

let pending: Pending | null = null;
/** When the update window last popped up by itself, per version. */
const popped = new Map<string, number>();
const POP_AGAIN = 30 * 60 * 1000;

/** Opens the update window when nothing else is open (a dialog the person is using wins). */
function popUp(open: () => void, tries = 0) {
  if (typeof document === "undefined") return;
  if ((!document.querySelector("[role=dialog]") && useIntro.getState().done) || tries > 24) open();
  else setTimeout(() => popUp(open, tries + 1), 5_000);
}

const fakeUpdate = () => typeof location !== "undefined" && new URLSearchParams(location.search).has("update");

async function findUpdate(): Promise<UpdateInfo | null> {
  if (!isDesktop()) {
    if (!fakeUpdate()) return null;
    await new Promise((r) => setTimeout(r, 700));
    pending = {
      downloadAndInstall: async (cb) => {
        cb({ event: "Started", data: { contentLength: 100 } });
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 180));
          cb({ event: "Progress", data: { chunkLength: 10 } });
        }
        cb({ event: "Finished" });
      },
    };
    return { version: "1.2.0", notes: "- A sample update, so you can see how updating looks.\n- Nothing is installed in the browser preview." };
  }
  const { check } = await import("@tauri-apps/plugin-updater");
  const u = await check({ timeout: 20_000 });
  if (!u) return null;
  pending = u;
  return { version: u.version, notes: u.body ?? "", date: u.date };
}

/** A system notification, once per new version. */
async function announce(info: UpdateInfo) {
  const app = useApp.getState();
  if (app.settings.updateNotified === info.version) return;
  await app.setSetting("updateNotified", info.version).catch(() => {});
  if (!isDesktop()) return;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    if (!(await n.isPermissionGranted())) return;
    n.sendNotification({ title: `Schedulr ${info.version} is ready`, body: "Open Schedulr and choose Update to install it. Your data stays as it is." });
  } catch {
    /* the in-app notice is enough */
  }
}

export const useUpdates = create<UpdateState>((set, get) => ({
  status: "idle",
  info: null,
  progress: null,
  error: null,
  checkedAt: null,
  dialog: false,
  setDialog: (dialog) => set({ dialog }),

  check: async ({ quiet = false } = {}) => {
    const busy = ["checking", "downloading", "installing"];
    if (busy.includes(get().status)) return;
    // The Microsoft Store delivers updates to the Store version.
    if (useApp.getState().fromStore) return;
    const toast = useApp.getState().toast;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ status: "offline", error: null });
      if (!quiet) toast("You are offline. Connect to the internet to check for updates.", "error");
      return;
    }
    set({ status: "checking", error: null });
    try {
      const info = await findUpdate();
      set({ status: info ? "available" : "current", info, checkedAt: Date.now() });
      if (info) {
        await announce(info);
        // A check the person asked for opens the window at once; an automatic one pops it
        // up once per launch for each new version, as soon as no other window is open.
        if (!quiet) set({ dialog: true });
        else if (Date.now() - (popped.get(info.version) ?? 0) > POP_AGAIN) {
          popped.set(info.version, Date.now());
          popUp(() => set({ dialog: true }));
        }
      } else if (!quiet) {
        toast(isDesktop() ? "You have the newest version." : "Updates work in the desktop app.");
      }
    } catch (e) {
      set({ status: "error", error: errorText(e), checkedAt: Date.now() });
      if (!quiet) toast("Could not check for updates. Try again in a moment.", "error");
    }
  },

  install: async () => {
    if (!pending) return;
    let total = 0;
    let got = 0;
    set({ status: "downloading", progress: 0, error: null });
    try {
      await pending.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        else if (e.event === "Progress") {
          got += e.data.chunkLength;
          set({ progress: total ? Math.min(1, got / total) : null });
        } else set({ status: "installing", progress: 1 });
      });
      if (!isDesktop()) {
        set({ status: "current", info: null, dialog: false });
        useApp.getState().toast("Sample update finished. The desktop app restarts here.");
        return;
      }
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      set({ status: "available", error: errorText(e) });
    }
  },
}));

const HOUR = 60 * 60 * 1000;
const RECHECK = 15 * 60 * 1000;
let started = false;

/* Schedulr keeps running in the tray when its window is closed, so opening the window is
   usually not a fresh start. Updates are checked shortly after start, every hour, when
   the internet comes back, and whenever the window is opened or brought to the front
   (if the last check is more than 15 minutes old). An update that is already waiting
   pops up again when the window is opened, at most every 30 minutes. */
export function startUpdateChecks() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isDesktop() && !fakeUpdate()) return;
  const quiet = () => useUpdates.getState().check({ quiet: true });
  const opened = () => {
    if (document.visibilityState !== "visible") return;
    const { checkedAt, status, info, dialog } = useUpdates.getState();
    if (status === "available" && info) {
      if (!dialog && Date.now() - (popped.get(info.version) ?? 0) > POP_AGAIN) {
        popped.set(info.version, Date.now());
        popUp(() => useUpdates.getState().setDialog(true));
      }
    } else if (!checkedAt || Date.now() - checkedAt > RECHECK) quiet();
  };
  setTimeout(quiet, 4_000);
  setInterval(quiet, HOUR);
  window.addEventListener("online", opened);
  window.addEventListener("focus", opened);
  document.addEventListener("visibilitychange", opened);
  // The desktop app also says when its window is shown from the tray.
  listen("window-shown", opened);
}

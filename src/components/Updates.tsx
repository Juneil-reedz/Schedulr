"use client";
import { useEffect } from "react";
import { CircleCheck, Download, RefreshCw, Sparkles, WifiOff } from "@/components/icons";
import { Button, Modal, cn } from "./ui";
import { useApp } from "@/lib/store";
import { startUpdateChecks, useUpdates } from "@/lib/updates";

function Notes({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-base text-ink">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

function Progress({ value }: { value: number | null }) {
  return (
    <div
      role="progressbar"
      aria-label="Downloading the update"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value == null ? undefined : Math.round(value * 100)}
      className="clay-sunk h-3 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn("h-full rounded-full bg-terracotta transition-[width] duration-300", value == null && "w-1/3 animate-pulse")}
        style={value == null ? undefined : { width: `${Math.max(4, value * 100)}%` }}
      />
    </div>
  );
}

/** The update window: what's new, then download, install and restart. */
export function UpdateDialog() {
  const { dialog, setDialog, info, status, progress, error, install } = useUpdates();
  const version = useApp((s) => s.version);
  const busy = status === "downloading" || status === "installing";
  return (
    <Modal
      open={dialog && !!info}
      onOpenChange={(v) => !busy && setDialog(v)}
      title={info ? `Schedulr ${info.version} is ready` : "Update"}
      description={version && version !== "preview" ? `You have version ${version}.` : undefined}
      footer={
        <>
          <Button tone="primary" onClick={install} disabled={busy}>
            <Download size={18} /> {busy ? (status === "installing" ? "Installing…" : "Downloading…") : "Update now"}
          </Button>
          <Button tone="ghost" onClick={() => setDialog(false)} disabled={busy}>
            Later
          </Button>
        </>
      }
    >
      {info && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-md font-semibold text-forest">What is new</p>
            <Notes text={info.notes} />
          </div>
          {busy ? (
            <div className="flex flex-col gap-2">
              <Progress value={progress} />
              <p className="text-sm text-muted" aria-live="polite">
                {status === "installing" ? "Installing. Schedulr closes and opens again by itself." : progress != null ? `${Math.round(progress * 100)}% downloaded` : "Downloading…"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">Schedulr downloads the update, closes for a moment and opens again. Your events, tasks and notes stay as they are.</p>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              The update did not finish: {error}. Check your internet connection and try again.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** A notice in the top bar while a new version is waiting. Also starts the background checks. */
export function UpdateBadge() {
  const status = useUpdates((s) => s.status);
  const info = useUpdates((s) => s.info);
  const setDialog = useUpdates((s) => s.setDialog);
  useEffect(() => startUpdateChecks(), []);
  if (!info || !["available", "downloading", "installing"].includes(status)) return null;
  return (
    <button
      type="button"
      onClick={() => setDialog(true)}
      className="btn-solid press flex h-10 items-center gap-2 rounded-full bg-terracotta px-4 text-sm font-semibold text-on-dark shadow-raise"
    >
      <Sparkles size={17} aria-hidden />
      <span className="hidden sm:inline">Update to {info.version}</span>
      <span className="sm:hidden">Update</span>
    </button>
  );
}

/** Settings > Updates. */
export function UpdatesPanel() {
  const { status, info, checkedAt, error, check, setDialog } = useUpdates();
  const version = useApp((s) => s.version);
  const desktop = useApp((s) => s.desktop);
  const checking = status === "checking";
  const line = (() => {
    switch (status) {
      case "checking":
        return { icon: RefreshCw, text: "Checking for a new version…" };
      case "current":
        return { icon: CircleCheck, text: desktop ? "You have the newest version." : "Updates work in the desktop app." };
      case "available":
      case "downloading":
      case "installing":
        return { icon: Sparkles, text: `Version ${info?.version} is ready to install.` };
      case "offline":
        return { icon: WifiOff, text: "You are offline. Schedulr checks again when the internet is back." };
      case "error":
        return { icon: WifiOff, text: "Could not reach the update server. Schedulr tries again later." };
      default:
        return { icon: RefreshCw, text: "Schedulr checks by itself when you are online, and tells you when a new version is ready." };
    }
  })();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-ink">
        Version <span className="num font-semibold">{version || "unknown"}</span>
      </p>
      <p className="flex items-start gap-2 text-sm text-muted" aria-live="polite">
        <line.icon size={17} className={cn("mt-0.5 shrink-0", checking && "animate-spin")} aria-hidden />
        <span>
          {line.text}
          {checkedAt && status !== "checking" && ` Last checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`}
        </span>
      </p>
      {error && status === "error" && <p className="text-xs text-muted">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {info && status !== "current" ? (
          <Button tone="primary" size="sm" onClick={() => setDialog(true)}>
            <Download size={16} /> Update to {info.version}
          </Button>
        ) : null}
        <Button size="sm" onClick={() => check()} disabled={checking}>
          <RefreshCw size={16} className={cn(checking && "animate-spin")} /> Check for updates
        </Button>
      </div>
    </div>
  );
}

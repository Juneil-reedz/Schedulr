"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlarmClock, Bell, BellOff, CalendarClock, Check, ChevronLeft, ChevronRight, ListChecks, TriangleAlert } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { Button, Help, cn } from "../ui";
import { api } from "@/lib/api";
import { countdown, fmtTime, parse, relDay } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import { useApp, useCategory, useVisible } from "@/lib/store";
import type { ReminderItem } from "@/lib/types";

const NEEDS_YOU = ["fired", "missed", "silenced", "snoozed"];

export function useReminderList() {
  const feed = useApp((s) => s.feed);
  const visible = useVisible();
  return useMemo(() => {
    const shown = feed.filter((i) => visible(i.categoryId));
    const attention = shown.filter((i) => NEEDS_YOU.includes(i.status)).sort((a, b) => b.fireAt.localeCompare(a.fireAt));
    const upcoming = shown.filter((i) => i.status === "upcoming").sort((a, b) => a.fireAt.localeCompare(b.fireAt));
    return { attention, upcoming, all: [...attention, ...upcoming] };
  }, [feed, visible]);
}

export function statusLine(it: ReminderItem, now: Date, h24: boolean) {
  const fire = parse(it.fireAt);
  switch (it.status) {
    case "missed":
      return `Missed, ${relDay(fire, now).toLowerCase() === "today" ? "today" : relDay(fire, now)} at ${fmtTime(fire, h24)}`;
    case "silenced":
      return `Silenced by Focus at ${fmtTime(fire, h24)}`;
    case "snoozed":
      return it.snoozeUntil ? `Snoozed until ${fmtTime(parse(it.snoozeUntil), h24)}` : "Snoozed";
    case "fired":
      return `Reminded you at ${fmtTime(fire, h24)}`;
    default:
      return `${relDay(fire, now)} at ${fmtTime(fire, h24)}`;
  }
}

export function useReminderActions() {
  const refreshFeed = useApp((s) => s.refreshFeed);
  const refreshTasks = useApp((s) => s.refreshTasks);
  const snoozeMinutes = useApp((s) => s.settings.snoozeMinutes ?? 10);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      await Promise.all([refreshFeed(), refreshTasks()]);
      toast(msg);
    } catch (e) {
      fail(e);
    }
  };
  return {
    snoozeMinutes,
    snooze: (it: ReminderItem, m = snoozeMinutes) => run(() => api.snooze(it, m), `Snoozed for ${m} minutes`),
    dismiss: (it: ReminderItem) => run(() => api.dismiss(it), it.status === "upcoming" ? "Reminder skipped" : "Reminder dismissed"),
    complete: (it: ReminderItem) => run(() => api.complete(it), it.sourceKind === "event" ? "Marked as done" : "Task completed"),
  };
}

export function ReminderIcon({ it, className }: { it: ReminderItem; className?: string }) {
  const Icon = it.status === "missed" ? TriangleAlert : it.status === "silenced" ? BellOff : it.status === "snoozed" ? AlarmClock : it.sourceKind === "event" ? CalendarClock : it.sourceKind === "overdue" ? TriangleAlert : ListChecks;
  return <Icon className={className} aria-hidden />;
}

/** The compact, player-like reminder card. */
export function ReminderPlayer({ className }: { className?: string }) {
  const { all, attention } = useReminderList();
  const [i, setI] = useState(0);
  const now = useNow(15_000);
  const h24 = useApp((s) => s.settings.clock24h ?? false);
  const cat = useCategory();
  const act = useReminderActions();
  const reduce = useReducedMotion();
  useEffect(() => setI((x) => Math.min(x, Math.max(0, all.length - 1))), [all.length]);
  const it = all[i];

  let progress = 0;
  let left = "";
  if (it) {
    const fire = parse(it.snoozeUntil && it.status === "snoozed" ? it.snoozeUntil : it.fireAt);
    const windowMs = 24 * 3600 * 1000;
    progress = it.status === "upcoming" || it.status === "snoozed" ? Math.min(1, Math.max(0, 1 - (fire.getTime() - now.getTime()) / windowMs)) : 1;
    left = it.status === "upcoming" || it.status === "snoozed" ? countdown(fire, now) : countdown(parse(it.fireAt), now);
  }
  const color = cat(it?.categoryId)?.color ?? "var(--terracotta)";

  return (
    <section aria-labelledby="rem-h" className={cn("clay shape-c clay-lift flex flex-col px-5 pb-4 pt-4", className)}>
      <div className="flex items-center justify-between">
        <h2 id="rem-h" className="flex items-center gap-2 text-md font-semibold text-forest">
          <Bell size={17} aria-hidden /> Reminders
        </h2>
        <div className="flex items-center gap-2">
          {attention.length > 0 && <span className="rounded-full bg-terracotta px-2.5 py-0.5 text-xs font-semibold text-on-dark">{attention.length} need you</span>}
          <Help title="Reminders">
            <p>Reminders that need you come first: ones that went off, ones you missed while Schedulr was closed, and snoozed ones. Then everything due in the next 7 days.</p>
            <p>Use the arrows to move between them, the round button to mark one done, or snooze and skip.</p>
          </Help>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {it ? (
          <motion.div
            key={it.key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 flex flex-1 flex-col"
          >
            <div className="flex items-center gap-3.5">
              <div className="clay shape-tile grid h-14 w-14 shrink-0 place-items-center" style={{ ["--clay-fill" as string]: color }}>
                <ReminderIcon it={it} className="h-6 w-6 text-on-dark" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-md font-semibold text-ink">{it.title}</p>
                <p className="truncate text-sm text-muted">{statusLine(it, now, h24)}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-[6px] overflow-hidden rounded-full bg-sand/70 shadow-sunk" role="progressbar" aria-label="Time until the reminder" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="h-full origin-left rounded-full bg-terracotta" style={{ transform: `scaleX(${progress})`, transition: "transform 600ms var(--ease-out)" }} />
              </div>
              <div className="num mt-1.5 flex justify-between text-xs text-muted">
                <span>{left}</span>
                <span>{fmtTime(parse(it.status === "snoozed" && it.snoozeUntil ? it.snoozeUntil : it.fireAt), h24)}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-5">
              <Button tone="ghost" size="icon" aria-label="Previous reminder" disabled={i === 0} onClick={() => setI(i - 1)} className="text-terracotta">
                <ChevronLeft size={26} />
              </Button>
              <Button
                tone="primary"
                aria-label={it.sourceKind === "event" ? "Mark as done" : "Complete task"}
                onClick={() => act.complete(it)}
                className="h-14 w-14 rounded-full p-0"
              >
                <Check size={26} strokeWidth={2.6} />
              </Button>
              <Button tone="ghost" size="icon" aria-label="Next reminder" disabled={i >= all.length - 1} onClick={() => setI(i + 1)} className="text-terracotta">
                <ChevronRight size={26} />
              </Button>
            </div>
            <div className="mt-1 flex justify-center gap-1">
              <Button tone="ghost" size="sm" onClick={() => act.snooze(it)}>
                Snooze {act.snoozeMinutes} min
              </Button>
              <Button tone="ghost" size="sm" onClick={() => act.dismiss(it)}>
                {it.status === "upcoming" ? "Skip" : "Dismiss"}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex flex-1 flex-col justify-center">
            <p className="text-md font-semibold text-ink">No reminders this week</p>
            <p className="text-sm text-muted">Add a reminder to an event or a due time to a task.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

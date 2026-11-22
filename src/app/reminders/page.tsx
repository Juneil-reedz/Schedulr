"use client";
import { BellRing, Moon } from "@/components/icons";
import Link from "next/link";
import { PageHeader } from "@/components/Shell";
import { Button, SectionTitle, cn } from "@/components/ui";
import { ReminderIcon, statusLine, useReminderActions, useReminderList } from "@/components/widgets/reminder";
import { api } from "@/lib/api";
import { parse, relDay } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import { useApp, useCategory } from "@/lib/store";
import type { ReminderItem } from "@/lib/types";

function Row({ it }: { it: ReminderItem }) {
  const now = useNow(30_000);
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const act = useReminderActions();
  const cat = useCategory();
  const openEvent = useApp((s) => s.openEvent);
  const tasks = useApp((s) => s.tasks);
  const openTask = useApp((s) => s.openTask);
  const open = async () => {
    if (it.sourceKind === "event") openEvent(await api.getEvent(it.sourceId));
    else openTask(tasks.find((t) => t.id === it.sourceId) ?? null);
  };
  return (
    <li className="flex flex-wrap items-center gap-4 py-3.5">
      <div className="clay shape-tile grid h-12 w-12 shrink-0 place-items-center" style={{ ["--clay-fill" as string]: cat(it.categoryId)?.color ?? "var(--terracotta)" }}>
        <ReminderIcon it={it} className="h-5 w-5 text-on-dark" />
      </div>
      <button type="button" onClick={open} className="min-w-[200px] flex-1 text-left">
        <p className="text-md font-semibold text-ink">{it.title}</p>
        <p className={cn("text-sm", it.status === "missed" ? "font-semibold text-terracotta" : "text-muted")}>
          {statusLine(it, now, h24)}
          {it.body && `. ${it.body}`}
        </p>
      </button>
      <div className="flex flex-wrap gap-1">
        <Button tone="ghost" size="sm" onClick={() => act.snooze(it)}>
          Snooze {act.snoozeMinutes} min
        </Button>
        <Button tone="ghost" size="sm" onClick={() => act.dismiss(it)}>
          {it.status === "upcoming" ? "Skip" : "Dismiss"}
        </Button>
        <Button tone="clay" size="sm" onClick={() => act.complete(it)}>
          {it.sourceKind === "event" ? "Done" : "Complete task"}
        </Button>
      </div>
    </li>
  );
}

export default function RemindersPage() {
  const { attention, upcoming } = useReminderList();
  const focus = useApp((s) => s.settings.focus);
  const desktop = useApp((s) => s.desktop);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const quiet = focus?.dnd || focus?.sleep;
  const groups = new Map<string, ReminderItem[]>();
  for (const it of upcoming) {
    const k = relDay(parse(it.fireAt));
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return (
    <>
      <PageHeader title="Reminders" help={<><p>Reminders that went off or that you missed while Schedulr was closed, then everything coming up in the next 7 days.</p><p>Snooze, skip or mark each one done. Reminders on a task can complete the task too.</p></>}>
        <Button tone="clay" onClick={() => api.testNotification().then(() => toast("Test notification sent"), fail)}>
          <BellRing size={17} /> Send a test notification
        </Button>
      </PageHeader>
      {quiet && (
        <p className="clay shape-c mb-5 flex items-center gap-3 px-6 py-4 text-base text-ink" style={{ ["--clay-fill" as string]: "var(--sage-soft)" }}>
          <Moon size={18} aria-hidden /> {focus?.sleep ? "Sleep" : "Do not disturb"} is on, so reminders are collected here without a notification.{" "}
          <Link href="/" className="font-semibold underline underline-offset-4">
            Change it on the dashboard
          </Link>
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="clay shape-a px-6 py-5">
          <SectionTitle>Needs you</SectionTitle>
          {attention.length === 0 ? (
            <p className="mt-2 text-muted">You are all caught up.</p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {attention.map((it) => (
                <Row key={it.key} it={it} />
              ))}
            </ul>
          )}
        </section>
        <section className="clay shape-b px-6 py-5">
          <SectionTitle>Coming up this week</SectionTitle>
          {groups.size === 0 && <p className="mt-2 text-muted">No reminders in the next seven days.</p>}
          {[...groups.entries()].map(([day, items]) => (
            <div key={day} className="mt-3">
              <h3 className="text-base font-semibold text-terracotta">{day}</h3>
              <ul className="divide-y divide-line">
                {items.map((it) => (
                  <Row key={it.key} it={it} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
      <p className="mt-6 max-w-[70ch] text-sm text-muted">
        {desktop
          ? "Reminders keep working while Schedulr runs in the system tray, even with this window closed. They cannot arrive while the laptop is shut down or asleep. Anything that came due then is listed above as missed."
          : "In the browser preview reminders are listed but no notifications are sent."}
      </p>
    </>
  );
}

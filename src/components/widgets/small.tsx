"use client";
import { format, isSameDay, isWithinInterval, addDays } from "date-fns";
import { BatteryCharging, CalendarPlus, NotebookPen, ListTodo, Zap, Users } from "@/components/icons";
import Link from "next/link";
import { Cactus, Cloud, CornerBloom, LeafPair, Moon, Sprig, Sun } from "../botanicals";
import { Help, Toggle, cn } from "../ui";
import { fmtTime, parse } from "@/lib/dates";
import { useNow, useWeather, weatherKind, weatherText } from "@/lib/hooks";
import { useApp, useVisible } from "@/lib/store";
import type { Focus } from "@/lib/types";

export function ClockTile({ className }: { className?: string }) {
  const now = useNow(1000);
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const offset = useApp((s) => s.timezone);
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const time = fmtTime(now, h24);
  const [hm, ampm] = time.split(" ");
  const date = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
  return (
    <section aria-label="Clock" className={cn("clay shape-b clay-lift relative overflow-hidden px-7 pb-6 pt-5", className)}>
      <Help title="Clock" className="absolute right-4 top-4 z-[2]">
        <p>The time, day and date from your computer’s clock, with your time zone. It stays in step with Windows.</p>
        <p>Switch between 24-hour and 12-hour time in Settings.</p>
      </Help>
      <p className="display num text-[clamp(60px,6.2vw,92px)] leading-[0.95] text-terracotta">
        <time dateTime={now.toISOString()}>{hm}</time>
        {ampm && <span className="ml-2 text-[0.32em] text-terracotta-soft">{ampm}</span>}
      </p>
      <p className="mt-3 text-xl font-semibold text-forest">{format(now, "EEEE")}</p>
      <p className="num text-lg text-forest">{date}</p>
      <p className="mt-2 text-xs text-muted">
        {zone.replace(/_/g, " ")}
        {offset && `, UTC${offset}`}
      </p>
      <Sprig className="sway pointer-events-none absolute -bottom-2 right-2 h-[78%] w-auto opacity-95" />
    </section>
  );
}

export function WeatherTile({ className }: { className?: string }) {
  const w = useWeather();
  const reading = w.kind === "live" || w.kind === "stale" ? w.reading : null;
  const kind = reading ? weatherKind(reading.code) : "sun";
  const Icon = !reading ? Sun : kind === "sun" ? (reading.isDay ? Sun : Moon) : Cloud;
  return (
    <section aria-label="Weather" className={cn("clay shape-c clay-lift relative flex items-center gap-4 overflow-hidden px-6 py-4", className)}>
      <Help title="Weather" className="absolute right-4 top-3.5 z-[2]">
        <p>Local weather from the free Open-Meteo service. It stays off until you choose a place in Settings, and only that place is sent.</p>
        <p>When you are offline it shows the last reading and the time it was taken.</p>
      </Help>
      <Icon className={cn("h-16 w-16 shrink-0", Icon === Sun && "spin-slow", !reading && "opacity-60 grayscale-[.4]")} {...(Icon === Cloud ? { rain: kind === "rain", storm: kind === "storm" } : {})} />
      <div className="min-w-0 flex-1">
        {reading ? (
          <>
            <p className="display num text-5xl leading-none text-forest">
              {reading.temp}°<span className="ml-0.5 text-[0.5em] text-muted">{reading.unit === "fahrenheit" ? "F" : "C"}</span>
            </p>
            <p className="mt-1 text-md font-semibold text-forest">{weatherText(reading.code)}</p>
            <p className="truncate text-xs text-muted">
              {w.kind === "stale" ? `${reading.place}, as of ${format(parse(reading.at), "HH:mm")}` : reading.place}
            </p>
          </>
        ) : w.kind === "loading" ? (
          <p className="text-base text-muted">Checking the sky…</p>
        ) : w.kind === "unavailable" ? (
          <>
            <p className="text-md font-semibold text-forest">Weather unavailable</p>
            <p className="text-xs text-muted">No connection and no earlier reading.</p>
          </>
        ) : (
          <>
            <p className="text-md font-semibold text-forest">Weather is off</p>
            <Link href="/settings/#weather" className="text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-4 hover:decoration-terracotta">
              Choose a place in Settings
            </Link>
          </>
        )}
      </div>
      <LeafPair className="sway pointer-events-none absolute -bottom-3 -right-3 h-14 w-auto opacity-80" />
    </section>
  );
}

const FOCUS_ROWS: { key: keyof Focus; label: string; hint: string; color: "terracotta" | "sage" }[] = [
  { key: "dnd", label: "Do not disturb", hint: "Silences notifications", color: "terracotta" },
  { key: "work", label: "Work", hint: "Shows only work", color: "sage" },
  { key: "personal", label: "Personal", hint: "Shows only personal", color: "sage" },
  { key: "sleep", label: "Sleep", hint: "Silences all, dims the screen", color: "sage" },
];

export function FocusTile({ className }: { className?: string }) {
  const focus = useApp((s) => s.settings.focus);
  const setFocus = useApp((s) => s.setFocus);
  const fail = useApp((s) => s.fail);
  return (
    <section aria-labelledby="focus-h" className={cn("clay shape-a clay-lift relative flex flex-col overflow-hidden px-6 pb-16 pt-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="focus-h" className="flex items-center gap-2 text-xl font-semibold text-forest">
          <CornerBloom className="h-6 w-6" /> Focus
        </h2>
        <Help title="Focus">
          <p>Switches that change how Schedulr behaves.</p>
          <p><b className="text-ink">Do not disturb</b> silences notifications. Reminders are still collected on the Reminders page.</p>
          <p><b className="text-ink">Work</b> shows only work categories and only notifies you about work. <b className="text-ink">Personal</b> does the opposite.</p>
          <p><b className="text-ink">Sleep</b> silences everything and dims the screen.</p>
        </Help>
      </div>
      <ul className="mt-2">
        {FOCUS_ROWS.map((r, i) => (
          <li key={r.key} className={cn("flex items-center justify-between gap-3 py-3", i > 0 && "border-t border-line")}>
            <label htmlFor={`focus-${r.key}`} className="min-w-0 cursor-pointer">
              <span className="block text-md text-ink">{r.label}</span>
              <span className="block text-xs text-muted">{r.hint}</span>
            </label>
            <Toggle
              id={`focus-${r.key}`}
              label={r.label}
              color={r.color}
              checked={!!focus?.[r.key]}
              onChange={(v) => setFocus({ [r.key]: v }).catch(fail)}
            />
          </li>
        ))}
      </ul>
      <LeafPair className="sway pointer-events-none absolute bottom-1 left-1/2 h-14 w-auto -translate-x-1/2" />
    </section>
  );
}

/** Real battery when the laptop reports one, otherwise today's tasks. */
export function StatsTile({ className }: { className?: string }) {
  const battery = useApp((s) => s.battery);
  const tasks = useApp((s) => s.tasks);
  const visible = useVisible();
  const today = new Date();
  const mine = tasks.filter((t) => visible(t.categoryId));
  const doneOnDay = (t: (typeof mine)[number]) => !!t.doneAt && isSameDay(parse(t.doneAt), today);
  const todays = mine.filter((t) => (t.due && isSameDay(parse(t.due), today)) || doneOnDay(t));
  const doneToday = todays.filter(doneOnDay).length;
  const deadlines = mine.filter((t) => !t.done && t.due && isWithinInterval(parse(t.due), { start: today, end: addDays(today, 7) })).length;
  return (
    <section aria-label={battery ? "Battery" : "Tasks today"} className={cn("clay shape-pill clay-lift relative flex flex-col items-center px-4 pb-6 pt-4 text-center max-[479px]:grid max-[479px]:grid-cols-[auto_1fr] max-[479px]:items-center max-[479px]:gap-x-4 max-[479px]:px-7 max-[479px]:py-4 max-[479px]:text-left", className)}>
      <Help title={battery ? "Battery" : "Tasks today"} className="absolute right-3 top-3 z-[2]">
        <p>Shows your laptop’s battery when Windows reports one. Schedulr never guesses it.</p>
        <p>Without a battery it shows how many of today’s tasks are done, and how many deadlines fall in the next 7 days.</p>
      </Help>
      <Cactus className="sway h-20 w-20 max-[479px]:row-span-4" />
      {battery ? (
        <>
          <p className="display num mt-2 text-5xl leading-none text-terracotta">
            {battery.percent}
            <span className="align-top text-[0.45em]">%</span>
          </p>
          <p className="mt-1 text-base font-semibold text-forest">Battery</p>
          {battery.charging ? <BatteryCharging className="mt-2 text-marigold" aria-label="Charging" /> : <Zap className="mt-2 text-sand" aria-hidden />}
          <p className="mt-3 text-xs text-muted">{doneToday} done today</p>
        </>
      ) : (
        <>
          <p className="display num mt-2 text-5xl leading-none text-terracotta">
            {doneToday}
            <span className="text-[0.5em] text-muted">/{todays.length}</span>
          </p>
          <p className="mt-1 text-base font-semibold text-forest">Done today</p>
          <p className="mt-3 text-xs leading-snug text-muted">
            {deadlines === 0 ? "No deadlines this week" : deadlines === 1 ? "1 deadline this week" : `${deadlines} deadlines this week`}
          </p>
        </>
      )}
    </section>
  );
}

export function QuickTiles({ className }: { className?: string }) {
  const openEvent = useApp((s) => s.openEvent);
  const openTask = useApp((s) => s.openTask);
  const setNotes = useApp((s) => s.setNotesDialog);
  const tiles = [
    { label: "New event", icon: CalendarPlus, fill: "var(--marigold)", ink: "var(--on-marigold)", on: () => openEvent({ kind: "event" }) },
    { label: "New meeting", icon: Users, fill: "var(--sage)", ink: "var(--cream)", on: () => openEvent({ kind: "meeting" }) },
    { label: "New task", icon: ListTodo, fill: "var(--terracotta)", ink: "var(--cream)", on: () => openTask() },
    { label: "Quick note", icon: NotebookPen, fill: "var(--cream)", ink: "var(--terracotta)", on: () => setNotes(true) },
  ];
  return (
    <nav aria-label="Create" className={cn("grid grid-cols-4 gap-3", className)}>
      {tiles.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={t.on}
          className="clay shape-tile clay-lift press group flex aspect-square flex-col items-center justify-center gap-1.5 p-2"
          style={{ ["--clay-fill" as string]: t.fill }}
        >
          <t.icon size={26} strokeWidth={2.2} style={{ color: t.ink }} aria-hidden />
          <span className="text-center text-2xs font-semibold leading-tight" style={{ color: t.ink }}>
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

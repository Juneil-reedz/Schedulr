"use client";
/* Decides what Pip announces, from the planner's real data:
   - a greeting when Schedulr opens (once a day; a shorter "welcome back" later),
   - a summary of today: busy, a few things, or nothing at all, plus tasks due or overdue,
   - reminders that went off while away,
   - a heads-up 15 minutes before an event and when it starts,
   - each reminder as it fires,
   - a cheer when a task is ticked off,
   - and now and then a short remark about the day. */
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { dateStr, fmtTime, isDateOnly, parse } from "@/lib/dates";
import { useApp, useVisible } from "@/lib/store";
import { useIntro } from "@/lib/intro";
import type { Occurrence, Task } from "@/lib/types";
import { things } from "./lines";
import { pipSettings, usePip } from "./pip";

const MIN = 60_000;

function todayParts(occ: Occurrence[], tasks: Task[], now: Date) {
  const today = dateStr(now);
  const remaining = occ
    .filter((o) => (isDateOnly(o.start) ? o.start <= today && o.end >= today : parse(o.end) > now && o.start.slice(0, 10) === today))
    .sort((a, b) => a.start.localeCompare(b.start));
  const timed = remaining.filter((o) => !isDateOnly(o.start));
  const open = tasks.filter((t) => !t.done && t.due);
  const dueToday = open.filter((t) => t.due!.slice(0, 10) === today);
  const overdue = open.filter((t) => t.due!.slice(0, 10) < today);
  return { remaining, timed, dueToday, overdue };
}

export function useCompanionEngine(active: boolean) {
  const ready = useApp((s) => s.ready);
  const tasks = useApp((s) => s.tasks);
  const feed = useApp((s) => s.feed);
  const rev = useApp((s) => s.rev);
  const sleep = useApp((s) => !!s.settings.focus?.sleep);
  const introDone = useIntro((s) => s.done);
  const visible = useVisible();
  const say = usePip((s) => s.say);
  const setBase = usePip((s) => s.setBase);

  const occRef = useRef<Occurrence[]>([]);
  const announced = useRef(new Set<string>());
  const doneRef = useRef<Map<string, boolean> | null>(null);
  const greeted = useRef(false);
  const hiddenAt = useRef<number | null>(null);
  const lastQuip = useRef(Date.now());
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const h24 = () => !!useApp.getState().settings.clock24h;
  const label = (o: Occurrence) => (isDateOnly(o.start) ? "all day" : fmtTime(parse(o.start), h24()));

  /** Today's and tomorrow's occurrences, kept fresh as the data changes. */
  useEffect(() => {
    if (!ready || !active) return;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * MIN);
    api
      .occurrences(dateStr(now), dateStr(tomorrow))
      .then((o) => (occRef.current = o))
      .catch(() => {});
  }, [ready, active, rev]);

  /** Opening: greeting, the day's summary, missed reminders. */
  useEffect(() => {
    if (!ready || !active || !introDone || greeted.current) return;
    greeted.current = true;
    const t = setTimeout(async () => {
      const now = new Date();
      const occ = await api.occurrences(dateStr(now), dateStr(now)).catch(() => [] as Occurrence[]);
      occRef.current = occ;
      const st = useApp.getState();
      const { remaining, timed, dueToday, overdue } = todayParts(occ.filter((o) => visibleRef.current(o.event.categoryId)), st.tasks, now);
      const s = pipSettings();
      const last = s.lastGreet ? new Date(s.lastGreet) : null;
      const sameDay = last && dateStr(last) === dateStr(now);
      await st.setSetting("companion", { ...s, lastGreet: now.toISOString() }).catch(() => {});

      if (sameDay) {
        say("welcomeBack");
      } else {
        const h = now.getHours();
        say(h < 5 ? "greetNight" : h < 12 ? "greetMorning" : h < 17 ? "greetAfternoon" : h < 22 ? "greetEvening" : "greetNight");
      }
      const count = remaining.length + dueToday.length;
      const first = timed[0] ?? remaining[0];
      if (!sameDay || count > 0) {
        if (count >= 5) say("busy", { count });
        else if (remaining.length === 1 && first) say("one", { title: first.event.title, time: label(first) });
        else if (remaining.length > 1 && first) say("some", { things: things(remaining.length, "thing"), title: first.event.title, time: label(first) });
        else if (remaining.length === 0 && dueToday.length && count < 5) say("tasksOnly", { things: things(dueToday.length, "task") });
        else if (count === 0 && !sameDay) say("empty");
        if (remaining.length && dueToday.length && count < 5) say("dueToday", { things: things(dueToday.length, "task") });
        if (overdue.length) say("overdue", { things: things(overdue.length, "task") });
      }
      const missed = st.feed.filter((i) => i.status === "missed").length;
      if (missed) say("missed", { count: missed });
      for (const i of st.feed) if (i.status === "fired" || i.status === "missed") announced.current.add(`rem:${i.key}`);
    }, 1800);
    return () => clearTimeout(t);
  }, [ready, active, introDone, say]);

  /** Every 30 seconds: events about to start, the resting mood, an occasional remark. */
  useEffect(() => {
    if (!ready || !active) return;
    const tick = () => {
      const now = new Date();
      const st = useApp.getState();
      const occ = occRef.current.filter((o) => visibleRef.current(o.event.categoryId));
      const parts = todayParts(occ, st.tasks, now);
      setBase(st.settings.focus?.sleep || (parts.remaining.length === 0 && parts.dueToday.length === 0) ? "sleepy" : "idle");
      if (document.visibilityState !== "visible" || st.settings.focus?.sleep) return;

      for (const o of occ) {
        if (isDateOnly(o.start)) continue;
        const mins = (parse(o.start).getTime() - now.getTime()) / MIN;
        const soonKey = `soon:${o.key}`;
        const nowKey = `now:${o.key}`;
        if (mins > 1 && mins <= 15 && !announced.current.has(soonKey)) {
          announced.current.add(soonKey);
          say("soon", { title: o.event.title, mins: Math.ceil(mins) }, { urgent: true });
        } else if (mins <= 1 && mins > -2 && !announced.current.has(nowKey)) {
          announced.current.add(nowKey);
          announced.current.add(soonKey);
          say("now", { title: o.event.title }, { urgent: true });
        }
      }

      // A remark every 35 to 55 minutes, only when Pip has been quiet for a while.
      const quiet = Date.now() - Math.max(usePip.getState().lastSpokeAt, lastQuip.current);
      if (quiet > (35 + Math.random() * 20) * MIN && !usePip.getState().line) {
        lastQuip.current = Date.now();
        const next = parts.timed.find((o) => parse(o.start) > now);
        const r = Math.random();
        if (parts.overdue.length && r < 0.4) say("quipOverdue", { things: things(parts.overdue.length, "task") });
        else if (next && r < 0.75) say("quipNext", { title: next.event.title, time: label(next) });
        else if (!parts.remaining.length && r < 0.75) say("quipFree");
        else say("quipAny");
      }
    };
    tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, [ready, active, say, setBase]);

  /** Reminders as they fire (skipping ones the 15-minute heads-up already covered). */
  useEffect(() => {
    if (!ready || !active) return;
    const now = Date.now();
    for (const i of feed) {
      const key = `rem:${i.key}`;
      if (i.status !== "fired" || announced.current.has(key)) continue;
      announced.current.add(key);
      if (now - parse(i.fireAt).getTime() > 3 * MIN) continue;
      const covered = occRef.current.some(
        (o) => o.event.title === i.title && o.start === i.startsAt && (announced.current.has(`soon:${o.key}`) || announced.current.has(`now:${o.key}`)),
      );
      if (!covered && document.visibilityState === "visible" && !sleep) say("reminder", { title: i.title }, { urgent: true });
    }
  }, [feed, ready, active, sleep, say]);

  /** A cheer when a task is ticked off. */
  useEffect(() => {
    if (!ready) return;
    const prev = doneRef.current;
    const map = new Map(tasks.map((t) => [t.id, t.done]));
    doneRef.current = map;
    if (!prev || !active) return;
    const newlyDone = tasks.filter((t) => t.done && prev.get(t.id) === false);
    if (!newlyDone.length) return;
    const left = tasks.filter((t) => !t.done).length;
    say(left === 0 ? "allDone" : "taskDone");
  }, [tasks, ready, active, say]);

  /** Coming back to the window after a while. */
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 20 * MIN) {
        hiddenAt.current = null;
        say("welcomeBack");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, say]);
}

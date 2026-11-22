"use client";
import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Repeat, TriangleAlert } from "@/components/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { Button, Segmented, cn } from "@/components/ui";
import { onDay, useOccurrences } from "@/components/widgets/calendar";
import { api } from "@/lib/api";
import { WEEKDAYS, dateStr, dtStr, fmtTime, monthGrid, parse, relDay } from "@/lib/dates";
import { useApp, useCategory } from "@/lib/store";
import type { Occurrence } from "@/lib/types";

type View = "month" | "week" | "day" | "agenda";
const HOUR = 52;

/** Moving one occurrence moves its whole series by the same amount. */
function useMove() {
  const bump = useApp((s) => s.bump);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  return async (o: Occurrence, target: Date) => {
    const delta = target.getTime() - parse(o.start).getTime();
    if (delta === 0) return;
    const ev = o.event;
    const newStart = new Date(parse(ev.start).getTime() + delta);
    try {
      await api.moveEvent(ev.id, ev.allDay ? dateStr(newStart) : dtStr(newStart));
      bump();
      toast(ev.recur.freq !== "none" ? "Moved every repeat of this event" : "Event moved");
    } catch (e) {
      fail(e);
    }
  };
}

function Chip({ o, compact }: { o: Occurrence; compact?: boolean }) {
  const cat = useCategory()(o.event.categoryId);
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const openEvent = useApp((s) => s.openEvent);
  const color = cat?.color ?? "var(--terracotta)";
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/schedulr", o.key);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        openEvent(o.event);
      }}
      title={`${o.event.title}${o.conflict ? " (overlaps another event)" : ""}`}
      className={cn(
        "press flex w-full min-w-0 cursor-grab items-center gap-1.5 rounded-[10px] px-2 py-1 text-left text-xs active:cursor-grabbing",
        o.event.allDay ? "text-on-dark" : "bg-cream text-ink shadow-raise",
      )}
      style={o.event.allDay ? { background: color } : undefined}
    >
      {!o.event.allDay && <span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: color }} />}
      {!o.event.allDay && !compact && <span className="num shrink-0 text-muted">{fmtTime(parse(o.start), h24)}</span>}
      <span className="min-w-0 flex-1 truncate font-medium">{o.event.title}</span>
      {o.event.recur.freq !== "none" && <Repeat size={12} className="shrink-0 opacity-70" aria-label="Repeats" />}
      {o.conflict && <TriangleAlert size={13} className="shrink-0 text-terracotta" aria-label="Overlaps another event" />}
    </button>
  );
}

function MonthView({ cursor, occ, move }: { cursor: Date; occ: Occurrence[]; move: ReturnType<typeof useMove> }) {
  const grid = monthGrid(cursor);
  const openEvent = useApp((s) => s.openEvent);
  const [over, setOver] = useState<string | null>(null);
  const today = new Date();
  return (
    <div className="clay shape-a overflow-hidden p-3 sm:p-4">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-2 text-center text-sm font-semibold text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {grid.map((d) => {
          const items = occ.filter((o) => onDay(o, d));
          const k = dateStr(d);
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              aria-label={`${format(d, "EEEE d MMMM")}, ${items.length} events. Press Enter to add one.`}
              onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && openEvent({ start: `${k}T09:00`, end: `${k}T10:00` })}
              onDoubleClick={() => openEvent({ start: `${k}T09:00`, end: `${k}T10:00` })}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(k);
              }}
              onDragLeave={() => setOver((x) => (x === k ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const o = occ.find((x) => x.key === e.dataTransfer.getData("text/schedulr"));
                if (!o) return;
                const s = parse(o.start);
                move(o, new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.getHours(), s.getMinutes()));
              }}
              className={cn(
                "flex min-h-[112px] min-w-0 flex-col gap-1 rounded-[16px] p-1.5 transition-[background-color] duration-150",
                isSameMonth(d, cursor) ? "bg-[color-mix(in_oklab,var(--cream-deep)_55%,transparent)]" : "opacity-55",
                over === k && "bg-marigold-soft/60",
              )}
            >
              <span
                className={cn(
                  "num grid h-7 w-7 place-items-center self-end rounded-full text-sm",
                  isSameDay(d, today) && "bg-marigold font-bold text-espresso shadow-raise",
                )}
              >
                {format(d, "d")}
              </span>
              {items.slice(0, 3).map((o) => (
                <Chip key={o.key} o={o} compact />
              ))}
              {items.length > 3 && <span className="px-1 text-2xs text-muted">{items.length - 3} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Lays out overlapping timed events side by side. */
function columns(items: Occurrence[]) {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start));
  const out: { o: Occurrence; col: number; cols: number }[] = [];
  let group: typeof out = [];
  let groupEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => (g.cols = n));
    out.push(...group);
    group = [];
  };
  for (const o of sorted) {
    const s = parse(o.start).getTime(), e = parse(o.end).getTime();
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => parse(g.o.end).getTime() > s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ o, col, cols: 1 });
    groupEnd = Math.max(groupEnd, e);
  }
  flush();
  return out;
}

function TimeGrid({ days, occ, move }: { days: Date[]; occ: Occurrence[]; move: ReturnType<typeof useMove> }) {
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const openEvent = useApp((s) => s.openEvent);
  const cat = useCategory();
  const scroller = useRef<HTMLDivElement>(null);
  const now = new Date();
  useEffect(() => {
    scroller.current?.scrollTo({ top: HOUR * 7 });
  }, []);
  const minutesAt = (e: React.DragEvent | React.MouseEvent, el: HTMLElement) => {
    const y = e.clientY - el.getBoundingClientRect().top;
    return Math.max(0, Math.min(24 * 60 - 15, Math.round(((y / HOUR) * 60) / 15) * 15));
  };
  return (
    <div className="clay shape-a overflow-hidden">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="px-2 py-3 text-center">
            <p className="text-xs text-muted">{format(d, "EEE")}</p>
            <p className={cn("num mx-auto grid h-9 w-9 place-items-center rounded-full text-lg", isSameDay(d, now) && "bg-marigold font-bold shadow-raise")}>{format(d, "d")}</p>
            <div className="mt-1 flex flex-col gap-1">
              {occ.filter((o) => o.event.allDay && onDay(o, d)).map((o) => (
                <Chip key={o.key} o={o} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={scroller} className="soft-scroll relative max-h-[calc(100dvh-330px)] min-h-[360px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0,1fr))`, height: HOUR * 24 }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="num absolute right-2 -translate-y-2 text-2xs text-muted" style={{ top: h * HOUR }}>
                {h === 0 ? "" : fmtTime(new Date(2000, 0, 1, h), h24)}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const timed = occ.filter((o) => !o.event.allDay && onDay(o, d));
            const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return (
              <div
                key={d.toISOString()}
                className="relative border-l border-line"
                onDoubleClick={(e) => {
                  const m = minutesAt(e, e.currentTarget);
                  const s = new Date(d0.getTime() + m * 60000);
                  openEvent({ start: dtStr(s), end: dtStr(new Date(s.getTime() + 3600000)) });
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const o = occ.find((x) => x.key === e.dataTransfer.getData("text/schedulr"));
                  if (o) move(o, new Date(d0.getTime() + minutesAt(e, e.currentTarget) * 60000));
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR }} />
                ))}
                {isSameDay(d, now) && (
                  <div className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-terracotta" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR }} aria-hidden />
                )}
                {columns(timed).map(({ o, col, cols }) => {
                  const s = parse(o.start), e = parse(o.end);
                  const top = Math.max(0, (s.getTime() - d0.getTime()) / 3600000) * HOUR;
                  const bottom = Math.min(24, (e.getTime() - d0.getTime()) / 3600000) * HOUR;
                  const color = cat(o.event.categoryId)?.color ?? "var(--terracotta)";
                  return (
                    <button
                      key={o.key}
                      type="button"
                      draggable
                      onDragStart={(ev) => ev.dataTransfer.setData("text/schedulr", o.key)}
                      onClick={() => openEvent(o.event)}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      className="press absolute z-[1] flex cursor-grab flex-col overflow-hidden rounded-[12px] bg-cream px-2 py-1 text-left shadow-raise"
                      style={{ top: top + 1, height: Math.max(22, bottom - top - 2), left: `calc(${(col / cols) * 100}% + 3px)`, width: `calc(${100 / cols}% - 6px)`, borderLeft: `4px solid ${color}` }}
                    >
                      <span className="truncate text-xs font-semibold text-ink">{o.event.title}</span>
                      <span className="num truncate text-2xs text-muted">
                        {fmtTime(s, h24)} to {fmtTime(e, h24)}
                        {o.conflict && ", overlaps"}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Agenda({ occ }: { occ: Occurrence[] }) {
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const openEvent = useApp((s) => s.openEvent);
  const cat = useCategory();
  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occ) {
      const k = o.start.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return [...m.entries()];
  }, [occ]);
  if (!byDay.length) return <div className="clay shape-a p-8 text-muted">Nothing in the next 30 days.</div>;
  return (
    <div className="flex flex-col gap-4">
      {byDay.map(([k, items]) => (
        <section key={k} className="clay shape-b px-6 py-4">
          <h2 className="display text-xl text-forest">{relDay(parse(k))}</h2>
          <ul className="mt-2 divide-y divide-line">
            {items.map((o) => (
              <li key={o.key}>
                <button type="button" onClick={() => openEvent(o.event)} className="press flex w-full items-center gap-4 py-2.5 text-left">
                  <span className="num w-28 shrink-0 text-sm text-muted">{o.event.allDay ? "All day" : `${fmtTime(parse(o.start), h24)} to ${fmtTime(parse(o.end), h24)}`}</span>
                  <span aria-hidden className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: cat(o.event.categoryId)?.color ?? "var(--terracotta)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-md font-semibold text-ink">{o.event.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {[o.event.kind === "meeting" ? "Meeting" : "", o.event.location, cat(o.event.categoryId)?.name].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  {o.conflict && <TriangleAlert size={18} className="shrink-0 text-terracotta" aria-label="Overlaps another event" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const openEvent = useApp((s) => s.openEvent);
  const move = useMove();

  const { from, to, days, title } = useMemo(() => {
    if (view === "month") {
      const g = monthGrid(cursor);
      return { from: g[0], to: addDays(g[41], 1), days: [], title: format(cursor, "MMMM yyyy") };
    }
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const ds = Array.from({ length: 7 }, (_, i) => addDays(s, i));
      return { from: s, to: addDays(s, 7), days: ds, title: `${format(s, "d MMM")} to ${format(addDays(s, 6), "d MMM yyyy")}` };
    }
    if (view === "day") {
      const s = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      return { from: s, to: addDays(s, 1), days: [s], title: format(s, "EEEE d MMMM yyyy") };
    }
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { from: s, to: addDays(s, 30), days: [], title: `From ${format(s, "d MMMM")}` };
  }, [view, cursor]);

  const occ = useOccurrences(from, to);
  const step = (n: number) =>
    setCursor((c) => (view === "month" ? addMonths(c, n) : view === "week" ? addWeeks(c, n) : addDays(c, n * (view === "agenda" ? 30 : 1))));

  return (
    <>
      <PageHeader title="Calendar" help={<><p>Month, week, day and agenda views of everything you have planned.</p><p>Drag an event to move it. A repeating event moves every repeat. Double-click an empty spot to add an event. A warning sign marks events that overlap.</p></>}>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
            { value: "agenda", label: "Agenda" },
          ]}
        />
        <Button tone="primary" onClick={() => openEvent()}>
          <Plus size={18} /> New event
        </Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button tone="clay" size="icon" aria-label="Previous" onClick={() => step(-1)}>
          <ChevronLeft size={20} />
        </Button>
        <Button tone="clay" size="icon" aria-label="Next" onClick={() => step(1)}>
          <ChevronRight size={20} />
        </Button>
        <Button tone="clay" size="sm" onClick={() => setCursor(new Date())}>
          Today
        </Button>
        <h2 className="display ml-2 text-3xl text-forest" aria-live="polite">
          {title}
        </h2>
        <p className="ml-auto text-xs text-muted">Drag an event to move it. Double-click to add one.</p>
      </div>
      {view === "month" && <MonthView cursor={cursor} occ={occ} move={move} />}
      {(view === "week" || view === "day") && <TimeGrid days={days} occ={occ} move={move} />}
      {view === "agenda" && <Agenda occ={occ} />}
    </>
  );
}

"use client";
import { addDays, addMonths, format, isSameDay, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { Button, Help, cn } from "../ui";
import { api } from "@/lib/api";
import { WEEKDAYS_SHORT, dateStr, fmtTime, monthGrid, parse, relDay } from "@/lib/dates";
import { useApp, useCategory, useVisible } from "@/lib/store";
import { FeaturedDetails, useFeatured } from "./featured";
import type { Occurrence } from "@/lib/types";

/** Occurrences for a date range, refetched whenever data changes. */
export function useOccurrences(from: Date, to: Date) {
  const rev = useApp((s) => s.rev);
  const ready = useApp((s) => s.ready);
  const fail = useApp((s) => s.fail);
  const visible = useVisible();
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const f = dateStr(from), t = dateStr(to);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    api.occurrences(f, t).then((o) => alive && setOcc(o)).catch(fail);
    return () => {
      alive = false;
    };
  }, [f, t, rev, ready, fail]);
  return useMemo(() => occ.filter((o) => visible(o.event.categoryId)), [occ, visible]);
}

/** True when an occurrence touches the given day. */
export function onDay(o: Occurrence, day: Date) {
  const s = parse(o.start), e = parse(o.end);
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const d1 = addDays(d0, 1);
  if (o.event.allDay) return s < d1 && addDays(e, 1) > d0;
  return s < d1 && (e > d0 || s.getTime() === d0.getTime());
}

export function MiniCalendar({ className }: { className?: string }) {
  const [month, setMonth] = useState(() => new Date());
  const calDay = useApp((s) => s.calDay);
  const setCalDay = useApp((s) => s.setCalDay);
  const selected = calDay ? parse(calDay) : new Date();
  const setSelected = (d: Date) => setCalDay(dateStr(d));
  const grid = useMemo(() => monthGrid(month), [month]);
  const occ = useOccurrences(grid[0], addDays(grid[41], 1));
  const openEvent = useApp((s) => s.openEvent);
  const cat = useCategory();
  const today = new Date();

  function key(e: React.KeyboardEvent, d: Date) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = addDays(d, step);
    setSelected(next);
    if (!isSameMonth(next, month)) setMonth(next);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-day="${dateStr(next)}"]`)?.focus());
  }

  return (
    <section aria-labelledby="cal-h" className={cn("clay shape-a clay-lift px-5 pb-5 pt-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="cal-h" className="text-lg font-semibold text-forest" aria-live="polite">
          {format(month, "MMMM yyyy")}
        </h2>
        <div className="flex items-center">
          <Help title="Calendar" className="mr-1">
            <p>Pick a day to see its events in the card beside it. Coloured marks under a date show it has events.</p>
            <p>Double-click a day to add an event there. The full calendar is under Calendar on the bottom bar.</p>
          </Help>
          <Button tone="ghost" size="iconSm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft size={18} />
          </Button>
          <Button tone="ghost" size="iconSm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
      <div role="grid" aria-label={format(month, "MMMM yyyy")} className="mt-2 grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS_SHORT.map((d, i) => (
          <div key={i} role="columnheader" className="pb-1 text-xs font-semibold text-ink">
            {d}
          </div>
        ))}
        {grid.map((d) => {
          const items = occ.filter((o) => onDay(o, d));
          const isToday = isSameDay(d, today);
          const isSel = isSameDay(d, selected);
          return (
            <button
              key={d.toISOString()}
              type="button"
              role="gridcell"
              data-day={dateStr(d)}
              aria-selected={isSel}
              aria-label={`${format(d, "EEEE d MMMM")}${items.length ? `, ${items.length} ${items.length === 1 ? "event" : "events"}` : ""}`}
              tabIndex={isSel ? 0 : -1}
              onClick={() => setSelected(d)}
              onDoubleClick={() => openEvent({ start: `${dateStr(d)}T09:00`, end: `${dateStr(d)}T10:00` })}
              onKeyDown={(e) => key(e, d)}
              className={cn(
                "press relative mx-auto grid h-9 w-9 place-items-center rounded-full text-sm num",
                isSameMonth(d, month) ? "text-ink" : "text-muted/55",
                isToday && "bg-marigold font-bold text-espresso shadow-raise",
                isSel && !isToday && "bg-cream-deep shadow-sunk",
                isSel && isToday && "outline outline-2 outline-offset-2 outline-forest",
              )}
            >
              {format(d, "d")}
              {items.length > 0 && (
                <span aria-hidden className="absolute bottom-[3px] left-1/2 flex -translate-x-1/2 gap-[2px]">
                  {items.slice(0, 3).map((o) => (
                    <span key={o.key} className="h-[3px] w-[6px] rounded-full" style={{ background: cat(o.event.categoryId)?.color ?? "var(--terracotta)" }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The featured event, then the picked day's other events, beside the calendar. */
export function DayAgenda({ className }: { className?: string }) {
  const calDay = useApp((s) => s.calDay);
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const openEvent = useApp((s) => s.openEvent);
  const cat = useCategory();
  const featured = useFeatured();
  const day = calDay ? parse(calDay) : new Date();
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const items = useOccurrences(d0, addDays(d0, 1)).filter((o) => onDay(o, d0) && o.key !== featured?.key);
  const k = dateStr(d0);
  return (
    <section aria-labelledby="featured-h" className={cn("clay shape-c clay-lift relative px-6 pb-4 pt-5", className)}>
      <Help title="Next up" className="absolute right-4 top-4 z-[2]">
        <p>Your next important event or meeting, with a live countdown. Turn on “Feature on the dashboard” in an event to keep it here. Otherwise the next event shows.</p>
        <p>Below it are the other events on the day you pick in the calendar.</p>
      </Help>
      <FeaturedDetails />
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <h3 className="text-md font-semibold text-forest" aria-live="polite">
          {relDay(d0)}
        </h3>
        <Button tone="ghost" size="sm" onClick={() => openEvent({ start: `${k}T09:00`, end: `${k}T10:00` })}>
          <Plus size={16} /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{featured ? "Nothing else on this day." : "Nothing on this day."} Pick another date on the calendar.</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 5).map((o) => {
            const color = cat(o.event.categoryId)?.color ?? "var(--terracotta)";
            const where = o.event.location || (o.event.meetingUrl ? "Online" : "");
            return (
              <li key={o.key}>
                <button type="button" onClick={() => openEvent(o.event)} className="press flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left hover:bg-cream-deep">
                  <span aria-hidden className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="num w-14 shrink-0 text-sm text-muted">{o.event.allDay ? "All day" : fmtTime(parse(o.start), h24)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-ink">{o.event.title}</span>
                    {where && <span className="block truncate text-xs text-muted">{where}</span>}
                  </span>
                  {o.conflict && <TriangleAlert size={15} className="shrink-0 text-terracotta" aria-label="Overlaps another event" />}
                </button>
              </li>
            );
          })}
          {items.length > 5 && <li className="px-2 text-xs text-muted">{items.length - 5} more in the calendar</li>}
        </ul>
      )}
    </section>
  );
}

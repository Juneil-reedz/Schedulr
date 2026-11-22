"use client";
import { format } from "date-fns";
import { Copy, Download, MapPin, Pencil, Repeat, Search, Trash2, Video } from "@/components/icons";
import { useEffect, useState } from "react";
import { Button, Chip, Input, Segmented } from "./ui";
import { api, confirmAsk, openUrl, revealPath } from "@/lib/api";
import { fmtTime, isDateOnly, parse } from "@/lib/dates";
import { useApp, useCategory, useVisible } from "@/lib/store";
import type { SchedEvent } from "@/lib/types";

const FREQ: Record<string, string> = { daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year" };

export function repeatLabel(e: SchedEvent) {
  if (e.recur.freq === "none") return "";
  const unit: Record<string, string> = { daily: "days", weekly: "weeks", monthly: "months", yearly: "years" };
  return e.recur.interval > 1 ? `Every ${e.recur.interval} ${unit[e.recur.freq]}` : FREQ[e.recur.freq];
}

export function EventList({ kind }: { kind?: "meeting" }) {
  const categories = useApp((s) => s.categories);
  const rev = useApp((s) => s.rev);
  const h24 = useApp((s) => s.settings.clock24h ?? true);
  const openEvent = useApp((s) => s.openEvent);
  const bump = useApp((s) => s.bump);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const visible = useVisible();
  const cat = useCategory();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [type, setType] = useState<"all" | "event" | "meeting">(kind ?? "all");
  const [items, setItems] = useState<SchedEvent[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.searchEvents(q, category, type === "all" ? null : type).then(setItems).catch(fail);
    }, 180);
    return () => clearTimeout(t);
  }, [q, category, type, rev, fail]);

  const shown = items.filter((e) => visible(e.categoryId));

  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      bump();
      toast(msg);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="clay shape-b flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Search</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, places, people, agendas" className="pl-10" />
          </label>
          {!kind && (
            <Segmented
              label="Type"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: "All" },
                { value: "event", label: "Events" },
                { value: "meeting", label: "Meetings" },
              ]}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            All categories
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={category === c.id} color={c.color} onClick={() => setCategory(category === c.id ? null : c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="clay shape-a px-7 py-8">
          <p className="text-lg font-semibold text-ink">{q || category ? "Nothing matches" : kind ? "No meetings yet" : "No events yet"}</p>
          <p className="mt-1 text-muted">{q || category ? "Try another word or category." : "Add one and it will appear here and in the calendar."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((e) => {
            const c = cat(e.categoryId);
            const s = parse(e.start);
            return (
              <li key={e.id} className="clay shape-c clay-lift flex flex-col px-6 py-5">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: c?.color ?? "var(--terracotta)" }} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openEvent(e)} className="text-left">
                      <h3 className="display text-2xl leading-snug text-forest hover:underline hover:decoration-terracotta/50 hover:underline-offset-4">{e.title}</h3>
                    </button>
                    <p className="mt-1 text-base text-ink">
                      {format(s, "EEE d MMM yyyy")}
                      {isDateOnly(e.start) ? ", all day" : `, ${fmtTime(s, h24)} to ${fmtTime(parse(e.end), h24)}`}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      {c && <span>{c.name}</span>}
                      {e.kind === "meeting" && <span>Meeting{e.participants.length ? ` with ${e.participants.length}` : ""}</span>}
                      {e.recur.freq !== "none" && (
                        <span className="inline-flex items-center gap-1">
                          <Repeat size={13} aria-hidden /> {repeatLabel(e)}
                        </span>
                      )}
                      {e.location && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin size={13} aria-hidden /> <span className="truncate">{e.location}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1 pl-4">
                  <Button tone="ghost" size="sm" onClick={() => openEvent(e)}>
                    <Pencil size={15} /> Edit
                  </Button>
                  {e.meetingUrl && (
                    <Button tone="ghost" size="sm" onClick={() => openUrl(e.meetingUrl)}>
                      <Video size={15} /> Join
                    </Button>
                  )}
                  <Button tone="ghost" size="sm" onClick={() => act(() => api.duplicateEvent(e.id), "Duplicated")}>
                    <Copy size={15} /> Duplicate
                  </Button>
                  <Button
                    tone="ghost"
                    size="sm"
                    onClick={() =>
                      act(async () => {
                        const p = await api.exportIcs(e.id);
                        revealPath(p);
                      }, "Invitation file saved")
                    }
                  >
                    <Download size={15} /> .ics
                  </Button>
                  <Button
                    tone="danger"
                    size="sm"
                    onClick={async () => {
                      if (await confirmAsk(`Delete “${e.title}”?`)) act(() => api.deleteEvent(e.id), "Deleted");
                    }}
                  >
                    <Trash2 size={15} /> Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";
import { addHours, format } from "date-fns";
import { Copy, Download, ImagePlus, Plus, Trash2, TriangleAlert, Video, X } from "@/components/icons";
import { useEffect, useState } from "react";
import { Button, Chip, Field, Input, Modal, Segmented, Select, Textarea, Toggle, cn } from "./ui";
import { api, confirmAsk, errorText, openUrl, pickImage, revealPath } from "@/lib/api";
import { WEEKDAYS, dateStr, dtStr, fmtTime, minutesLabel, parse } from "@/lib/dates";
import { useFileSrc } from "@/lib/hooks";
import { pushToGoogleCalendar } from "@/lib/composio";
import { useApp } from "@/lib/store";
import type { Freq, LocationType, Occurrence, SchedEvent } from "@/lib/types";

const PRESETS = [0, 5, 10, 15, 30, 60, 1440];

function blank(): SchedEvent {
  const s = new Date();
  s.setMinutes(0, 0, 0);
  const start = addHours(s, 1);
  return {
    id: "", kind: "event", title: "", description: "", categoryId: null, start: dtStr(start), end: dtStr(addHours(start, 1)),
    allDay: false, locationType: "none", location: "", meetingUrl: "", participants: [], agenda: "",
    recur: { freq: "none", interval: 1, weekdays: [], until: null, count: null }, important: false, imagePath: null,
    reminders: [{ id: "", offsetMinutes: 15, at: null }], createdAt: "", updatedAt: "",
  };
}

const splitDT = (s: string) => ({ d: s.slice(0, 10), t: s.length > 10 ? s.slice(11, 16) : "09:00" });

export function EventDialog() {
  const { open, draft } = useApp((s) => s.eventDialog);
  const close = useApp((s) => s.closeEvent);
  const categories = useApp((s) => s.categories);
  const h24 = useApp((s) => s.settings.clock24h ?? false);
  const bump = useApp((s) => s.bump);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const [ev, setEv] = useState<SchedEvent>(blank);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Occurrence[]>([]);
  const [ends, setEnds] = useState<"never" | "on" | "after">("never");
  const [customAt, setCustomAt] = useState("");
  const [busy, setBusy] = useState(false);
  const imgSrc = useFileSrc(ev.imagePath);

  useEffect(() => {
    if (!open) return;
    const base = { ...blank(), ...(draft ?? {}) } as SchedEvent;
    if (base.kind === "meeting" && base.locationType === "none" && !draft?.id) base.locationType = "online";
    if (!base.categoryId) base.categoryId = base.kind === "meeting" ? "meetings" : null;
    setEv(structuredClone(base));
    setEnds(base.recur.count ? "after" : base.recur.until ? "on" : "never");
    setError(null);
    setCustomAt("");
  }, [open, draft]);

  const set = (p: Partial<SchedEvent>) => setEv((e) => ({ ...e, ...p }));
  const isNew = !ev.id;
  const isMeeting = ev.kind === "meeting";

  // Live conflict check.
  useEffect(() => {
    if (!open || ev.allDay) return setConflicts([]);
    const t = setTimeout(() => {
      api.findConflicts(ev.start, ev.end, ev.allDay, ev.id || undefined).then(setConflicts).catch(() => setConflicts([]));
    }, 250);
    return () => clearTimeout(t);
  }, [open, ev.start, ev.end, ev.allDay, ev.id]);

  function setAllDay(v: boolean) {
    if (v) set({ allDay: true, start: ev.start.slice(0, 10), end: ev.end.slice(0, 10) });
    else set({ allDay: false, start: `${ev.start.slice(0, 10)}T09:00`, end: `${ev.end.slice(0, 10)}T10:00` });
  }

  function setStart(d: string, t: string) {
    const nextStart = ev.allDay ? d : `${d}T${t}`;
    // Keep the length of the event when the start moves.
    const dur = parse(ev.end).getTime() - parse(ev.start).getTime();
    const nextEnd = new Date(parse(nextStart).getTime() + Math.max(0, dur));
    set({ start: nextStart, end: ev.allDay ? dateStr(nextEnd) : dtStr(nextEnd) });
  }

  function toggleOffset(m: number) {
    const has = ev.reminders.some((r) => r.offsetMinutes === m);
    set({ reminders: has ? ev.reminders.filter((r) => r.offsetMinutes !== m) : [...ev.reminders, { id: "", offsetMinutes: m, at: null }] });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const out: SchedEvent = {
        ...ev,
        recur: {
          ...ev.recur,
          until: ends === "on" ? ev.recur.until : null,
          count: ends === "after" ? ev.recur.count || 1 : null,
        },
        participants: ev.participants.filter((p) => p.name.trim() || p.email.trim()),
      };
      await api.saveEvent(out);
      bump();
      toast(isNew ? `${isMeeting ? "Meeting" : "Event"} added` : "Changes saved");
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const series = ev.recur.freq !== "none" ? " This removes every repeat of it." : "";
    if (!(await confirmAsk(`Delete “${ev.title}”?${series}`))) return;
    try {
      await api.deleteEvent(ev.id);
      bump();
      toast("Deleted");
      close();
    } catch (e) {
      fail(e);
    }
  }

  async function duplicate() {
    try {
      const copy = await api.duplicateEvent(ev.id);
      bump();
      toast("Duplicated");
      useApp.getState().openEvent(copy);
    } catch (e) {
      fail(e);
    }
  }

  async function exportIcs() {
    try {
      const path = await api.exportIcs(ev.id);
      toast("Invitation file saved");
      revealPath(path);
    } catch (e) {
      fail(e);
    }
  }

  const composio = useApp((x) => x.settings.composio);
  async function pushGoogle() {
    const invites = ev.participants.some((p) => p.email);
    const msg = invites
      ? `Copy “${ev.title}” to your Google Calendar and email invitations to ${ev.participants.filter((p) => p.email).length} people?`
      : `Copy “${ev.title}” to your Google Calendar?`;
    if (!(await confirmAsk(msg))) return;
    try {
      await pushToGoogleCalendar(composio!, ev, invites);
      toast("Added to Google Calendar");
    } catch (x) {
      fail(x);
    }
  }

  const s = splitDT(ev.start), e = splitDT(ev.end);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && close()}
      wide
      title={isNew ? (isMeeting ? "New meeting" : "New event") : ev.title || "Event"}
      footer={
        <>
          {!isNew && (
            <>
              <Button tone="danger" size="sm" onClick={remove}>
                <Trash2 size={16} /> Delete
              </Button>
              <Button tone="ghost" size="sm" onClick={duplicate}>
                <Copy size={16} /> Duplicate
              </Button>
              <Button tone="ghost" size="sm" onClick={exportIcs}>
                <Download size={16} /> Invite (.ics)
              </Button>
              {composio?.apiKey && (
                <Button tone="ghost" size="sm" onClick={pushGoogle}>
                  Copy to Google Calendar
                </Button>
              )}
            </>
          )}
          <span className="flex-1" />
          <Button tone="ghost" onClick={close}>
            Cancel
          </Button>
          <Button tone="primary" onClick={save} disabled={busy}>
            {isNew ? "Add" : "Save"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2"
        onSubmit={(x) => {
          x.preventDefault();
          save();
        }}
      >
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Segmented
            label="Type"
            value={ev.kind}
            onChange={(kind) => set({ kind, locationType: kind === "meeting" && ev.locationType === "none" ? "online" : ev.locationType, categoryId: kind === "meeting" && !ev.categoryId ? "meetings" : ev.categoryId })}
            options={[
              { value: "event", label: "Event" },
              { value: "meeting", label: "Meeting" },
            ]}
          />
          <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-base text-ink">
            <Toggle label="Feature on the dashboard" color="marigold" checked={ev.important} onChange={(important) => set({ important })} />
            Feature on the dashboard
          </label>
        </div>

        <Field label="Title" htmlFor="ev-title" className="md:col-span-2">
          <Input id="ev-title" autoFocus value={ev.title} onChange={(x) => set({ title: x.target.value })} placeholder={isMeeting ? "What is the meeting about?" : "What is happening?"} />
        </Field>

        <Field label="Category" htmlFor="ev-cat">
          <Select id="ev-cat" value={ev.categoryId ?? ""} onChange={(x) => set({ categoryId: x.target.value || null })}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.scope})
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 self-end pb-2.5 text-base text-ink">
          <Toggle label="All day" checked={ev.allDay} onChange={setAllDay} /> All day
        </label>

        <Field label="Starts" htmlFor="ev-sd">
          <div className="flex gap-2">
            <Input id="ev-sd" type="date" value={s.d} onChange={(x) => x.target.value && setStart(x.target.value, s.t)} />
            {!ev.allDay && <Input aria-label="Start time" type="time" value={s.t} onChange={(x) => x.target.value && setStart(s.d, x.target.value)} className="w-[130px] shrink-0" />}
          </div>
        </Field>
        <Field label="Ends" htmlFor="ev-ed">
          <div className="flex gap-2">
            <Input id="ev-ed" type="date" value={e.d} onChange={(x) => x.target.value && set({ end: ev.allDay ? x.target.value : `${x.target.value}T${e.t}` })} />
            {!ev.allDay && <Input aria-label="End time" type="time" value={e.t} onChange={(x) => x.target.value && set({ end: `${e.d}T${x.target.value}` })} className="w-[130px] shrink-0" />}
          </div>
        </Field>

        {conflicts.length > 0 && (
          <div role="status" className="flex gap-3 rounded-[18px] bg-[color-mix(in_oklab,var(--terracotta)_14%,var(--cream))] px-4 py-3 md:col-span-2">
            <TriangleAlert size={20} className="mt-0.5 shrink-0 text-terracotta" aria-hidden />
            <div className="text-sm text-ink">
              <p className="font-semibold">This overlaps {conflicts.length === 1 ? "another event" : `${conflicts.length} events`}</p>
              <ul className="mt-0.5 text-muted">
                {conflicts.slice(0, 3).map((c) => (
                  <li key={c.key}>
                    {c.event.title}, {fmtTime(parse(c.start), h24)} to {fmtTime(parse(c.end), h24)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <Field label="Repeats" htmlFor="ev-freq">
          <div className="flex gap-2">
            <Select id="ev-freq" value={ev.recur.freq} onChange={(x) => set({ recur: { ...ev.recur, freq: x.target.value as Freq } })}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
            {ev.recur.freq !== "none" && (
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
                every
                <Input type="number" min={1} max={99} value={ev.recur.interval} onChange={(x) => set({ recur: { ...ev.recur, interval: Math.max(1, Number(x.target.value) || 1) } })} className="w-[72px]" aria-label="Repeat interval" />
              </label>
            )}
          </div>
        </Field>
        {ev.recur.freq !== "none" ? (
          <Field label="Ends" htmlFor="ev-ends">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Repeat ends" value={ends} onChange={setEnds} options={[{ value: "never", label: "Never" }, { value: "on", label: "On" }, { value: "after", label: "After" }]} />
              {ends === "on" && <Input type="date" aria-label="Last date" value={ev.recur.until ?? ""} onChange={(x) => set({ recur: { ...ev.recur, until: x.target.value || null } })} className="w-[170px]" />}
              {ends === "after" && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  <Input type="number" min={1} aria-label="Number of times" value={ev.recur.count ?? 10} onChange={(x) => set({ recur: { ...ev.recur, count: Math.max(1, Number(x.target.value) || 1) } })} className="w-[80px]" />
                  times
                </label>
              )}
            </div>
          </Field>
        ) : (
          <div className="hidden md:block" />
        )}
        {ev.recur.freq === "weekly" && (
          <div className="flex flex-wrap gap-1.5 md:col-span-2" role="group" aria-label="Repeat on">
            {WEEKDAYS.map((d, i) => {
              const n = i + 1;
              const on = ev.recur.weekdays.includes(n);
              return (
                <Chip key={d} active={on} onClick={() => set({ recur: { ...ev.recur, weekdays: on ? ev.recur.weekdays.filter((x) => x !== n) : [...ev.recur.weekdays, n].sort() } })}>
                  {d}
                </Chip>
              );
            })}
          </div>
        )}

        <div className="md:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-muted">Reminders</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((m) => (
              <Chip key={m} active={ev.reminders.some((r) => r.offsetMinutes === m)} onClick={() => toggleOffset(m)}>
                {minutesLabel(m)}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ev.reminders
              .filter((r) => r.at)
              .map((r) => (
                <span key={r.at} className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-sm text-on-dark">
                  {format(parse(r.at!), "EEE d MMM")}, {fmtTime(parse(r.at!), h24)}
                  <button type="button" aria-label="Remove this reminder" onClick={() => set({ reminders: ev.reminders.filter((x) => x.at !== r.at) })} className="press rounded-full p-0.5 hover:bg-on-dark/20">
                    <X size={14} />
                  </button>
                </span>
              ))}
            <Input type="datetime-local" aria-label="Custom reminder time" value={customAt} onChange={(x) => setCustomAt(x.target.value)} className="w-[230px]" />
            <Button
              tone="ghost"
              size="sm"
              disabled={!customAt}
              onClick={() => {
                set({ reminders: [...ev.reminders, { id: "", offsetMinutes: null, at: customAt.slice(0, 16) }] });
                setCustomAt("");
              }}
            >
              <Plus size={15} /> Custom time
            </Button>
          </div>
        </div>

        <div className="md:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-muted">Where</p>
          <Segmented
            label="Where"
            value={ev.locationType}
            onChange={(locationType: LocationType) => set({ locationType })}
            options={[
              { value: "none", label: "Not set" },
              { value: "physical", label: "In person" },
              { value: "online", label: "Online" },
              { value: "hybrid", label: "Both" },
            ]}
          />
        </div>
        {(ev.locationType === "physical" || ev.locationType === "hybrid") && (
          <Field label="Place" htmlFor="ev-loc" className={ev.locationType === "physical" ? "md:col-span-2" : ""}>
            <Input id="ev-loc" value={ev.location} onChange={(x) => set({ location: x.target.value })} placeholder="Address or room" />
          </Field>
        )}
        {(ev.locationType === "online" || ev.locationType === "hybrid") && (
          <Field label="Meeting link" htmlFor="ev-url" className={ev.locationType === "online" ? "md:col-span-2" : ""}>
            <div className="flex gap-2">
              <Input id="ev-url" type="url" value={ev.meetingUrl} onChange={(x) => set({ meetingUrl: x.target.value })} placeholder="https://" />
              {/^https?:\/\//.test(ev.meetingUrl) && (
                <Button tone="forest" onClick={() => openUrl(ev.meetingUrl)}>
                  <Video size={16} /> Join
                </Button>
              )}
            </div>
          </Field>
        )}

        {isMeeting && (
          <>
            <div className="md:col-span-2">
              <p className="mb-1.5 text-sm font-semibold text-muted">People</p>
              <div className="space-y-2">
                {ev.participants.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input aria-label="Name" value={p.name} placeholder="Name" onChange={(x) => set({ participants: ev.participants.map((q, j) => (j === i ? { ...q, name: x.target.value } : q)) })} />
                    <Input aria-label="Email" type="email" value={p.email} placeholder="Email (for the invitation)" onChange={(x) => set({ participants: ev.participants.map((q, j) => (j === i ? { ...q, email: x.target.value } : q)) })} />
                    <Button tone="ghost" size="icon" aria-label="Remove person" onClick={() => set({ participants: ev.participants.filter((_, j) => j !== i) })}>
                      <X size={18} />
                    </Button>
                  </div>
                ))}
                <Button tone="ghost" size="sm" onClick={() => set({ participants: [...ev.participants, { name: "", email: "" }] })}>
                  <Plus size={15} /> Add a person
                </Button>
              </div>
            </div>
            <Field label="Agenda" htmlFor="ev-agenda" className="md:col-span-2">
              <Textarea id="ev-agenda" value={ev.agenda} onChange={(x) => set({ agenda: x.target.value })} placeholder="One point per line" />
            </Field>
          </>
        )}

        <Field label="Notes" htmlFor="ev-desc" className="md:col-span-2">
          <Textarea id="ev-desc" value={ev.description} onChange={(x) => set({ description: x.target.value })} />
        </Field>

        <div className="flex items-center gap-3 md:col-span-2">
          {imgSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt="" className="h-14 w-20 rounded-[14px] object-cover shadow-raise" />
          )}
          <Button
            tone="ghost"
            size="sm"
            onClick={async () => {
              try {
                const p = await pickImage();
                if (p) set({ imagePath: p });
              } catch (x) {
                fail(x);
              }
            }}
          >
            <ImagePlus size={16} /> {ev.imagePath ? "Change picture" : "Add a picture for the dashboard"}
          </Button>
          {ev.imagePath && (
            <Button tone="ghost" size="sm" onClick={() => set({ imagePath: null })}>
              Remove picture
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className={cn("rounded-[14px] bg-[color-mix(in_oklab,var(--danger)_12%,var(--cream))] px-4 py-2.5 text-base font-semibold text-danger md:col-span-2")}>
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

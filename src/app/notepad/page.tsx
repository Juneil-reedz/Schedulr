"use client";
import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotebookPen, Pin, PinOff, Plus, Search, Trash2 } from "@/components/icons";
import { PageHeader } from "@/components/Shell";
import { Button, Input, cn } from "@/components/ui";
import { api, confirmAsk, errorText } from "@/lib/api";
import { fmtTime, parse, relDay } from "@/lib/dates";
import { useApp } from "@/lib/store";
import type { Note } from "@/lib/types";

const blank = (): Note => ({ id: "", kind: "note", body: "", author: "", pinned: false, createdAt: "", updatedAt: "" });

/** First line of a note, used as its name in the list. */
const titleOf = (body: string) => body.split("\n").map((l) => l.trim()).find(Boolean) ?? "Empty note";

export default function NotepadPage() {
  const h24 = useApp((s) => s.settings.clock24h ?? false);
  const notes = useApp((s) => s.notes);
  const refreshNotes = useApp((s) => s.refreshNotes);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const [q, setQ] = useState("");
  const [current, setCurrent] = useState<Note>(blank);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Note | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes.filter((n) => n.kind === "note" && (!needle || n.body.toLowerCase().includes(needle)));
  }, [notes, q]);

  // Open the most recent note the first time the page loads.
  useEffect(() => {
    if (!current.id && !current.body && list[0]) setCurrent(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  async function persist(n: Note) {
    if (!n.body.trim()) {
      setStatus("saved");
      return n;
    }
    setStatus("saving");
    try {
      const saved = await api.saveNote(n);
      pending.current = null;
      // Keep the editor on this note, now with its saved id and time.
      setCurrent((c) => (c.id === saved.id || !c.id ? { ...c, id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt } : c));
      setStatus("saved");
      refreshNotes();
      return saved;
    } catch (e) {
      setStatus("error");
      fail(errorText(e));
      return n;
    }
  }

  /** Saves a moment after you stop typing. */
  function onType(body: string) {
    const next = { ...current, body };
    setCurrent(next);
    setStatus("unsaved");
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pending.current && persist(pending.current), 600);
  }

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) await persist(pending.current);
  }

  async function open(n: Note) {
    await flush();
    setCurrent(n);
    setStatus("saved");
  }

  async function newNote() {
    await flush();
    setCurrent(blank());
    setStatus("saved");
    requestAnimationFrame(() => area.current?.focus());
  }

  async function togglePin() {
    const next = { ...current, pinned: !current.pinned };
    setCurrent(next);
    if (next.body.trim()) await persist(next);
    toast(next.pinned ? "Pinned to the dashboard" : "Unpinned");
  }

  async function remove() {
    if (!current.id) return newNote();
    if (!(await confirmAsk(`Delete “${titleOf(current.body)}”?`))) return;
    try {
      if (timer.current) clearTimeout(timer.current);
      pending.current = null;
      await api.deleteNote(current.id);
      await refreshNotes();
      setCurrent(blank());
      toast("Note deleted");
    } catch (e) {
      fail(e);
    }
  }

  // Save before the page is left.
  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const words = current.body.trim() ? current.body.trim().split(/\s+/).length : 0;
  const statusText = { saved: current.id ? "Saved" : "Start typing to create a note", saving: "Saving…", unsaved: "Editing…", error: "Not saved" }[status];

  return (
    <>
      <PageHeader
        title="Notepad"
        help={
          <>
            <p>A place to write longer notes: meeting notes, ideas, lists, anything. Everything saves by itself a moment after you stop typing.</p>
            <p>The first line becomes the note’s name. Pin a note to show it on the dashboard’s floral band.</p>
          </>
        }
      >
        <Button tone="primary" onClick={newNote}>
          <Plus size={18} /> New note
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="clay shape-a flex max-h-[calc(100dvh-260px)] min-h-[260px] flex-col px-4 py-4">
          <label className="relative">
            <span className="sr-only">Search notes</span>
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-10" />
          </label>
          <ul className="soft-scroll mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Notes">
            {list.length === 0 && <li className="px-2 py-3 text-sm text-muted">{q ? "No note matches that." : "No notes yet."}</li>}
            {list.map((n) => {
              const active = n.id === current.id;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    aria-current={active ? "true" : undefined}
                    className={cn("press flex w-full flex-col rounded-[16px] px-3 py-2.5 text-left", active ? "bg-cream-deep shadow-sunk" : "hover:bg-cream-deep/60")}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned && <Pin size={13} className="shrink-0 text-terracotta" aria-label="Pinned" />}
                      <span className="truncate text-md font-semibold text-ink">{titleOf(n.body)}</span>
                    </span>
                    <span className="truncate text-xs text-muted">
                      {relDay(parse(n.updatedAt))}, {fmtTime(parse(n.updatedAt), h24)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section aria-label="Note" className="clay shape-b flex min-h-[calc(100dvh-260px)] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <NotebookPen size={18} className="text-terracotta" aria-hidden />
            <p className="text-sm text-muted" role="status" aria-live="polite">
              {statusText}
              {current.id && status === "saved" && current.updatedAt && `, ${fmtTime(parse(current.updatedAt), h24)}`}
            </p>
            <span className="flex-1" />
            <span className="num text-xs text-muted">{words === 1 ? "1 word" : `${words} words`}</span>
            <Button tone="ghost" size="sm" onClick={togglePin} disabled={!current.body.trim()} aria-pressed={current.pinned}>
              {current.pinned ? <PinOff size={15} /> : <Pin size={15} />} {current.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button tone="danger" size="sm" onClick={remove} disabled={!current.id}>
              <Trash2 size={15} /> Delete
            </Button>
          </div>
          <label htmlFor="notepad-body" className="sr-only">
            Note text
          </label>
          <textarea
            id="notepad-body"
            ref={area}
            value={current.body}
            onChange={(e) => onType(e.target.value)}
            onBlur={flush}
            placeholder="Write here. The first line becomes the note’s name."
            spellCheck
            className="notepad soft-scroll min-h-[360px] w-full flex-1 resize-none bg-transparent px-7 py-4 text-md text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-forest/30"
          />
        </section>
      </div>
    </>
  );
}

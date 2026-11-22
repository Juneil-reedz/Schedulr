"use client";
import { ImagePlus, Pencil, Pin, PinOff, Quote, RefreshCw, Trash2 } from "@/components/icons";
import { useMemo, useState } from "react";
import { FloralVine, PottedBloom } from "../botanicals";
import { Button, Field, Help, Input, Modal, Segmented, Textarea, cn } from "../ui";
import { api, pickImage } from "@/lib/api";
import { dayOfYear } from "@/lib/dates";
import { useFileSrc } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Note } from "@/lib/types";

/** Gentle lines of our own, used until the user saves quotes of theirs. */
const DAILY = [
  "One thing at a time, done with care.",
  "Leave a little room in the day for something unplanned.",
  "Small steps still move you forward.",
  "Finish one task before you start the next.",
  "Rest is part of the plan, not a break from it.",
  "Make today’s list shorter than you think it should be.",
  "Begin with the task you keep putting off.",
];

export function QuoteCard({ className }: { className?: string }) {
  const notes = useApp((s) => s.notes);
  const image = useApp((s) => s.settings.quoteImage);
  const setNotes = useApp((s) => s.setNotesDialog);
  const setSetting = useApp((s) => s.setSetting);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const src = useFileSrc(image);
  const quotes = useMemo(() => notes.filter((n) => n.kind === "quote"), [notes]);
  const [shift, setShift] = useState(0);
  const idx = dayOfYear() + shift;
  const own = quotes.length > 0 ? quotes[idx % quotes.length] : null;
  const body = own?.body ?? DAILY[idx % DAILY.length];
  const author = own?.author ?? "";

  async function changeArt() {
    try {
      const p = await pickImage();
      if (p) {
        await setSetting("quoteImage", p);
        toast("Quote card picture changed");
      }
    } catch (e) {
      fail(e);
    }
  }

  return (
    <section
      aria-label="Quote of the day"
      className={cn("clay shape-b clay-lift relative flex min-h-[190px] overflow-hidden", className)}
      style={{ ["--clay-fill" as string]: "var(--terracotta)" }}
    >
      <div className="z-[1] flex min-w-0 flex-1 flex-col px-6 pb-4 pt-5">
        <Quote className="h-7 w-7 -scale-x-100 fill-marigold text-marigold" aria-hidden />
          <Help title="Quote of the day" onDark className="absolute right-4 top-4 z-[2]">
            <p>A short message for the day. Add your own quotes and they take turns, one each day. “Another” shows the next one.</p>
            <p>Click the flowers to put your own picture there.</p>
          </Help>
        <blockquote className="mt-2 text-[clamp(17px,1.35vw,20px)] font-medium leading-snug text-on-dark">{body}</blockquote>
        {author && <p className="mt-2 text-sm text-on-dark/80">{author}</p>}
        {!own && <p className="mt-2 text-xs text-on-dark/70">Today’s message</p>}
        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          <Button tone="ghost" size="sm" className="text-on-dark hover:bg-on-dark/15" onClick={() => setShift(shift + 1)}>
            <RefreshCw size={15} /> Another
          </Button>
          <Button tone="ghost" size="sm" className="text-on-dark hover:bg-on-dark/15" onClick={() => setNotes(true)}>
            <Pencil size={15} /> Quotes and notes
          </Button>
        </div>
      </div>
      <button type="button" onClick={changeArt} aria-label="Change the illustration" className="press relative w-[34%] max-w-[170px] shrink-0 self-end">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="aspect-[4/5] w-full rounded-tl-[40px] object-cover" />
        ) : (
          <PottedBloom className="sway h-auto w-full pb-2 pr-2" />
        )}
        <span className="sr-only">
          <ImagePlus />
        </span>
      </button>
    </section>
  );
}

/** The painted marigold band that holds the pinned note. */
export function PinnedBand({ className }: { className?: string }) {
  const notes = useApp((s) => s.notes);
  const setNotes = useApp((s) => s.setNotesDialog);
  const pinned = notes.find((n) => n.pinned && n.kind === "note") ?? notes.find((n) => n.pinned);
  return (
    <section aria-label="Pinned note" className={cn("clay shape-pill clay-lift relative flex min-h-[84px] items-center overflow-hidden px-5 py-3", className)} style={{ ["--clay-fill" as string]: "var(--marigold)" }}>
      <FloralVine className="pointer-events-none absolute inset-0 h-full w-full opacity-95" />
      <button
        type="button"
        onClick={() => setNotes(true)}
        className="press relative z-[1] mx-auto flex max-w-[min(560px,92%)] items-center gap-2.5 rounded-full bg-cream/95 px-5 py-2.5 text-left shadow-raise"
      >
        <Pin size={16} className="shrink-0 text-terracotta" aria-hidden />
        <span className="min-w-0 truncate text-base font-medium text-ink">{pinned ? pinned.body.split("\n").map((l) => l.trim()).filter(Boolean).join(", ") : "Pin a note to keep it here"}</span>
      </button>
      <Help title="Pinned note" className="relative z-[1] ml-2 bg-cream">
        <p>Keeps one note in sight on the dashboard. Click the note to write, pin, edit or delete notes and quotes.</p>
      </Help>
    </section>
  );
}

const blank = (): Note => ({ id: "", kind: "note", body: "", author: "", pinned: false, createdAt: "", updatedAt: "" });

export function NotesDialog() {
  const open = useApp((s) => s.notesDialog);
  const setOpen = useApp((s) => s.setNotesDialog);
  const notes = useApp((s) => s.notes);
  const refresh = useApp((s) => s.refreshNotes);
  const fail = useApp((s) => s.fail);
  const [draft, setDraft] = useState<Note>(blank());

  async function save() {
    try {
      await api.saveNote(draft);
      setDraft(blank());
      await refresh();
    } catch (e) {
      fail(e);
    }
  }
  async function patch(n: Note, p: Partial<Note>) {
    try {
      await api.saveNote({ ...n, ...p });
      await refresh();
    } catch (e) {
      fail(e);
    }
  }
  async function remove(n: Note) {
    try {
      await api.deleteNote(n.id);
      if (draft.id === n.id) setDraft(blank());
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <Modal open={open} onOpenChange={setOpen} title="Quotes and notes" description="Quotes rotate on the dashboard each day. A pinned note sits on the floral band.">
      <form
        className="clay-sunk flex flex-col gap-3 rounded-[22px] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Segmented
          label="Kind"
          value={draft.kind}
          onChange={(kind) => setDraft({ ...draft, kind })}
          options={[
            { value: "note", label: "Note" },
            { value: "quote", label: "Quote" },
          ]}
        />
        <Field label={draft.kind === "quote" ? "Quote" : "Note"} htmlFor="note-body">
          <Textarea id="note-body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={draft.kind === "quote" ? "Words you want to see each morning" : "Something to remember"} />
        </Field>
        {draft.kind === "quote" && (
          <Field label="Who said it (optional)" htmlFor="note-author">
            <Input id="note-author" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" tone="primary" size="sm" disabled={!draft.body.trim()}>
            {draft.id ? "Save changes" : draft.kind === "quote" ? "Add quote" : "Add note"}
          </Button>
          <Button tone="ghost" size="sm" onClick={() => setDraft({ ...draft, pinned: !draft.pinned })} aria-pressed={draft.pinned}>
            {draft.pinned ? <PinOff size={15} /> : <Pin size={15} />} {draft.pinned ? "Will be pinned" : "Pin it"}
          </Button>
          {draft.id && (
            <Button tone="ghost" size="sm" onClick={() => setDraft(blank())}>
              Cancel edit
            </Button>
          )}
        </div>
      </form>
      <ul className="mt-4 divide-y divide-line">
        {notes.length === 0 && <li className="py-3 text-base text-muted">Nothing saved yet.</li>}
        {notes.map((n) => (
          <li key={n.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-base text-ink">{n.body}</p>
              <p className="mt-0.5 text-xs text-muted">
                {n.kind === "quote" ? (n.author ? `Quote, ${n.author}` : "Quote") : "Note"}
                {n.pinned && ", pinned"}
              </p>
            </div>
            <Button tone="ghost" size="iconSm" aria-label={n.pinned ? "Unpin" : "Pin"} onClick={() => patch(n, { pinned: !n.pinned })}>
              {n.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </Button>
            <Button tone="ghost" size="iconSm" aria-label="Edit" onClick={() => setDraft(n)}>
              <Pencil size={16} />
            </Button>
            <Button tone="danger" size="iconSm" aria-label="Delete" onClick={() => remove(n)}>
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

"use client";
import { isBefore, isSameDay, startOfDay } from "date-fns";
import { Check, Link2, Plus, Repeat, TriangleAlert } from "@/components/icons";
import { useState } from "react";
import { PageHeader } from "@/components/Shell";
import { PRIORITIES } from "@/components/TaskDialog";
import { Button, Input, Select, SectionTitle, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtTime, isDateOnly, parse, relDay } from "@/lib/dates";
import { useApp, useCategory, useVisible } from "@/lib/store";
import type { Task } from "@/lib/types";

const PRIORITY_COLOR = ["var(--sage-soft)", "var(--cream-deep)", "var(--marigold-soft)", "var(--terracotta-soft)"];

function TaskRow({ t }: { t: Task }) {
  const h24 = useApp((s) => s.settings.clock24h ?? false);
  const openTask = useApp((s) => s.openTask);
  const refreshTasks = useApp((s) => s.refreshTasks);
  const bump = useApp((s) => s.bump);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const cat = useCategory()(t.categoryId);
  const due = t.due ? parse(t.due) : null;
  const overdue = !t.done && due && (isDateOnly(t.due!) ? isBefore(due, startOfDay(new Date())) : due < new Date());
  async function toggle() {
    try {
      const after = await api.setTaskDone(t.id, !t.done);
      await refreshTasks();
      bump();
      toast(!t.done ? (after.done ? "Done" : "Done. The next one is scheduled") : "Marked as not done");
    } catch (e) {
      fail(e);
    }
  }
  return (
    <li className="flex items-center gap-3.5 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={t.done}
        aria-label={`${t.done ? "Mark not done" : "Complete"}: ${t.title}`}
        onClick={toggle}
        className={cn("press grid h-8 w-8 shrink-0 place-items-center rounded-full", t.done ? "bg-forest text-on-dark shadow-raise" : "bg-cream-deep shadow-sunk")}
      >
        {t.done && <Check size={17} strokeWidth={3} />}
      </button>
      <button type="button" onClick={() => openTask(t)} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-md text-ink", t.done && "text-muted line-through decoration-terracotta/50")}>{t.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
          {due && (
            <span className={cn(overdue && "font-semibold text-terracotta")}>
              {overdue && <TriangleAlert size={13} className="mr-1 inline -translate-y-px" aria-hidden />}
              {relDay(due)}
              {!isDateOnly(t.due!) && ` at ${fmtTime(due, h24)}`}
            </span>
          )}
          {cat && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
              {cat.name}
            </span>
          )}
          {t.recur.freq !== "none" && (
            <span className="inline-flex items-center gap-1">
              <Repeat size={12} aria-hidden /> Repeats {t.recur.freq}
            </span>
          )}
          {t.eventId && (
            <span className="inline-flex items-center gap-1">
              <Link2 size={12} aria-hidden /> Linked to an event
            </span>
          )}
        </p>
      </button>
      <span className="hidden rounded-full px-2.5 py-0.5 text-xs font-semibold text-ink sm:inline" style={{ background: PRIORITY_COLOR[t.priority] }}>
        {PRIORITIES[t.priority]}
      </span>
    </li>
  );
}

export default function TasksPage() {
  const tasks = useApp((s) => s.tasks);
  const refreshTasks = useApp((s) => s.refreshTasks);
  const bump = useApp((s) => s.bump);
  const openTask = useApp((s) => s.openTask);
  const fail = useApp((s) => s.fail);
  const visible = useVisible();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("1");
  const [showDone, setShowDone] = useState(false);

  const mine = tasks.filter((t) => visible(t.categoryId));
  const open = mine.filter((t) => !t.done);
  const today = new Date();
  const isOver = (t: Task) => !!t.due && (isDateOnly(t.due) ? isBefore(parse(t.due), startOfDay(today)) : parse(t.due) < today);
  const overdue = open.filter(isOver);
  const todays = open.filter((t) => !isOver(t) && t.due && isSameDay(parse(t.due), today));
  const later = open.filter((t) => !isOver(t) && t.due && !isSameDay(parse(t.due), today));
  const someday = open.filter((t) => !t.due);
  const done = mine.filter((t) => t.done);

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.saveTask({
        id: "", title, notes: "", categoryId: null, due: due || null, priority: Number(priority), done: false, doneAt: null, eventId: null,
        recur: { freq: "none", interval: 1, weekdays: [], until: null, count: null }, remindOffset: null, createdAt: "", updatedAt: "",
      });
      setTitle("");
      setDue("");
      await refreshTasks();
      bump();
    } catch (x) {
      fail(x);
    }
  }

  const group = (name: string, list: Task[], tone?: string) =>
    list.length > 0 && (
      <section className="clay shape-a px-6 py-5">
        <SectionTitle className={tone}>
          {name} <span className="num text-md text-muted">{list.length}</span>
        </SectionTitle>
        <ul className="mt-1 divide-y divide-line">
          {list.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </ul>
      </section>
    );

  return (
    <>
      <PageHeader title="Tasks" help={<><p>Your to-do list, grouped by when each task is due. Overdue tasks come first.</p><p>Tick the circle to complete a task. A repeating task moves on to its next date. Press T anywhere to add a task.</p></>}>
        <Button tone="primary" onClick={() => openTask()}>
          <Plus size={18} /> New task
        </Button>
      </PageHeader>
      <form onSubmit={quickAdd} className="clay shape-b mb-6 flex flex-wrap items-center gap-2 px-4 py-3">
        <label className="min-w-[220px] flex-1">
          <span className="sr-only">Task</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter" />
        </label>
        <label>
          <span className="sr-only">Due date</span>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-[170px]" />
        </label>
        <label>
          <span className="sr-only">Priority</span>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-[130px]">
            {PRIORITIES.map((p, i) => (
              <option key={p} value={i}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" tone="forest" disabled={!title.trim()}>
          Add
        </Button>
      </form>
      {open.length === 0 && (
        <div className="clay shape-b mb-6 px-7 py-6">
          <p className="text-lg font-semibold">Nothing to do</p>
          <p className="text-muted">Add a task above, or press T anywhere.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {group("Overdue", overdue, "text-terracotta")}
        {group("Today", todays)}
        {group("Coming up", later)}
        {group("No date", someday)}
      </div>
      {done.length > 0 && (
        <div className="mt-6">
          <Button tone="ghost" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {showDone ? "Hide" : "Show"} completed ({done.length})
          </Button>
          {showDone && <div className="mt-3">{group("Completed", done)}</div>}
        </div>
      )}
    </>
  );
}

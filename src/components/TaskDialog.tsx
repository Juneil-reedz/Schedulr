"use client";
import { Trash2 } from "@/components/icons";
import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, Segmented, Select, Textarea, Toggle } from "./ui";
import { api, confirmAsk, errorText } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { Freq, SchedEvent, Task } from "@/lib/types";

export const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

function blank(): Task {
  return {
    id: "", title: "", notes: "", categoryId: null, due: null, priority: 1, done: false, doneAt: null, eventId: null,
    recur: { freq: "none", interval: 1, weekdays: [], until: null, count: null }, remindOffset: null, createdAt: "", updatedAt: "",
  };
}

export function TaskDialog() {
  const { open, draft } = useApp((s) => s.taskDialog);
  const close = useApp((s) => s.closeTask);
  const categories = useApp((s) => s.categories);
  const refreshTasks = useApp((s) => s.refreshTasks);
  const bump = useApp((s) => s.bump);
  const toast = useApp((s) => s.toast);
  const [t, setT] = useState<Task>(blank);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<SchedEvent[]>([]);

  useEffect(() => {
    if (!open) return;
    setT({ ...blank(), ...(draft ?? {}) } as Task);
    setError(null);
    api.searchEvents("").then(setEvents).catch(() => setEvents([]));
  }, [open, draft]);

  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));
  const dueDate = t.due?.slice(0, 10) ?? "";
  const dueTime = t.due && t.due.length > 10 ? t.due.slice(11, 16) : "";

  async function save() {
    setError(null);
    try {
      await api.saveTask(t);
      await refreshTasks();
      bump();
      toast(t.id ? "Task saved" : "Task added");
      close();
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function remove() {
    if (!(await confirmAsk(`Delete the task “${t.title}”?`))) return;
    try {
      await api.deleteTask(t.id);
      await refreshTasks();
      bump();
      toast("Task deleted");
      close();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && close()}
      title={t.id ? "Edit task" : "New task"}
      footer={
        <>
          {t.id && (
            <Button tone="danger" size="sm" onClick={remove}>
              <Trash2 size={16} /> Delete
            </Button>
          )}
          <span className="flex-1" />
          <Button tone="ghost" onClick={close}>
            Cancel
          </Button>
          <Button tone="primary" onClick={save}>
            {t.id ? "Save" : "Add task"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Task" htmlFor="t-title">
          <Input id="t-title" autoFocus value={t.title} onChange={(e) => set({ title: e.target.value })} placeholder="What needs doing?" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Due date" htmlFor="t-date">
            <Input id="t-date" type="date" value={dueDate} onChange={(e) => set({ due: e.target.value ? (dueTime ? `${e.target.value}T${dueTime}` : e.target.value) : null })} />
          </Field>
          <Field label="Time (optional)" htmlFor="t-time">
            <Input id="t-time" type="time" disabled={!dueDate} value={dueTime} onChange={(e) => set({ due: e.target.value ? `${dueDate}T${e.target.value}` : dueDate })} />
          </Field>
          <Field label="Category" htmlFor="t-cat">
            <Select id="t-cat" value={t.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Remind me" htmlFor="t-rem">
            <Select id="t-rem" disabled={!dueDate} value={t.remindOffset ?? ""} onChange={(e) => set({ remindOffset: e.target.value === "" ? null : Number(e.target.value) })}>
              <option value="">Only when overdue</option>
              <option value="0">At the due time</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </Select>
          </Field>
          <Field label="Repeats" htmlFor="t-freq">
            <Select id="t-freq" value={t.recur.freq} onChange={(e) => set({ recur: { ...t.recur, freq: e.target.value as Freq } })}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <Field label="Linked event" htmlFor="t-ev">
            <Select id="t-ev" value={t.eventId ?? ""} onChange={(e) => set({ eventId: e.target.value || null })}>
              <option value="">None</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-muted">Priority</p>
          <Segmented label="Priority" value={String(t.priority)} onChange={(v) => set({ priority: Number(v) })} options={PRIORITIES.map((p, i) => ({ value: String(i), label: p }))} />
        </div>
        <Field label="Notes" htmlFor="t-notes">
          <Textarea id="t-notes" value={t.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {t.id && (
          <label className="flex cursor-pointer items-center gap-2.5 text-base">
            <Toggle label="Done" checked={t.done} onChange={(done) => set({ done })} /> Done
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-[14px] bg-[color-mix(in_oklab,var(--danger)_12%,var(--cream))] px-4 py-2.5 text-base font-semibold text-danger">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

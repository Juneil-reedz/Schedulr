"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CalendarDays, Flower2, ListChecks, NotebookPen, Settings, Ticket, Users } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { EventDialog } from "./EventDialog";
import { TaskDialog } from "./TaskDialog";
import { NotesDialog } from "./widgets/notes";
import { Bloom } from "./botanicals";
import { Help, cn } from "./ui";
import { ensureNotificationPermission } from "@/lib/api";
import { useApp } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: Flower2, fill: "var(--forest)", ink: "var(--cream)" },
  { href: "/calendar/", label: "Calendar", icon: CalendarDays, fill: "var(--cream)", ink: "var(--terracotta)" },
  { href: "/events/", label: "Events", icon: Ticket, fill: "var(--marigold)", ink: "var(--forest)" },
  { href: "/meetings/", label: "Meetings", icon: Users, fill: "var(--sage)", ink: "var(--cream)" },
  { href: "/reminders/", label: "Reminders", icon: Bell, fill: "var(--terracotta)", ink: "var(--cream)" },
  { href: "/tasks/", label: "Tasks", icon: ListChecks, fill: "var(--cream)", ink: "var(--forest)" },
  { href: "/notepad/", label: "Notepad", icon: NotebookPen, fill: "var(--rose-soft)", ink: "var(--terracotta-deep)" },
  { href: "/settings/", label: "Settings", icon: Settings, fill: "var(--sage-soft)", ink: "var(--forest)" },
];

function Dock() {
  const path = usePathname() || "/";
  const attention = useApp((s) => s.feed.filter((i) => ["fired", "missed", "silenced"].includes(i.status)).length);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3">
      <ul className="clay shape-pill flex items-end gap-0.5 px-2 pb-2 pt-2.5 min-[460px]:gap-1 sm:gap-2 sm:px-5" style={{ ["--clay-fill" as string]: "var(--cream)" }}>
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className="group flex w-[42px] flex-col items-center gap-1 rounded-[18px] min-[460px]:w-[50px] sm:w-[66px]"
              >
                <span
                  className={cn(
                    "clay shape-tile press relative grid h-10 w-10 place-items-center min-[460px]:h-11 min-[460px]:w-11 transition-transform duration-[260ms] ease-[var(--ease-out)] sm:h-[50px] sm:w-[50px]",
                    active ? "-translate-y-1.5" : "group-hover:-translate-y-1",
                  )}
                  style={{ ["--clay-fill" as string]: n.fill }}
                >
                  <n.icon size={22} strokeWidth={2.2} style={{ color: n.ink }} aria-hidden />
                  {n.href === "/reminders/" && attention > 0 && (
                    <span className="num absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-2xs font-bold text-on-dark">{attention}</span>
                  )}
                </span>
                <span className={cn("hidden text-2xs leading-none sm:block", active ? "font-bold text-terracotta" : "text-muted")}>{n.label}</span>
                <span aria-hidden className={cn("h-[3px] w-5 rounded-full bg-terracotta transition-opacity duration-200", active ? "opacity-100" : "opacity-0")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Toaster() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(380px,92vw)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn("clay shape-tile px-4 py-3 text-base font-semibold", t.tone === "error" ? "text-danger" : "text-forest")}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PageHeader({ title, help, children }: { title: string; help?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="display text-[clamp(34px,3.4vw,46px)] leading-none text-forest">{title}</h1>
        {help && <Help title={title}>{help}</Help>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const init = useApp((s) => s.init);
  const ready = useApp((s) => s.ready);
  const bootError = useApp((s) => s.bootError);
  const desktop = useApp((s) => s.desktop);
  const openEvent = useApp((s) => s.openEvent);
  const openTask = useApp((s) => s.openTask);

  useEffect(() => {
    init();
    ensureNotificationPermission().catch(() => {});
  }, [init]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (e.key === "n") {
        e.preventDefault();
        openEvent();
      } else if (e.key === "t") {
        e.preventDefault();
        openTask();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEvent, openTask]);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-cream focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="relative z-[1] mx-auto flex max-w-[1480px] items-center justify-between px-5 pt-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-xl">
          <svg viewBox="-14 -14 28 28" className="h-7 w-7" aria-hidden>
            <Bloom r={12} petals={6} />
          </svg>
          <span className="display text-3xl text-forest">Schedulr</span>
        </Link>
        {ready && !desktop && (
          <p className="rounded-full bg-cream-deep px-3.5 py-1.5 text-xs font-semibold text-muted shadow-sunk">Browser preview, nothing is saved</p>
        )}
      </header>
      <main id="main" className="relative z-[1] mx-auto max-w-[1480px] px-5 pb-40 pt-5 sm:px-8">
        {bootError ? (
          <div className="clay shape-a mx-auto max-w-[560px] p-8">
            <h1 className="display text-4xl text-forest">Schedulr could not start</h1>
            <p className="mt-2 text-muted">{bootError}</p>
          </div>
        ) : ready ? (
          children
        ) : (
          <p className="py-20 text-center text-muted">Opening your planner…</p>
        )}
      </main>
      <Dock />
      <Toaster />
      {ready && (
        <>
          <EventDialog />
          <TaskDialog />
          <NotesDialog />
        </>
      )}
    </>
  );
}

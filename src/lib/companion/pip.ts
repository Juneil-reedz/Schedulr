"use client";
/* Pip's state: what it is saying, how it feels, and a small queue so lines never overlap.
   Pip only talks; nothing here listens to the person. */
import { create } from "zustand";
import { useApp } from "@/lib/store";
import type { CompanionSettings } from "@/lib/types";
import { compose, MOOD, type Address, type Mood, type Topic, type Vars } from "./lines";
import { onFirstActivation, soundAllowed, speak } from "./voice";

export const PIP_DEFAULTS: CompanionSettings = { enabled: true, voice: true, voiceName: null, pitch: "normal", title: "monarch", character: "bunny", roam: true };

export function pipSettings(): CompanionSettings {
  return { ...PIP_DEFAULTS, ...(useApp.getState().settings.companion ?? {}) };
}

export interface Line {
  id: number;
  topic: Topic;
  text: string;
  mood: Mood;
  /** One raised eyebrow for the cheekier lines. */
  sass: boolean;
  at: number;
}

interface PipState {
  line: Line | null;
  base: Mood;
  speaking: boolean;
  /** Increments on each spoken word, so the mouth can follow the voice. */
  word: number;
  queue: Line[];
  lastSpokeAt: number;
  setBase: (m: Mood) => void;
  say: (topic: Topic, vars?: Vars, opts?: { urgent?: boolean }) => void;
  /** Says a sample line right away (Settings > Hear a sample). */
  sample: () => void;
  stop: () => void;
}

let ids = 0;
let cancelSpeech: (() => void) | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let offActivation: (() => void) | null = null;

function address(): Address {
  const s = pipSettings();
  const first = (useApp.getState().settings.profile?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const rulers = s.title === "queen" ? "queens" : s.title === "king" ? "kings" : "monarchs";
  return { honorific: "Your Majesty", name: first || "Your Majesty", rulers };
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/** Voice is off for this line when muted, in Do not disturb or Sleep, or the window is hidden. */
function voiceWanted() {
  const s = pipSettings();
  const focus = useApp.getState().settings.focus;
  return s.voice && !focus?.dnd && !focus?.sleep && typeof document !== "undefined" && document.visibilityState === "visible";
}

export const usePip = create<PipState>((set, get) => {
  const finish = (line: Line) => {
    if (get().line?.id !== line.id) return;
    set({ speaking: false, lastSpokeAt: Date.now() });
    // Keep the words up a little longer so they can be read, then move on.
    timers.push(
      setTimeout(() => {
        if (get().line?.id !== line.id) return;
        set({ line: null, speaking: false });
        timers.push(setTimeout(next, 700));
      }, 2600),
    );
  };

  const play = (line: Line) => {
    clearTimers();
    offActivation?.();
    offActivation = null;
    cancelSpeech?.();
    cancelSpeech = null;
    set({ line, speaking: false });

    let finished = false;
    let voiced = false;
    let silent = false;
    const done = () => {
      if (finished) return;
      finished = true;
      finish(line);
    };
    // Words only: the mouth moves for about as long as reading the line takes.
    const silently = () => {
      if (finished || silent) return;
      silent = true;
      set({ speaking: true });
      timers.push(setTimeout(done, Math.max(1600, line.text.length * 55)));
    };
    const start = () => {
      const s = pipSettings();
      cancelSpeech = speak(line.text, { voiceName: s.voiceName, pitch: s.pitch }, {
        onStart: () => {
          voiced = true;
          set({ speaking: true });
        },
        onWord: () => set((st) => ({ word: st.word + 1 })),
        onEnd: () => (voiced ? done() : silently()),
        onBlocked: silently,
      });
      // A voice that never starts (none installed, for example) falls back to words only.
      timers.push(
        setTimeout(() => {
          if (!voiced && !finished) {
            cancelSpeech?.();
            silently();
          }
        }, 1800),
      );
    };

    if (!voiceWanted()) return silently();
    if (soundAllowed()) return start();
    // No click or key press yet: show the words now, and speak them on the first one if still fresh.
    silently();
    offActivation = onFirstActivation(() => {
      if (get().line?.id === line.id && !finished && Date.now() - line.at < 120_000 && voiceWanted()) {
        clearTimers();
        silent = false;
        start();
      }
    });
  };

  const next = () => {
    const [head, ...rest] = get().queue;
    if (!head) return;
    set({ queue: rest });
    // Stale lines (a "starts in 15 minutes" from long ago) are dropped.
    if (Date.now() - head.at > 5 * 60_000) return next();
    play(head);
  };

  return {
    line: null,
    base: "idle",
    speaking: false,
    word: 0,
    queue: [],
    lastSpokeAt: 0,
    setBase: (base) => get().base !== base && set({ base }),
    say: (topic, vars = {}, { urgent = false } = {}) => {
      const text = compose(topic, address(), vars);
      const line: Line = { id: ++ids, topic, text, mood: MOOD[topic], sass: Math.random() < 0.45, at: Date.now() };
      const { line: cur, queue } = get();
      if (urgent) {
        set({ queue: [line, ...queue] });
        if (cur && !get().speaking) next();
        else if (!cur) next();
        return;
      }
      set({ queue: [...queue, line].slice(-5) });
      if (!cur) next();
    },
    sample: () => {
      cancelSpeech?.();
      set({ queue: [] });
      const line: Line = { id: ++ids, topic: "greetMorning", text: compose("greetMorning", address()), mood: "greeting", sass: true, at: Date.now() };
      play(line);
    },
    stop: () => {
      cancelSpeech?.();
      clearTimers();
      offActivation?.();
      set({ line: null, speaking: false, queue: [] });
    },
  };
});

// Browser preview only: lets the preview's tests show each of Pip's moods.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_PREVIEW === "1") {
  (window as unknown as { __pip: typeof usePip }).__pip = usePip;
}

/* Pip's voice: the speech voices installed on the computer (Windows has natural
   Microsoft voices). Browsers only allow sound after the person has clicked or typed
   on the page once, so until then Pip shows the words without speaking and says the
   latest line on that first click or key press. */

export type Pitch = "low" | "normal" | "high" | "child";
/** Pitch and pace for each voice style. "child" is high and a little quick, like a small kid. */
const STYLE: Record<Pitch, { pitch: number; rate: number }> = {
  low: { pitch: 0.85, rate: 1 },
  normal: { pitch: 1.08, rate: 1.02 },
  high: { pitch: 1.3, rate: 1.04 },
  child: { pitch: 1.75, rate: 1.1 },
};

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function listVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return window.speechSynthesis.getVoices();
}

/** Calls back whenever the voice list loads or changes. */
export function onVoicesChanged(cb: () => void) {
  if (!canSpeak()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

/** The chosen voice, or the friendliest English voice available (a child's voice first for the child style). */
export function pickVoice(name: string | null | undefined, child = false): SpeechSynthesisVoice | null {
  const all = listVoices();
  if (!all.length) return null;
  if (name) {
    const v = all.find((x) => x.name === name);
    if (v) return v;
  }
  const en = all.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : all;
  // Windows has a young girl's voice, "Microsoft Ana", on some computers.
  const kid = child ? pool.find((v) => /\bana\b|child|kid/i.test(v.name)) : undefined;
  return (
    kid ||
    pool.find((v) => /natural/i.test(v.name) && /aria|jenny|ava|emma|sonia|libby|natasha/i.test(v.name)) ||
    pool.find((v) => /natural/i.test(v.name)) ||
    pool.find((v) => /aria|jenny|zira|samantha|hazel|susan|libby/i.test(v.name)) ||
    pool.find((v) => v.default) ||
    pool[0]
  );
}

/** Whether the page may play sound yet (the person has clicked or typed once). */
export function soundAllowed() {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

/** Runs once, on the person's first click or key press. */
export function onFirstActivation(cb: () => void) {
  if (soundAllowed()) return () => {};
  const go = () => {
    off();
    cb();
  };
  const off = () => {
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
  return off;
}

/** Holds the line being spoken; Chrome can otherwise lose it before it ends. */
let current: SpeechSynthesisUtterance | null = null;
export const speakingNow = () => current;

export interface SpeakHandlers {
  onStart?: () => void;
  onWord?: () => void;
  onEnd?: () => void;
  /** The browser refused to play sound. */
  onBlocked?: () => void;
}

/** Speaks one line. Returns a function that stops it. */
export function speak(text: string, opts: { voiceName?: string | null; pitch?: Pitch }, h: SpeakHandlers = {}) {
  if (!canSpeak()) {
    h.onBlocked?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  // Chrome can drop a line spoken straight after cancel(), so pause briefly when something was playing.
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  current = u;
  const style = STYLE[opts.pitch ?? "child"];
  const v = pickVoice(opts.voiceName, opts.pitch === "child");
  try {
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
  } catch {
    /* an odd voice entry: the default voice is fine */
  }
  u.pitch = style.pitch;
  u.rate = style.rate;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    h.onEnd?.();
  };
  u.onstart = () => h.onStart?.();
  u.onboundary = (e) => {
    if (e.name === "word" || e.name === undefined) h.onWord?.();
  };
  u.onend = end;
  u.onerror = (e) => {
    if (e.error === "not-allowed") h.onBlocked?.();
    end();
  };
  const go = () => {
    if (synth.paused) synth.resume();
    synth.speak(u);
  };
  const delay = busy ? setTimeout(go, 80) : (go(), undefined);
  // Some voices never report the end; give up after a generous estimate.
  const guard = setTimeout(end, 2500 + text.length * 110);
  return () => {
    clearTimeout(guard);
    if (delay) clearTimeout(delay);
    ended = true;
    synth.cancel();
  };
}

/* Pip's voice: the speech voices installed on the computer (Windows has natural
   Microsoft voices). Browsers only allow sound after the person has clicked or typed
   on the page once, so until then Pip shows the words without speaking and says the
   latest line on that first click or key press. */

/** A voice style: which kind of computer voice to look for, and its pitch and pace. */
export type Pitch = "child" | "boy" | "chipmunk" | "high" | "normal" | "low" | "butler" | "grandma" | "giant" | "sleepy";
type Kind = "child" | "female" | "male" | "male-gb";

export const VOICE_STYLES: { id: Pitch; name: string; note: string; kind: Kind; pitch: number; rate: number }[] = [
  { id: "child", name: "Little girl", note: "High and bubbly", kind: "child", pitch: 1.75, rate: 1.1 },
  { id: "boy", name: "Little boy", note: "Young and eager", kind: "male", pitch: 1.7, rate: 1.12 },
  { id: "chipmunk", name: "Chipmunk", note: "Tiny and speedy", kind: "female", pitch: 2, rate: 1.35 },
  { id: "high", name: "Cheerful", note: "Bright and upbeat", kind: "female", pitch: 1.3, rate: 1.05 },
  { id: "normal", name: "Friendly", note: "Warm and natural", kind: "female", pitch: 1.05, rate: 1 },
  { id: "low", name: "Gentleman", note: "Calm and steady", kind: "male", pitch: 0.92, rate: 0.97 },
  { id: "butler", name: "Royal butler", note: "Posh and proper", kind: "male-gb", pitch: 0.8, rate: 0.9 },
  { id: "grandma", name: "Grandma", note: "Slow and sweet", kind: "female", pitch: 0.82, rate: 0.82 },
  { id: "giant", name: "Gentle giant", note: "Deep and booming", kind: "male", pitch: 0.3, rate: 0.85 },
  { id: "sleepy", name: "Sleepy", note: "Yawning through it", kind: "female", pitch: 0.95, rate: 0.72 },
];
const STYLE = Object.fromEntries(VOICE_STYLES.map((s) => [s.id, s])) as Record<Pitch, (typeof VOICE_STYLES)[number]>;
export const styleOf = (id: string | null | undefined) => STYLE[id as Pitch] ?? STYLE.child;

// Windows voice names, to tell men's and women's voices apart.
const FEMALE = /aria|jenny|ava|emma|sonia|libby|natasha|zira|samantha|hazel|susan|michelle|clara|catherine|heera|linda|eva|ana\b/i;
const MALE = /david|mark|guy|george|ryan|christopher|eric|roger|steffan|liam|william|james|brian|andrew|thomas|richard|sean|daniel/i;

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

/** The chosen voice, or the best English voice of the kind the style asks for. */
export function pickVoice(name: string | null | undefined, style?: Pitch | string): SpeechSynthesisVoice | null {
  const kind = styleOf(style).kind;
  const all = listVoices();
  if (!all.length) return null;
  if (name) {
    const v = all.find((x) => x.name === name);
    if (v) return v;
  }
  const en = all.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : all;
  const natural = (v: SpeechSynthesisVoice) => /natural/i.test(v.name);
  // Windows has a young girl's voice, "Microsoft Ana", on some computers.
  const kid = kind === "child" ? pool.find((v) => /\bana\b|child|kid/i.test(v.name)) : undefined;
  const men = pool.filter((v) => MALE.test(v.name) && !FEMALE.test(v.name));
  const british = men.filter((v) => /en-GB/i.test(v.lang));
  const man =
    kind === "male-gb"
      ? british.find(natural) || british[0] || men.find(natural) || men[0]
      : kind === "male"
        ? men.find(natural) || men[0]
        : undefined;
  return (
    kid ||
    man ||
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
  const style = styleOf(opts.pitch);
  const v = pickVoice(opts.voiceName, opts.pitch);
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

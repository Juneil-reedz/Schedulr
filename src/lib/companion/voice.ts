/* Pip's voice: the speech voices installed on the computer (Windows has natural
   Microsoft voices). Browsers only allow sound after the person has clicked or typed
   on the page once, so until then Pip shows the words without speaking and says the
   latest line on that first click or key press. */

/** A voice style: which kind of computer voice to look for, and its pitch and pace. */
export type Pitch = "child" | "boy" | "chipmunk" | "high" | "normal" | "low" | "butler" | "grandma" | "giant" | "sleepy";
type Kind = "child" | "female" | "male" | "male-gb";

/* Each style has three parts:
   - pitch and rate: for the browser's speech (the fallback, and the browser preview),
   - win: pitch and pace for Windows' speech engine, which renders the audio in the app,
   - fx: how the app reshapes that audio. `speed` plays it faster or slower, which also moves
     the voice up or down like a smaller or bigger person; the Windows pace is set to make
     up for it. `warble` is a gentle tremble, `room` a little echo, `muffle` a softer tone. */
export const VOICE_STYLES: {
  id: Pitch;
  name: string;
  note: string;
  kind: Kind;
  pitch: number;
  rate: number;
  win: { pitch: number; rate: number };
  fx: { speed: number; warble?: number; room?: number; muffle?: boolean };
}[] = [
  { id: "child", name: "Little girl", note: "High and bubbly", kind: "child", pitch: 1.75, rate: 1.1, win: { pitch: 1.35, rate: 0.92 }, fx: { speed: 1.2 } },
  { id: "boy", name: "Little boy", note: "Young and eager", kind: "male", pitch: 1.7, rate: 1.12, win: { pitch: 1.45, rate: 0.88 }, fx: { speed: 1.3 } },
  { id: "chipmunk", name: "Chipmunk", note: "Tiny and speedy", kind: "female", pitch: 2, rate: 1.35, win: { pitch: 1.25, rate: 1.3 }, fx: { speed: 1.75 } },
  { id: "high", name: "Cheerful", note: "Bright and upbeat", kind: "female", pitch: 1.3, rate: 1.05, win: { pitch: 1.3, rate: 1.08 }, fx: { speed: 1.04 } },
  { id: "normal", name: "Friendly", note: "Warm and natural", kind: "female", pitch: 1.05, rate: 1, win: { pitch: 1, rate: 1 }, fx: { speed: 1 } },
  { id: "low", name: "Gentleman", note: "Calm and steady", kind: "male", pitch: 0.92, rate: 0.97, win: { pitch: 0.92, rate: 0.95 }, fx: { speed: 0.98 } },
  { id: "butler", name: "Royal butler", note: "Posh and proper", kind: "male-gb", pitch: 0.8, rate: 0.9, win: { pitch: 0.85, rate: 0.88 }, fx: { speed: 0.96, room: 0.22 } },
  { id: "grandma", name: "Grandma", note: "Slow and sweet", kind: "female", pitch: 0.82, rate: 0.82, win: { pitch: 0.8, rate: 0.86 }, fx: { speed: 0.93, warble: 0.28 } },
  { id: "giant", name: "Gentle giant", note: "Deep and booming", kind: "male", pitch: 0.3, rate: 0.85, win: { pitch: 0.6, rate: 1.25 }, fx: { speed: 0.72, room: 0.35 } },
  { id: "sleepy", name: "Sleepy", note: "Yawning through it", kind: "female", pitch: 0.95, rate: 0.72, win: { pitch: 0.85, rate: 0.8 }, fx: { speed: 0.9, muffle: true } },
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

/* ---------- the Windows voice, in the desktop app ---------- */

export interface NativeVoice {
  id: string;
  name: string;
  lang: string;
  female: boolean;
}

let nativeList: Promise<NativeVoice[] | null> | null = null;

/** Windows' voices, or null outside the desktop app (or if Windows will not list them). */
export function nativeVoices(): Promise<NativeVoice[] | null> {
  if (!nativeList) {
    nativeList = (async () => {
      if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const list = await invoke<NativeVoice[]>("tts_voices");
        return list.length ? list : null;
      } catch {
        return null;
      }
    })();
  }
  return nativeList;
}

const shortName = (n: string) => n.replace(/^Microsoft\s+/, "").replace(/\s+-\s+.*$/, "");

/** The Windows voice for a style (or the one chosen in Settings), and whether a man's voice was missing. */
export function pickNative(list: NativeVoice[], style: Pitch | string, chosen?: string | null) {
  const exact = chosen ? list.find((v) => v.id === chosen || v.name === chosen) : undefined;
  if (exact) return { voice: exact, noMan: false };
  const kind = styleOf(style).kind;
  const en = list.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : list;
  const women = pool.filter((v) => v.female);
  const men = pool.filter((v) => !v.female);
  if (kind === "child") {
    const kid = pool.find((v) => /\bana\b/i.test(v.name));
    return { voice: kid ?? women[0] ?? pool[0], noMan: false };
  }
  if (kind === "male" || kind === "male-gb") {
    const gb = men.filter((v) => /en-GB/i.test(v.lang));
    const man = (kind === "male-gb" ? gb[0] : undefined) ?? men.find((v) => /en-US/i.test(v.lang)) ?? men[0];
    return { voice: man ?? women[0] ?? pool[0], noMan: !man };
  }
  return { voice: women.find((v) => /en-US/i.test(v.lang)) ?? women[0] ?? pool[0], noMan: false };
}
export const nativeLabel = (v: NativeVoice) => `${shortName(v.name)} (${v.lang})`;

let ctx: AudioContext | null = null;
let roomImpulse: AudioBuffer | null = null;
function audio() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}
/** A short, soft echo, made once. */
function impulse(c: AudioContext) {
  if (roomImpulse) return roomImpulse;
  const len = Math.floor(c.sampleRate * 1.1);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  roomImpulse = buf;
  return buf;
}

/** Renders the line with Windows' voice and plays it with the style's effects.
    Resolves to a stop function, or null when it cannot (then the browser's speech is used). */
async function speakNative(text: string, opts: { voiceName?: string | null; pitch?: Pitch }, h: SpeakHandlers): Promise<(() => void) | null> {
  const list = await nativeVoices();
  if (!list) return null;
  const style = styleOf(opts.pitch);
  const { voice, noMan } = pickNative(list, opts.pitch ?? "child", opts.voiceName);
  // Without a man's voice installed, a woman's voice played slower stands in for one.
  const speed = style.fx.speed * (noMan ? 0.84 : 1);
  let wav: ArrayBuffer;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    wav = await invoke<ArrayBuffer>("tts_render", { text, voiceId: voice.id, pitch: style.win.pitch, rate: style.win.rate / speed });
  } catch {
    return null;
  }
  const c = audio();
  if (c.state === "suspended") await c.resume().catch(() => {});
  if (c.state !== "running") {
    h.onBlocked?.();
    return () => {};
  }
  const buffer = await c.decodeAudioData(wav.slice(0));
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = speed;

  let node: AudioNode = src;
  const extra: AudioScheduledSourceNode[] = [];
  if (style.fx.warble) {
    const g = c.createGain();
    g.gain.value = 1 - style.fx.warble / 2;
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = c.createGain();
    depth.gain.value = style.fx.warble / 2;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    extra.push(lfo);
    node.connect(g);
    node = g;
  }
  if (style.fx.muffle) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1900;
    node.connect(f);
    node = f;
  }
  const analyser = c.createAnalyser();
  analyser.fftSize = 512;
  node.connect(analyser);
  analyser.connect(c.destination);
  if (style.fx.room) {
    const conv = c.createConvolver();
    conv.buffer = impulse(c);
    const wet = c.createGain();
    wet.gain.value = style.fx.room;
    node.connect(conv).connect(wet).connect(c.destination);
  }

  // The mouth follows the loudness: each new burst of sound opens it again.
  const data = new Float32Array(analyser.fftSize);
  let raf = 0;
  let loud = false;
  const watch = () => {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    const rms = Math.sqrt(sum / data.length);
    if (!loud && rms > 0.05) {
      loud = true;
      h.onWord?.();
    } else if (loud && rms < 0.02) loud = false;
    raf = requestAnimationFrame(watch);
  };

  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    extra.forEach((x) => x.stop());
    h.onEnd?.();
  };
  src.onended = end;
  src.start();
  h.onStart?.();
  raf = requestAnimationFrame(watch);
  return () => {
    done = true;
    cancelAnimationFrame(raf);
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    extra.forEach((x) => x.stop());
  };
}

/** Speaks one line: Windows' voice with effects in the desktop app, the browser's voice otherwise.
    Returns a function that stops it. */
export function speak(text: string, opts: { voiceName?: string | null; pitch?: Pitch }, h: SpeakHandlers = {}) {
  let stop: (() => void) | null = null;
  let cancelled = false;
  speakNative(text, opts, h).then((s) => {
    if (cancelled) {
      s?.();
      return;
    }
    stop = s ?? speakBrowser(text, opts, h);
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

/** The browser's own speech: pitch and pace only. */
function speakBrowser(text: string, opts: { voiceName?: string | null; pitch?: Pitch }, h: SpeakHandlers = {}) {
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

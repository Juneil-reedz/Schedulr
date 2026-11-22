"use client";
/* Pip, the royal herald: a marigold with a crown who reads out the schedule.
   Pip talks; it never listens. The character takes no clicks (they pass straight through
   to the page), fades when the pointer comes near, and has only a small mute button. */
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "@/components/icons";
import { Button, Field, Segmented, Select, Toggle, cn } from "./ui";
import { useApp } from "@/lib/store";
import { useCompanionEngine } from "@/lib/companion/engine";
import type { Mood } from "@/lib/companion/lines";
import { PIP_DEFAULTS, usePip } from "@/lib/companion/pip";
import { listVoices, onVoicesChanged, pickVoice } from "@/lib/companion/voice";

const INK = "#2b211b";
const LEAF = "#5f8f57";
const STEM = "#3d6a52";
const GOLD = "#f4c445";
const GOLD_EDGE = "#b7791f";

/** Random blinks, every few seconds. */
function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setClosed(true);
        setTimeout(() => setClosed(false), 140);
        loop();
      }, 2400 + Math.random() * 3600);
    };
    loop();
    return () => clearTimeout(t);
  }, [enabled]);
  return closed;
}

function Eye({ x, mood, blink }: { x: number; mood: Mood; blink: boolean }) {
  if (mood === "happy")
    return <path d={`M${x - 6} 82 Q${x} 73 ${x + 6} 82`} fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />;
  if (mood === "sleepy")
    return <path d={`M${x - 6} 79 Q${x} 85 ${x + 6} 79`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
  const big = mood === "surprised";
  return (
    <motion.g animate={{ scaleY: blink ? 0.1 : 1 }} transition={{ duration: 0.07 }} style={{ originX: `${x}px`, originY: "80px" }}>
      <ellipse cx={x} cy={80} rx={big ? 6.6 : 5.3} ry={big ? 8.6 : 7.2} fill={INK} />
      <circle cx={x + 1.8} cy={77} r={big ? 2.3 : 1.9} fill="#fff" />
      <circle cx={x - 1.6} cy={83} r={0.9} fill="#fff" opacity={0.7} />
    </motion.g>
  );
}

function Brows({ mood, sass }: { mood: Mood; sass: boolean }) {
  if (mood === "sleepy") return null;
  const lift = mood === "surprised" ? -6 : mood === "happy" ? -3 : 0;
  return (
    <g stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none">
      <motion.path d="M59 68 Q66 64 73 67" animate={{ y: lift }} />
      <motion.path
        d="M87 67 Q94 64 101 68"
        animate={{ y: lift + (sass && mood !== "surprised" ? -4 : 0), rotate: sass && mood !== "surprised" ? -9 : 0 }}
        style={{ originX: "94px", originY: "66px" }}
      />
    </g>
  );
}

function Mouth({ mood, speaking, word, still }: { mood: Mood; speaking: boolean; word: number; still: boolean }) {
  if (speaking) {
    return (
      <motion.g
        key={word}
        initial={{ scaleY: 0.3 }}
        animate={still ? { scaleY: 0.7 } : { scaleY: [0.3, 1, 0.5, 0.9, 0.35, 0.8, 0.4] }}
        transition={{ duration: 0.62, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "80px", originY: "101px" }}
      >
        <ellipse cx={80} cy={101} rx={8.5} ry={6.5} fill="#5b2620" />
        <ellipse cx={80} cy={105} rx={5} ry={2.6} fill="#e98a86" />
      </motion.g>
    );
  }
  if (mood === "happy" || mood === "greeting")
    return (
      <g>
        <path d="M68 97 Q80 113 92 97 Z" fill="#5b2620" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M74 104 Q80 109 86 104 Q80 101 74 104 Z" fill="#e98a86" />
      </g>
    );
  if (mood === "surprised") return <ellipse cx={80} cy={101} rx={5} ry={6.5} fill="#5b2620" stroke={INK} strokeWidth={1.4} />;
  if (mood === "sleepy") return <path d="M74 101 Q80 104 86 101" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />;
  return <path d="M71 98 Q80 106 89 98" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
}

const PETALS = Array.from({ length: 12 }, (_, i) => i * 30);

function Pip({ mood, speaking, word, sass, cue }: { mood: Mood; speaking: boolean; word: number; sass: boolean; cue: number }) {
  const reduce = !!useReducedMotion();
  const blink = useBlink(mood !== "sleepy" && mood !== "happy");

  // Whole-body motion for each state. `cue` restarts one-off gestures for each new line.
  const body: Record<Mood, TargetAndTransition> = {
    idle: { y: [0, -6, 0], transition: { duration: 3.8, repeat: Infinity, ease: "easeInOut" } },
    talking: { y: [0, -4, 0], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } },
    greeting: { y: [0, 4, -6, 0], transition: { duration: 1.4, ease: "easeInOut" } },
    happy: { y: [0, -18, 0, -11, 0], transition: { duration: 0.95, ease: "easeOut" } },
    surprised: { y: [0, -12, 0], scale: [1, 1.06, 1], transition: { duration: 0.45, ease: "easeOut" } },
    sleepy: { y: [0, -2, 0], transition: { duration: 5, repeat: Infinity, ease: "easeInOut" } },
  };
  const head: Record<Mood, TargetAndTransition> = {
    idle: { rotate: 0, scale: [1, 1.015, 1], transition: { duration: 3.8, repeat: Infinity, ease: "easeInOut" } },
    talking: { rotate: [0, -2, 1.5, 0], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } },
    // A small royal bow.
    greeting: { rotate: [0, -10, 0], y: [0, 5, 0], transition: { duration: 1.2, ease: "easeInOut" } },
    happy: { rotate: [0, -6, 6, 0], transition: { duration: 0.9 } },
    surprised: { rotate: 0, transition: { duration: 0.2 } },
    sleepy: { rotate: 9, scale: [1, 1.025, 1], transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } },
  };
  const wave: TargetAndTransition =
    mood === "greeting"
      ? { rotate: [0, -38, 4, -38, 4, 0], transition: { duration: 1.6, ease: "easeInOut" } }
      : mood === "happy"
        ? { rotate: [0, -30, 0], transition: { duration: 0.9 } }
        : mood === "sleepy"
          ? { rotate: 14, transition: { duration: 1.2 } }
          : { rotate: 0 };
  const leftArm: TargetAndTransition =
    mood === "happy" ? { rotate: [0, 30, 0], transition: { duration: 0.9 } } : mood === "sleepy" ? { rotate: -12 } : { rotate: 0 };

  return (
    <motion.svg
      viewBox="0 0 160 190"
      className="block h-full w-full overflow-visible"
      aria-hidden
      key={`b${cue}`}
      animate={reduce ? {} : body[mood]}
    >
      {/* ground shadow */}
      <ellipse cx={80} cy={182} rx={30} ry={5} fill="rgb(40 30 20 / .16)" />

      {/* stem and leaf arms */}
      <path d="M80 122 Q78 150 80 176" fill="none" stroke={STEM} strokeWidth={5} strokeLinecap="round" />
      <motion.path
        d="M79 146 C70 132 50 130 42 140 C52 152 70 154 79 146 Z"
        fill={LEAF}
        stroke={STEM}
        strokeWidth={1.6}
        animate={reduce ? {} : leftArm}
        style={{ originX: "79px", originY: "146px" }}
      />
      <motion.path
        d="M81 142 C90 128 110 126 118 136 C108 148 90 150 81 142 Z"
        fill={LEAF}
        stroke={STEM}
        strokeWidth={1.6}
        animate={reduce ? {} : wave}
        style={{ originX: "81px", originY: "142px" }}
      />

      <motion.g animate={reduce ? {} : head[mood]} style={{ originX: "80px", originY: "120px" }}>
        {/* petals: a back ring and a front ring */}
        <motion.g animate={{ scale: mood === "surprised" ? 1.07 : 1 }} style={{ originX: "80px", originY: "84px" }}>
          {PETALS.map((a) => (
            <ellipse
              key={`b${a}`}
              cx={80}
              cy={41}
              rx={12}
              ry={21}
              transform={`rotate(${a + 15} 80 84)`}
              style={{ fill: "var(--terracotta-soft)", stroke: "color-mix(in oklab, var(--terracotta-soft) 70%, black)", strokeWidth: 1.2 }}
            />
          ))}
          {PETALS.map((a) => (
            <ellipse
              key={`f${a}`}
              cx={80}
              cy={43}
              rx={12.5}
              ry={20}
              transform={`rotate(${a} 80 84)`}
              style={{ fill: "var(--marigold)", stroke: "color-mix(in oklab, var(--marigold) 68%, black)", strokeWidth: 1.2 }}
            />
          ))}
        </motion.g>

        {/* face */}
        <circle cx={80} cy={84} r={39} style={{ fill: "var(--cream)", stroke: "color-mix(in oklab, var(--marigold) 55%, black)", strokeWidth: 1.6 }} />
        <ellipse cx={66} cy={64} rx={16} ry={9} fill="#fff" opacity={0.45} transform="rotate(-24 66 64)" />
        <ellipse cx={59} cy={94} rx={7} ry={4.4} style={{ fill: "var(--rose-soft)" }} opacity={mood === "happy" ? 1 : 0.75} />
        <ellipse cx={101} cy={94} rx={7} ry={4.4} style={{ fill: "var(--rose-soft)" }} opacity={mood === "happy" ? 1 : 0.75} />
        <Brows mood={mood} sass={sass && speaking} />
        <Eye x={66} mood={mood} blink={blink} />
        <Eye x={94} mood={mood} blink={blink} />
        <Mouth mood={mood} speaking={speaking} word={word} still={reduce} />

        {/* crown */}
        <motion.g
          animate={reduce ? {} : mood === "happy" ? { y: [0, -9, 0], rotate: [-8, -16, -8] } : mood === "sleepy" ? { rotate: -18, x: -4 } : { rotate: -8 }}
          transition={{ duration: mood === "happy" ? 0.9 : 0.6 }}
          style={{ originX: "80px", originY: "46px" }}
        >
          <path d="M57 50 L54 26 L68 38 L80 20 L92 38 L106 26 L103 50 Z" fill={GOLD} stroke={GOLD_EDGE} strokeWidth={2.2} strokeLinejoin="round" />
          <rect x={57} y={44} width={46} height={7} rx={2} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={2} />
          <circle cx={54} cy={26} r={3.4} style={{ fill: "var(--rose)" }} stroke={GOLD_EDGE} strokeWidth={1.2} />
          <circle cx={80} cy={20} r={3.8} fill="#6fb3e0" stroke={GOLD_EDGE} strokeWidth={1.2} />
          <circle cx={106} cy={26} r={3.4} style={{ fill: "var(--rose)" }} stroke={GOLD_EDGE} strokeWidth={1.2} />
          <circle cx={80} cy={47.5} r={3} fill="#c0392b" />
          <path d="M62 42 L64 32" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        </motion.g>
      </motion.g>

      {/* state extras */}
      <AnimatePresence>
        {mood === "happy" &&
          [
            [22, 52],
            [136, 46],
            [30, 112],
            [132, 104],
            [80, 6],
          ].map(([x, y], i) => (
            <motion.path
              key={`s${i}${cue}`}
              d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`}
              fill={i % 2 ? GOLD : "var(--rose)"}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0], rotate: 40 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, delay: i * 0.08 }}
              style={{ originX: `${x}px`, originY: `${y}px` }}
            />
          ))}
        {mood === "surprised" && (
          <motion.g key={`x${cue}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} style={{ originX: "136px", originY: "34px" }}>
            <path d="M134 14 L140 14 L138 38 L136 38 Z" fill="#c0392b" stroke="#7a1f16" strokeWidth={1.2} strokeLinejoin="round" />
            <circle cx={137} cy={45} r={3.4} fill="#c0392b" stroke="#7a1f16" strokeWidth={1.2} />
          </motion.g>
        )}
        {mood === "sleepy" &&
          !reduce &&
          [0, 1, 2].map((i) => (
            <motion.text
              key={`z${i}`}
              x={118 + i * 9}
              y={44 - i * 10}
              fontSize={12 + i * 3}
              fontWeight={700}
              fill={STEM}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: [0, 1, 0], y: [6, -8, -18] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.9 }}
            >
              z
            </motion.text>
          ))}
      </AnimatePresence>
    </motion.svg>
  );
}

/** Pip in the corner of every page, with a speech bubble while it talks. */
export function Companion() {
  const ready = useApp((s) => s.ready);
  const settings = useApp((s) => s.settings.companion);
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const s = { ...PIP_DEFAULTS, ...settings };
  const active = ready && s.enabled;
  useCompanionEngine(active);

  const line = usePip((p) => p.line);
  const base = usePip((p) => p.base);
  const speaking = usePip((p) => p.speaking);
  const word = usePip((p) => p.word);
  const stop = usePip((p) => p.stop);
  const reduce = useReducedMotion();

  // Fade out of the way when the pointer comes near, so Pip never hides anything.
  const root = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = root.current?.getBoundingClientRect();
        if (!r) return;
        const pad = 28;
        setNear(e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  useEffect(() => {
    if (!s.enabled) stop();
  }, [s.enabled, stop]);

  if (!active) return null;
  const mood: Mood = line ? (speaking && line.mood === "sleepy" ? "talking" : line.mood) : base;
  const toggleVoice = () => {
    if (s.voice) stop();
    setSetting("companion", { ...s, voice: !s.voice }).catch(fail);
  };

  return (
    <div
      ref={root}
      className={cn(
        "pip pointer-events-none fixed bottom-[88px] right-4 z-[25] h-[104px] w-[90px] min-[600px]:bottom-3 min-[600px]:right-7 min-[600px]:h-[150px] min-[600px]:w-[130px] min-[1100px]:h-[176px] min-[1100px]:w-[152px]",
      )}
    >
      <div className={cn("h-full w-full transition-opacity duration-300", near ? "opacity-20" : "opacity-100")}>
      <AnimatePresence>
        {line && (
          <motion.div
            key={line.id}
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="pip-bubble clay shape-tile absolute bottom-[78%] right-[62%] w-max max-w-[min(300px,calc(100vw-120px))] px-4 py-3 text-sm leading-snug text-ink min-[600px]:text-base"
            style={{ originX: 1, originY: 1 }}
          >
            <span className="mb-0.5 block text-2xs font-bold uppercase tracking-[0.08em] text-terracotta">Pip, royal herald</span>
            {line.text}
          </motion.div>
        )}
      </AnimatePresence>
      <Pip mood={mood} speaking={speaking} word={word} sass={line?.sass ?? false} cue={line?.id ?? 0} />
      </div>
      <button
        type="button"
        onClick={toggleVoice}
        aria-label={s.voice ? "Mute Pip" : "Unmute Pip"}
        title={s.voice ? "Mute Pip" : "Unmute Pip"}
        className={cn(
          "btn-solid press pointer-events-auto absolute -left-1 bottom-1 grid h-8 w-8 place-items-center rounded-full bg-cream text-ink shadow-raise transition-opacity",
          near ? "opacity-100" : "opacity-60 hover:opacity-100",
        )}
      >
        {s.voice ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
    </div>
  );
}

/** Settings > Companion. */
export function CompanionSettingsPanel() {
  const settings = useApp((st) => st.settings.companion);
  const name = useApp((st) => st.settings.profile?.name ?? "");
  const setSetting = useApp((st) => st.setSetting);
  const fail = useApp((st) => st.fail);
  const sample = usePip((p) => p.sample);
  const s = { ...PIP_DEFAULTS, ...settings };
  const save = (patch: Partial<typeof s>) => setSetting("companion", { ...s, ...patch }).catch(fail);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(listVoices());
    load();
    return onVoicesChanged(load);
  }, []);
  const english = voices.filter((v) => /^en/i.test(v.lang));
  const others = voices.filter((v) => !/^en/i.test(v.lang));
  const auto = pickVoice(null);

  return (
    <div className="flex flex-col gap-1">
      <SettingRow title="Show Pip" hint="A royal herald in the corner who greets you and reads out your day. Pip only talks; it never listens.">
        <Toggle label="Show Pip" checked={s.enabled} onChange={(v) => save({ enabled: v })} />
      </SettingRow>
      <SettingRow title="Pip's voice" hint="Off shows the words only. Pip is also quiet during Do not disturb and Sleep.">
        <Toggle label="Pip's voice" checked={s.voice} onChange={(v) => save({ voice: v })} />
      </SettingRow>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Voice" htmlFor="pip-voice">
          <Select id="pip-voice" value={s.voiceName ?? ""} onChange={(e) => save({ voiceName: e.target.value || null })} disabled={!voices.length}>
            <option value="">{auto ? `Best available (${auto.name.replace(/^Microsoft\s+/, "")})` : "Best available"}</option>
            {english.length > 0 && (
              <optgroup label="English">
                {english.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name.replace(/^Microsoft\s+/, "")} ({v.lang})
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Other languages">
                {others.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name.replace(/^Microsoft\s+/, "")} ({v.lang})
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Pitch</span>
          <Segmented
            label="Voice pitch"
            value={s.pitch}
            onChange={(v) => save({ pitch: v })}
            options={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ]}
            className="self-start"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold text-muted">Royal comparisons</span>
          <Segmented
            label="Royal comparisons"
            value={s.title}
            onChange={(v) => save({ title: v })}
            options={[
              { value: "queen", label: "Queen" },
              { value: "king", label: "King" },
              { value: "monarch", label: "Monarch" },
            ]}
            className="self-start"
          />
          <span className="text-xs text-muted">
            Pip calls you Your Majesty{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}. {name.trim() ? "" : "Add your name under Profile and Pip will use it."}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={sample} disabled={!s.enabled}>
          <Volume2 size={16} /> Hear Pip
        </Button>
        {!voices.length && <span className="text-xs text-muted">No speech voices found on this computer, so Pip shows the words only.</span>}
      </div>
      <p className="mt-3 text-xs text-muted">
        Pip uses the speech voices on this computer. To add more, open Windows Settings, then Time &amp; language, Speech, and Manage voices.
      </p>
    </div>
  );
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-base text-ink">{title}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

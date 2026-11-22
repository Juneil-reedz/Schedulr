"use client";
/* Pip, the royal herald, who reads out the schedule: a crowned bunny (or marigold) that
   walks along the tops of the cards and can be picked up and dropped anywhere.
   Pip talks; it never listens: there is no chat, microphone or text input. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "@/components/icons";
import { Button, Field, Segmented, Select, Toggle, cn } from "./ui";
import { useApp } from "@/lib/store";
import { useCompanionEngine } from "@/lib/companion/engine";
import type { Mood } from "@/lib/companion/lines";
import { PIP_DEFAULTS, usePip } from "@/lib/companion/pip";
import type { CompanionSettings } from "@/lib/types";
import { Bunny } from "./companion/Bunny";
import { Marigold } from "./companion/Marigold";
import { useWalker } from "./companion/useWalker";
import { listVoices, onVoicesChanged, pickVoice } from "@/lib/companion/voice";

const SIZE = { bunny: { w: 78, h: 85 }, marigold: { w: 74, h: 88 } } as const;

/** Pip on every page: walks along the tops of the cards, can be picked up and dropped,
    and shows a speech bubble while it talks. Pip never listens. */
export function Companion() {
  const ready = useApp((s) => s.ready);
  const settings = useApp((s) => s.settings.companion);
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const s = { ...PIP_DEFAULTS, ...settings };
  const active = ready && s.enabled;
  useCompanionEngine(active);
  useEffect(() => {
    if (!active) usePip.getState().stop();
  }, [active]);
  if (!active) return null;
  return <Roamer s={s} save={(patch) => setSetting("companion", { ...s, ...patch }).catch(fail)} />;
}

function Roamer({ s, save }: { s: CompanionSettings; save: (patch: Partial<CompanionSettings>) => void }) {
  const line = usePip((p) => p.line);
  const base = usePip((p) => p.base);
  const speaking = usePip((p) => p.speaking);
  const word = usePip((p) => p.word);
  const stop = usePip((p) => p.stop);
  const reduce = !!useReducedMotion();
  const size = SIZE[s.character];
  const root = useRef<HTMLDivElement>(null);
  const { motion: move, facing, pat, where, handlers } = useWalker(root, { roam: s.roam, paused: !!line, size, reduce });

  // A pat makes Pip happy for a moment.
  const [patted, setPatted] = useState(false);
  useEffect(() => {
    if (!pat) return;
    setPatted(true);
    const t = setTimeout(() => setPatted(false), 1400);
    return () => clearTimeout(t);
  }, [pat]);

  // The bubble opens towards the roomier side, and below Pip when near the top.
  const [side, setSide] = useState<{ right: boolean; below: boolean }>({ right: true, below: false });
  useEffect(() => {
    if (!line) return;
    const place = () => {
      const { x, y } = where();
      const next = { right: x > window.innerWidth / 2, below: y - size.h < 170 };
      setSide((cur) => (cur.right === next.right && cur.below === next.below ? cur : next));
    };
    place();
    // Pip may still be dropping in or be dragged while talking.
    const iv = setInterval(place, 300);
    return () => clearInterval(iv);
  }, [line, where, size.h]);

  const held = move === "held" || move === "fall";
  const mood: Mood = patted ? "happy" : held ? (move === "held" ? "happy" : "surprised") : line ? (speaking && line.mood === "sleepy" ? "talking" : line.mood) : move === "walk" ? "idle" : base;
  const Character = s.character === "bunny" ? Bunny : Marigold;
  const toggleVoice = () => {
    if (s.voice) stop();
    save({ voice: !s.voice });
  };

  return (
    <div ref={root} className="pip group pointer-events-none fixed left-0 top-0 z-[32]" style={{ width: size.w, height: size.h, willChange: "transform" }}>
      <AnimatePresence>
        {line && (
          <motion.div
            key={line.id}
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: side.below ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pip-bubble clay shape-tile absolute w-max max-w-[min(300px,calc(100vw-40px))] px-4 py-3 text-sm leading-snug text-ink min-[600px]:text-base",
              side.below ? "top-full mt-2" : "bottom-full mb-1",
              side.right ? "right-[30%]" : "left-[30%]",
            )}
            style={{ originX: side.right ? 1 : 0, originY: side.below ? 0 : 1 }}
          >
            <span className="mb-0.5 block text-2xs font-bold uppercase tracking-[0.08em] text-terracotta">Pip, royal herald</span>
            {line.text}
          </motion.div>
        )}
      </AnimatePresence>
      <div
        {...handlers}
        title="Pip. Drag to move, click to pat."
        className={cn("pointer-events-auto h-full w-full touch-none select-none", move === "held" ? "cursor-grabbing" : "cursor-grab")}
        style={{ transform: s.character === "bunny" && facing === -1 ? "scaleX(-1)" : undefined }}
      >
        <Character mood={mood} speaking={speaking} word={word} sass={line?.sass ?? false} cue={line?.id ?? 0} motion={move} pat={pat} />
      </div>
      <button
        type="button"
        onClick={toggleVoice}
        aria-label={s.voice ? "Mute Pip" : "Unmute Pip"}
        title={s.voice ? "Mute Pip" : "Unmute Pip"}
        className={cn(
          "btn-solid press pointer-events-auto absolute -left-3 top-0 grid h-7 w-7 place-items-center rounded-full bg-cream text-ink opacity-0 shadow-raise transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
          !s.voice && "opacity-70",
          move === "held" && "hidden",
        )}
      >
        {s.voice ? <Volume2 size={14} /> : <VolumeX size={14} />}
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
      <SettingRow title="Show Pip" hint="A royal herald who greets you and reads out your day. Pip only talks; it never listens. Drag Pip anywhere, or click to give a pat.">
        <Toggle label="Show Pip" checked={s.enabled} onChange={(v) => save({ enabled: v })} />
      </SettingRow>
      <SettingRow title="Walk around" hint="Pip hops along the tops of your cards and the bottom of the window. Off, Pip stays where you drop it.">
        <Toggle label="Walk around" checked={s.roam} onChange={(v) => save({ roam: v })} />
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
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Look</span>
          <Segmented
            label="Pip's look"
            value={s.character}
            onChange={(v) => save({ character: v })}
            options={[
              { value: "bunny", label: "Bunny" },
              { value: "marigold", label: "Marigold" },
            ]}
            className="self-start"
          />
        </div>
        <div className="flex flex-col gap-1.5">
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

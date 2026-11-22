"use client";
/* The marigold look for Pip: a crowned flower with leaf arms. */
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useEffect, useState } from "react";
import type { Mood } from "@/lib/companion/lines";
import type { CharacterProps, Motion } from "./types";

const INK = "#2b211b";
const LEAF = "#5f8f57";
const STEM = "#3d6a52";
const GOLD = "#f4c445";
const GOLD_EDGE = "#b7791f";

/** Random blinks, every few seconds. */
export function useBlink(enabled: boolean) {
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

export function Marigold({ mood, speaking, word, sass, cue, motion: move }: CharacterProps) {
  const reduce = !!useReducedMotion();
  const blink = useBlink(mood !== "sleepy" && mood !== "happy");

  // Whole-body motion for each state. `cue` restarts one-off gestures for each new line.
  const moving: Partial<Record<Motion, TargetAndTransition>> = {
    walk: { y: [0, -9, 0], rotate: [0, 3, 0], transition: { duration: 0.5, repeat: Infinity, ease: "easeOut" } },
    held: { rotate: [-9, 9, -9], transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" } },
    fall: { scaleY: 1.08, scaleX: 0.94 },
    jump: { rotate: -6 },
  };
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
      animate={reduce ? {} : (moving[move] ?? body[mood])}
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


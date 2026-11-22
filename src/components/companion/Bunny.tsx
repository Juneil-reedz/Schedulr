"use client";
/* The bunny look for Pip: a round white rabbit with a tiny crown, drawn facing right.
   The container flips it to face left. Body poses follow `motion`, the face follows `mood`. */
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import type { Mood } from "@/lib/companion/lines";
import { useBlink } from "./Marigold";
import type { CharacterProps, Motion } from "./types";

const FUR = "#fffdf9";
const FUR_EDGE = "#d8c6b6";
const INK = "#2b211b";
const PINK = "#f4a9b0";
const GOLD = "#f4c445";
const GOLD_EDGE = "#b7791f";

function Eyes({ mood, blink }: { mood: Mood; blink: boolean }) {
  if (mood === "happy")
    return (
      <g fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round">
        <path d="M59 62 Q64 55 69 62" />
        <path d="M77 62 Q82 55 87 62" />
      </g>
    );
  if (mood === "sleepy")
    return (
      <g fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round">
        <path d="M59 60 Q64 65 69 60" />
        <path d="M77 60 Q82 65 87 60" />
      </g>
    );
  const big = mood === "surprised";
  return (
    <motion.g animate={{ scaleY: blink ? 0.1 : 1 }} transition={{ duration: 0.07 }} style={{ originY: "60px" }}>
      {[64, 82].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={60} rx={big ? 5.4 : 4.4} ry={big ? 6.8 : 5.6} fill={INK} />
          <circle cx={x + 1.5} cy={57.6} r={big ? 2 : 1.6} fill="#fff" />
        </g>
      ))}
    </motion.g>
  );
}

function Mouth({ mood, speaking, word, still }: { mood: Mood; speaking: boolean; word: number; still: boolean }) {
  if (speaking)
    return (
      <motion.g
        key={word}
        initial={{ scaleY: 0.3 }}
        animate={still ? { scaleY: 0.7 } : { scaleY: [0.3, 1, 0.45, 0.9, 0.35, 0.8, 0.4] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "73px", originY: "74px" }}
      >
        <ellipse cx={73} cy={75} rx={4.6} ry={4} fill="#5b2620" />
        <ellipse cx={73} cy={77.4} rx={2.8} ry={1.5} fill="#e98a86" />
      </motion.g>
    );
  if (mood === "happy" || mood === "greeting")
    return <path d="M67 72 Q73 81 79 72 Z" fill="#5b2620" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />;
  if (mood === "surprised") return <ellipse cx={73} cy={75} rx={3} ry={4} fill="#5b2620" />;
  return <path d="M73 71 Q70 75 67 73 M73 71 Q76 75 79 73" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />;
}

export function Bunny({ mood, speaking, word, cue, motion: move, pat }: CharacterProps) {
  const reduce = !!useReducedMotion();
  const blink = useBlink(mood !== "sleepy" && mood !== "happy");
  const r = (a: TargetAndTransition): TargetAndTransition => (reduce ? {} : a);

  // Whole body: hop-walking, dangling when held, stretched when falling, a bow when greeting.
  const body: TargetAndTransition =
    move === "walk"
      ? { y: [0, -7, 0], transition: { duration: 0.42, repeat: Infinity, ease: "easeOut" } }
      : move === "held"
        ? { rotate: [-7, 7, -7], y: 0, transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }
        : move === "fall"
          ? { scaleY: 1.08, scaleX: 0.93, rotate: 0 }
          : move === "jump"
            ? { scaleY: 1.05, scaleX: 0.96, rotate: -8 }
            : mood === "happy"
              ? { y: [0, -16, 0, -9, 0], transition: { duration: 0.9, ease: "easeOut" } }
              : mood === "surprised"
                ? { y: [0, -10, 0], transition: { duration: 0.4 } }
                : mood === "sleepy"
                  ? { y: 0, scaleY: [1, 1.03, 1], transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }
                  : { y: 0, scaleY: [1, 1.02, 1], rotate: 0, transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } };

  // Ears: perk up when surprised or falling, flop back when held or sleepy, bounce when walking.
  const ears: TargetAndTransition =
    move === "held"
      ? { rotate: [28, 38, 28], transition: { duration: 1.2, repeat: Infinity } }
      : move === "fall"
        ? { rotate: -10, scaleY: 1.1 }
        : move === "walk"
          ? { rotate: [0, 8, 0], transition: { duration: 0.42, repeat: Infinity } }
          : mood === "sleepy"
            ? { rotate: 55 }
            : mood === "surprised"
              ? { rotate: -8, scaleY: 1.12 }
              : { rotate: [0, 0, -6, 0, 0], scaleY: 1, transition: { duration: 5, repeat: Infinity, times: [0, 0.8, 0.85, 0.9, 1] } };

  const frontFoot: TargetAndTransition =
    move === "walk" ? { x: [0, 5, 0], y: [0, -3, 0], transition: { duration: 0.42, repeat: Infinity } } : move === "held" ? { y: 6, rotate: 20 } : { x: 0, y: 0, rotate: 0 };
  const backFoot: TargetAndTransition =
    move === "walk" ? { x: [0, -5, 0], y: [0, -2, 0], transition: { duration: 0.42, repeat: Infinity, delay: 0.21 } } : move === "held" ? { y: 8, rotate: -15 } : { x: 0, y: 0, rotate: 0 };
  const paw: TargetAndTransition =
    mood === "greeting" && move === "sit"
      ? { rotate: [0, -70, -40, -70, 0], transition: { duration: 1.5 } }
      : move === "held"
        ? { rotate: -30 }
        : { rotate: 0 };

  return (
    <motion.svg viewBox="0 0 120 130" className="block h-full w-full overflow-visible" aria-hidden key={`b${cue}-${pat}`}>
      <ellipse cx={58} cy={126} rx={30} ry={4} fill="rgb(40 30 20 / .16)" opacity={move === "held" || move === "fall" || move === "jump" ? 0 : 1} />
      <motion.g animate={r(body)} style={{ originX: "60px", originY: "126px" }}>
        {/* back foot and tail */}
        <motion.ellipse cx={42} cy={120} rx={14} ry={6} fill={FUR} stroke={FUR_EDGE} strokeWidth={1.6} animate={r(backFoot)} style={{ originX: "42px", originY: "120px" }} />
        <motion.circle
          cx={27}
          cy={95}
          r={10}
          fill={FUR}
          stroke={FUR_EDGE}
          strokeWidth={1.6}
          animate={reduce ? {} : { rotate: [0, 12, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ originX: "34px", originY: "98px" }}
        />
        {/* body */}
        <ellipse cx={57} cy={97} rx={32} ry={25} fill={FUR} stroke={FUR_EDGE} strokeWidth={1.6} />
        <ellipse cx={50} cy={88} rx={14} ry={7} fill="#fff" opacity={0.8} />
        <motion.ellipse cx={80} cy={121} rx={10} ry={5.5} fill={FUR} stroke={FUR_EDGE} strokeWidth={1.6} animate={r(frontFoot)} style={{ originX: "80px", originY: "121px" }} />
        <motion.ellipse
          cx={82}
          cy={104}
          rx={6}
          ry={9}
          fill={FUR}
          stroke={FUR_EDGE}
          strokeWidth={1.5}
          transform="rotate(-18 82 104)"
          animate={r(paw)}
          style={{ originX: "80px", originY: "97px" }}
        />

        {/* head with ears and crown */}
        <g>
          <motion.g animate={r(ears)} style={{ originX: "66px", originY: "46px" }}>
            <g transform="rotate(-14 60 46)">
              <ellipse cx={60} cy={24} rx={9} ry={24} fill={FUR} stroke={FUR_EDGE} strokeWidth={1.6} />
              <ellipse cx={60} cy={26} rx={4.4} ry={16} fill={PINK} />
            </g>
            <g transform="rotate(10 78 46)">
              <ellipse cx={78} cy={22} rx={9.5} ry={25} fill={FUR} stroke={FUR_EDGE} strokeWidth={1.6} />
              <ellipse cx={78} cy={24} rx={4.8} ry={17} fill={PINK} />
            </g>
          </motion.g>
          <ellipse cx={72} cy={62} rx={27} ry={23.5} fill={FUR} stroke={FUR_EDGE} strokeWidth={1.6} />
          <ellipse cx={62} cy={50} rx={10} ry={5.5} fill="#fff" opacity={0.9} transform="rotate(-20 62 50)" />
          <ellipse cx={57} cy={70} rx={5.6} ry={3.6} fill={PINK} opacity={mood === "happy" ? 0.95 : 0.7} />
          <ellipse cx={89} cy={70} rx={5.6} ry={3.6} fill={PINK} opacity={mood === "happy" ? 0.95 : 0.7} />
          <Eyes mood={mood} blink={blink} />
          <path d="M70.5 66.5 Q73 65.5 75.5 66.5 Q74.5 69.5 73 70 Q71.5 69.5 70.5 66.5 Z" fill="#e5707c" />
          <Mouth mood={mood} speaking={speaking} word={word} still={reduce} />
          <motion.g
            animate={reduce ? {} : mood === "happy" ? { y: [0, -6, 0] } : move === "held" ? { rotate: 14, x: 3 } : { rotate: -6 }}
            transition={{ duration: 0.8 }}
            style={{ originX: "70px", originY: "42px" }}
          >
            <path d="M58 43 L56 30 L64 37 L70 27 L76 37 L84 30 L82 43 Z" fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
            <circle cx={70} cy={27} r={2.4} fill="#6fb3e0" stroke={GOLD_EDGE} strokeWidth={0.8} />
            <circle cx={70} cy={40} r={2} fill="#c0392b" />
          </motion.g>
        </g>
      </motion.g>

      {/* state extras */}
      <AnimatePresence>
        {mood === "happy" &&
          [
            [16, 50, "♥"],
            [104, 36, "✦"],
            [10, 92, "✦"],
            [110, 84, "♥"],
          ].map(([x, y, ch], i) => (
            <motion.text
              key={`h${i}${cue}${pat}`}
              x={x as number}
              y={y as number}
              fontSize={i % 2 ? 14 : 16}
              fill={ch === "♥" ? "#e5707c" : GOLD}
              textAnchor="middle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: [0, 1, 0], y: -12 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, delay: i * 0.1 }}
            >
              {ch}
            </motion.text>
          ))}
        {mood === "surprised" && (
          <motion.g key={`x${cue}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} style={{ originX: "104px", originY: "30px" }}>
            <path d="M101 6 L107 6 L105 28 L103 28 Z" fill="#c0392b" stroke="#7a1f16" strokeWidth={1.1} strokeLinejoin="round" />
            <circle cx={104} cy={34} r={3} fill="#c0392b" stroke="#7a1f16" strokeWidth={1.1} />
          </motion.g>
        )}
        {mood === "sleepy" &&
          !reduce &&
          [0, 1, 2].map((i) => (
            <motion.text
              key={`z${i}`}
              x={96 + i * 8}
              y={36 - i * 9}
              fontSize={11 + i * 3}
              fontWeight={700}
              fill="#3d6a52"
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

export type { Motion };

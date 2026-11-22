"use client";
/* The bunny look for Pip, in a soft 3D chibi style: a big round head, short body and
   legs, gradient shading with a rim light, big glossy eyes, a gold crown and a little
   red velvet royal cape. Drawn turned slightly to the right; the container mirrors it
   to face left. Body poses follow `motion`, the face follows `mood`. */
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useId } from "react";
import type { Mood } from "@/lib/companion/lines";
import { useBlink } from "./Marigold";
import type { CharacterProps, Motion } from "./types";

const INK = "#2a1a14";
const MOUTH = "#7a2b2e";
const TONGUE = "#f0848f";
// Face features sit a little right of centre, so Pip looks the way it walks.
const FX = 4;

function Eyes({ mood, blink, id }: { mood: Mood; blink: boolean; id: string }) {
  const xs = [55 + FX, 85 + FX];
  if (mood === "happy")
    return (
      <g fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round">
        {xs.map((x) => (
          <path key={x} d={`M${x - 7} 75 Q${x} 65 ${x + 7} 75`} />
        ))}
      </g>
    );
  if (mood === "sleepy")
    return (
      <g fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round">
        {xs.map((x) => (
          <path key={x} d={`M${x - 7} 72 Q${x} 79 ${x + 7} 72`} />
        ))}
      </g>
    );
  const big = mood === "surprised";
  const rx = big ? 10 : 9;
  const ry = big ? 12 : 10.8;
  return (
    <motion.g animate={{ scaleY: blink ? 0.08 : 1 }} transition={{ duration: 0.07 }} style={{ transformBox: "view-box", originY: "72px" }}>
      {xs.map((x, i) => (
        <g key={x}>
          {/* lashes */}
          <path
            d={i ? `M${x + rx - 1} 68 l4 -3 M${x + rx} 72 l4.5 -0.5` : `M${x - rx + 1} 68 l-4 -3 M${x - rx} 72 l-4.5 -0.5`}
            stroke={INK}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <ellipse cx={x} cy={72} rx={rx} ry={ry} fill={`url(#${id}-iris)`} />
          <ellipse cx={x} cy={72} rx={rx} ry={ry} fill="none" stroke={INK} strokeWidth={1.4} />
          <ellipse cx={x} cy={74} rx={rx * 0.5} ry={ry * 0.5} fill="#160c08" />
          <circle cx={x + 3.4} cy={67.4} r={big ? 3.8 : 3.4} fill="#fff" />
          <circle cx={x - 3.2} cy={77.6} r={1.6} fill="#fff" opacity={0.85} />
          <path
            d={`M${x - rx + 2} ${76 + ry * 0.35} Q${x} ${72 + ry + 1} ${x + rx - 2} ${76 + ry * 0.35}`}
            stroke="#9fc4e8"
            strokeWidth={1.4}
            fill="none"
            opacity={0.7}
          />
        </g>
      ))}
    </motion.g>
  );
}

function Mouth({ mood, speaking, word, still }: { mood: Mood; speaking: boolean; word: number; still: boolean }) {
  const cx = 70 + FX;
  if (speaking)
    return (
      <motion.g
        key={word}
        initial={{ scaleY: 0.3 }}
        animate={still ? { scaleY: 0.7 } : { scaleY: [0.3, 1, 0.45, 0.9, 0.35, 0.8, 0.4] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "view-box", originX: `${cx}px`, originY: "92px" }}
      >
        <ellipse cx={cx} cy={93} rx={5.2} ry={4.6} fill={MOUTH} />
        <ellipse cx={cx} cy={96} rx={3.4} ry={1.8} fill={TONGUE} />
      </motion.g>
    );
  if (mood === "surprised") return <ellipse cx={cx} cy={93} rx={3.4} ry={4.4} fill={MOUTH} />;
  if (mood === "sleepy") return <path d={`M${cx - 4} 92 Q${cx} 95 ${cx + 4} 92`} fill="none" stroke={MOUTH} strokeWidth={2} strokeLinecap="round" />;
  // A small open smile with the tongue peeking out.
  const wide = mood === "happy" || mood === "greeting" ? 1.25 : 1;
  return (
    <g>
      <path d={`M${cx - 6 * wide} 89.5 Q${cx} ${97 + 2 * wide} ${cx + 6 * wide} 89.5 Q${cx} 91.5 ${cx - 6 * wide} 89.5 Z`} fill={MOUTH} />
      <path d={`M${cx - 3} 94 Q${cx} ${98 + wide} ${cx + 3} 94 Q${cx} 92.6 ${cx - 3} 94 Z`} fill={TONGUE} />
    </g>
  );
}

export function Bunny({ mood, speaking, word, cue, motion: move, pat }: CharacterProps) {
  const reduce = !!useReducedMotion();
  const blink = useBlink(mood !== "sleepy" && mood !== "happy");
  const id = useId().replace(/:/g, "");
  const r = (a: TargetAndTransition): TargetAndTransition => (reduce ? {} : a);
  const g = (n: string) => `url(#${id}-${n})`;

  const step = 0.44;
  const body: TargetAndTransition =
    move === "walk"
      ? { y: [0, -5, 0, -5, 0], rotate: [-3, 3, -3], transition: { duration: step * 2, repeat: Infinity, ease: "easeInOut" } }
      : move === "held"
        ? { rotate: [-6, 6, -6], y: 0, transition: { duration: 1.3, repeat: Infinity, ease: "easeInOut" } }
        : move === "fall"
          ? { scaleY: 1.06, scaleX: 0.95, rotate: 0 }
          : move === "jump"
            ? { scaleY: 1.04, scaleX: 0.97, rotate: -5 }
            : mood === "happy"
              ? { y: [0, -16, 0, -9, 0], rotate: 0, transition: { duration: 0.95, ease: "easeOut" } }
              : mood === "surprised"
                ? { y: [0, -10, 0], transition: { duration: 0.4 } }
                : mood === "sleepy"
                  ? { y: 0, rotate: 0, scaleY: [1, 1.025, 1], transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }
                  : { y: 0, rotate: 0, scaleY: [1, 1.018, 1], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } };
  const head: TargetAndTransition =
    mood === "greeting" && move === "sit"
      ? { rotate: [0, 0, 8, 0], y: [0, 0, 4, 0], transition: { duration: 1.6 } }
      : mood === "sleepy"
        ? { rotate: 7 }
        : speaking
          ? { rotate: [0, -3, 2, 0], transition: { duration: 2.2, repeat: Infinity } }
          : { rotate: 0, y: 0 };
  const earL: TargetAndTransition =
    move === "held"
      ? { rotate: [-30, -42, -30], transition: { duration: 1.3, repeat: Infinity } }
      : move === "fall"
        ? { rotate: 6, scaleY: 1.08 }
        : mood === "sleepy"
          ? { rotate: -48 }
          : mood === "surprised"
            ? { rotate: 4, scaleY: 1.1 }
            : move === "walk"
              ? { rotate: [0, -7, 0], transition: { duration: step, repeat: Infinity } }
              : { rotate: [0, 0, -9, 0, 0], scaleY: 1, transition: { duration: 6, repeat: Infinity, times: [0, 0.82, 0.86, 0.9, 1] } };
  const earR: TargetAndTransition =
    move === "held"
      ? { rotate: [30, 42, 30], transition: { duration: 1.3, repeat: Infinity } }
      : move === "fall"
        ? { rotate: -6, scaleY: 1.08 }
        : mood === "sleepy"
          ? { rotate: 40 }
          : mood === "surprised"
            ? { rotate: -4, scaleY: 1.1 }
            : move === "walk"
              ? { rotate: [0, 7, 0], transition: { duration: step, repeat: Infinity, delay: step / 2 } }
              : { rotate: 0, scaleY: 1 };
  const legL: TargetAndTransition =
    move === "walk"
      ? { y: [0, -5, 0, 0, 0], transition: { duration: step * 2, repeat: Infinity } }
      : move === "held"
        ? { y: 5, rotate: 12 }
        : move === "jump"
          ? { y: -6 }
          : { y: 0, rotate: 0 };
  const legR: TargetAndTransition =
    move === "walk"
      ? { y: [0, 0, 0, -5, 0], transition: { duration: step * 2, repeat: Infinity } }
      : move === "held"
        ? { y: 7, rotate: -12 }
        : move === "jump"
          ? { y: -6 }
          : { y: 0, rotate: 0 };
  const armL: TargetAndTransition =
    move === "held" || move === "fall"
      ? { rotate: 120 }
      : move === "walk"
        ? { rotate: [-12, 12, -12], transition: { duration: step * 2, repeat: Infinity } }
        : mood === "happy"
          ? { rotate: [0, 110, 0], transition: { duration: 0.95 } }
          : { rotate: 0 };
  const armR: TargetAndTransition =
    mood === "greeting" && move === "sit"
      ? { rotate: [0, -130, -95, -130, -95, 0], transition: { duration: 1.7, ease: "easeInOut" } }
      : move === "held" || move === "fall"
        ? { rotate: -120 }
        : move === "walk"
          ? { rotate: [12, -12, 12], transition: { duration: step * 2, repeat: Infinity } }
          : mood === "happy"
            ? { rotate: [0, -110, 0], transition: { duration: 0.95 } }
            : { rotate: 0 };

  return (
    <motion.svg viewBox="0 0 140 170" className="block h-full w-full overflow-visible" aria-hidden key={`b${cue}-${pat}`}>
      <defs>
        {/* fur: lit from the top left, lavender in the shade */}
        <radialGradient id={`${id}-fur`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#fbf6f8" />
          <stop offset="0.85" stopColor="#ece0ea" />
          <stop offset="1" stopColor="#d7c6d6" />
        </radialGradient>
        <radialGradient id={`${id}-ear`} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f6eef4" />
          <stop offset="1" stopColor="#d9c8d8" />
        </radialGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc9b6" />
          <stop offset="1" stopColor="#f59a86" />
        </linearGradient>
        <radialGradient id={`${id}-iris`} cx="0.45" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#7a5444" />
          <stop offset="0.55" stopColor="#3d2219" />
          <stop offset="1" stopColor="#1d0f0a" />
        </radialGradient>
        <radialGradient id={`${id}-blush`}>
          <stop offset="0" stopColor="#ff8f9c" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff8f9c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cape`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2525e" />
          <stop offset="0.6" stopColor="#b8293a" />
          <stop offset="1" stopColor="#7f1626" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe48a" />
          <stop offset="0.5" stopColor="#f4c445" />
          <stop offset="1" stopColor="#c98a1c" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="rgb(40 25 40)" stopOpacity="0.28" />
          <stop offset="1" stopColor="rgb(40 25 40)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={70} cy={164} rx={34} ry={6} fill={g("shadow")} opacity={move === "held" || move === "fall" || move === "jump" ? 0.15 : 1} />

      <motion.g animate={r(body)} style={{ transformBox: "view-box", originX: "70px", originY: "164px" }}>
        {/* tail */}
        <circle cx={44} cy={138} r={10} fill={g("fur")} />
        {/* legs and feet */}
        <motion.g animate={r(legL)} style={{ transformBox: "view-box", originX: "60px", originY: "146px" }}>
          <rect x={53} y={140} width={14} height={16} rx={7} fill={g("fur")} />
          <ellipse cx={59} cy={157} rx={10} ry={6.5} fill={g("fur")} />
          <ellipse cx={56} cy={154} rx={4} ry={2} fill="#fff" opacity={0.9} />
        </motion.g>
        <motion.g animate={r(legR)} style={{ transformBox: "view-box", originX: "80px", originY: "146px" }}>
          <rect x={73} y={140} width={14} height={16} rx={7} fill={g("fur")} />
          <ellipse cx={81} cy={157} rx={10} ry={6.5} fill={g("fur")} />
          <ellipse cx={78} cy={154} rx={4} ry={2} fill="#fff" opacity={0.9} />
        </motion.g>

        {/* body */}
        <path d="M70 102 C92 102 98 122 96 136 C94 148 84 150 70 150 C56 150 46 148 44 136 C42 122 48 102 70 102 Z" fill={g("fur")} />
        <ellipse cx={70} cy={132} rx={13} ry={11} fill="#fff" opacity={0.75} />

        {/* the royal cape, behind the arms */}
        <path d="M48 110 C42 124 40 140 44 148 C52 151 58 144 60 136 L60 114 Z" fill={g("cape")} />
        <path d="M92 110 C98 124 100 140 96 148 C88 151 82 144 80 136 L80 114 Z" fill={g("cape")} />
        <path d="M46 112 C46 122 44 136 45 146" stroke="#ff8a95" strokeWidth={1.4} fill="none" opacity={0.55} />

        {/* arms */}
        <motion.g animate={r(armL)} style={{ transformBox: "view-box", originX: "51px", originY: "114px" }}>
          <ellipse cx={47} cy={124} rx={7} ry={11} fill={g("fur")} transform="rotate(18 47 124)" />
        </motion.g>
        <motion.g animate={r(armR)} style={{ transformBox: "view-box", originX: "89px", originY: "114px" }}>
          <ellipse cx={93} cy={124} rx={7} ry={11} fill={g("fur")} transform="rotate(-18 93 124)" />
        </motion.g>

        {/* ermine collar with a gold clasp */}
        <path d="M46 108 C56 116 84 116 94 108 C96 102 90 98 70 98 C50 98 44 102 46 108 Z" fill="#fffdfb" stroke="#e6dbe4" strokeWidth={1} />
        {[54, 63, 77, 86].map((x, i) => (
          <path key={x} d={`M${x} ${105 + (i % 2)} l1 3 l1 -3 Z`} fill={INK} />
        ))}
        <circle cx={70} cy={110} r={4} fill={g("gold")} stroke="#a8711a" strokeWidth={0.8} />
        <circle cx={68.8} cy={108.8} r={1.2} fill="#fff" opacity={0.8} />

        {/* head */}
        <motion.g animate={r(head)} style={{ transformBox: "view-box", originX: "70px", originY: "102px" }}>
          {/* ears */}
          <motion.g animate={r(earL)} style={{ transformBox: "view-box", originX: "54px", originY: "44px" }}>
            <ellipse cx={50} cy={18} rx={11.5} ry={30} fill={g("ear")} transform="rotate(-10 50 18)" />
            <ellipse cx={50} cy={20} rx={5.6} ry={21} fill={g("inner")} transform="rotate(-10 50 20)" />
          </motion.g>
          <motion.g animate={r(earR)} style={{ transformBox: "view-box", originX: "88px", originY: "44px" }}>
            <ellipse cx={92} cy={18} rx={11.5} ry={30} fill={g("ear")} transform="rotate(12 92 18)" />
            <ellipse cx={92} cy={20} rx={5.6} ry={21} fill={g("inner")} transform="rotate(12 92 20)" />
          </motion.g>
          {/* head shape: round with full cheeks */}
          <path d="M70 36 C98 36 112 54 112 76 C112 92 104 104 88 106 C80 107 60 107 52 106 C36 104 28 92 28 76 C28 54 42 36 70 36 Z" fill={g("fur")} />
          {/* soft shade under the chin onto the collar */}
          <ellipse cx={70} cy={107} rx={22} ry={3} fill="rgb(120 90 120 / .16)" />
          {/* rim light and top highlight */}
          <path d="M40 58 C46 46 56 40 68 39" stroke="#fff" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.9} />
          <ellipse cx={52} cy={50} rx={10} ry={5} fill="#fff" transform="rotate(-25 52 50)" />
          {/* cheeks */}
          <ellipse cx={44 + FX} cy={88} rx={12} ry={8} fill={g("blush")} opacity={mood === "happy" ? 1 : 0.85} />
          <ellipse cx={98 + FX} cy={88} rx={12} ry={8} fill={g("blush")} opacity={mood === "happy" ? 1 : 0.85} />
          <Eyes mood={mood} blink={blink} id={id} />
          {/* nose */}
          <path d={`M${66.5 + FX} 84 Q${70 + FX} 82.5 ${73.5 + FX} 84 Q${72 + FX} 87.5 ${70 + FX} 88 Q${68 + FX} 87.5 ${66.5 + FX} 84 Z`} fill="#f08a98" />
          <circle cx={68.8 + FX} cy={84.4} r={0.9} fill="#fff" opacity={0.8} />
          <Mouth mood={mood} speaking={speaking} word={word} still={reduce} />

          {/* crown, a little tilted */}
          <motion.g
            animate={reduce ? {} : mood === "happy" ? { y: [0, -7, 0], rotate: [-10, -18, -10] } : move === "held" ? { rotate: 4, x: 2 } : { rotate: -10 }}
            transition={{ duration: 0.8 }}
            style={{ transformBox: "view-box", originX: "72px", originY: "40px" }}
          >
            <path d="M57 42 L54 25 L64 33 L72 21 L80 33 L90 25 L87 42 Z" fill={g("gold")} stroke="#a8711a" strokeWidth={1.4} strokeLinejoin="round" />
            <rect x={57} y={38} width={30} height={6} rx={2.5} fill={g("gold")} stroke="#a8711a" strokeWidth={1.2} />
            <circle cx={72} cy={21} r={2.8} fill="#7cc4f0" stroke="#a8711a" strokeWidth={0.8} />
            <circle cx={54} cy={25} r={2.2} fill="#e2525e" stroke="#a8711a" strokeWidth={0.7} />
            <circle cx={90} cy={25} r={2.2} fill="#e2525e" stroke="#a8711a" strokeWidth={0.7} />
            <circle cx={72} cy={41} r={1.8} fill="#e2525e" />
            <path d="M60 37 L61 30" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
          </motion.g>
        </motion.g>
      </motion.g>

      {/* state extras */}
      <AnimatePresence>
        {mood === "happy" &&
          [
            [16, 60, "♥"],
            [124, 46, "✦"],
            [12, 110, "✦"],
            [128, 100, "♥"],
          ].map(([x, y, ch], i) => (
            <motion.text
              key={`h${i}${cue}${pat}`}
              x={x as number}
              y={y as number}
              fontSize={i % 2 ? 15 : 17}
              fill={ch === "♥" ? "#f0848f" : "#f4c445"}
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
          <motion.g key={`x${cue}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} style={{ transformBox: "view-box", originX: "122px", originY: "30px" }}>
            <path d="M119 6 L126 6 L124 30 L121 30 Z" fill="#d23c3c" stroke="#7a1f16" strokeWidth={1.1} strokeLinejoin="round" />
            <circle cx={122.5} cy={37} r={3.4} fill="#d23c3c" stroke="#7a1f16" strokeWidth={1.1} />
          </motion.g>
        )}
        {mood === "sleepy" &&
          !reduce &&
          [0, 1, 2].map((i) => (
            <motion.text
              key={`z${i}`}
              x={112 + i * 8}
              y={40 - i * 9}
              fontSize={11 + i * 3}
              fontWeight={700}
              fill="#7a6a8a"
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

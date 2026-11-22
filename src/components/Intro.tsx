"use client";
/* The opening screen, played once each time Schedulr starts: drifting colour light,
   a flower that blooms inside a ring that draws itself, the name rising letter by letter,
   a greeting and today's date, and a thin progress line while the planner loads. When
   ready it opens like a lens from the centre to reveal the app. A click or key skips it. */
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useIntro } from "@/lib/intro";

const MIN_MS = 2600;
const NAME = "Schedulr";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The flower: eight petals unfolding one after another around a golden heart. */
function BloomMark({ still }: { still: boolean }) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg viewBox="-60 -60 120 120" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id="intro-petal" cx="50%" cy="90%" r="95%">
          <stop offset="0" stopColor="var(--terracotta)" />
          <stop offset="0.7" stopColor="var(--rose)" />
          <stop offset="1" stopColor="var(--rose-soft)" />
        </radialGradient>
        <radialGradient id="intro-heart" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.45" stopColor="var(--marigold)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--marigold) 70%, var(--terracotta))" />
        </radialGradient>
      </defs>
      {/* the ring draws itself */}
      <motion.circle
        r={54}
        fill="none"
        stroke="var(--terracotta-soft)"
        strokeWidth={1.4}
        strokeLinecap="round"
        initial={{ pathLength: still ? 1 : 0, opacity: 0.2 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.4, ease: EASE }}
        style={{ rotate: -90 }}
      />
      {/* three small lights orbiting */}
      <motion.g
        animate={still ? {} : { rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{ transformBox: "view-box", originX: "0px", originY: "0px" }}
      >
        {[0, 120, 240].map((a, i) => (
          <circle
            key={a}
            cx={Math.cos((a * Math.PI) / 180) * 54}
            cy={Math.sin((a * Math.PI) / 180) * 54}
            r={i === 0 ? 2.6 : 1.8}
            fill={i === 1 ? "var(--marigold)" : "var(--terracotta)"}
          />
        ))}
      </motion.g>
      <motion.g
        animate={still ? {} : { rotate: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "view-box", originX: "0px", originY: "0px" }}
      >
        {petals.map((a, i) => (
          <g key={a} transform={`rotate(${a})`}>
            <motion.ellipse
              cx={0}
              cy={-21}
              rx={10.5}
              ry={19}
              fill="url(#intro-petal)"
              initial={still ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.07, type: "spring", stiffness: 210, damping: 15 }}
              style={{ transformBox: "view-box", originX: "0px", originY: "0px" }}
            />
          </g>
        ))}
        <motion.circle
          r={12}
          fill="url(#intro-heart)"
          initial={still ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.85, type: "spring", stiffness: 260, damping: 13 }}
        />
        <circle cx={-3.5} cy={-4} r={3} fill="#fff" opacity={0.55} />
      </motion.g>
    </svg>
  );
}

export function Intro() {
  const done = useIntro((s) => s.done);
  const finish = useIntro((s) => s.finish);
  const ready = useApp((s) => s.ready);
  const bootError = useApp((s) => s.bootError);
  const name = useApp((s) => (s.settings.profile?.name ?? "").trim().split(/\s+/)[0] ?? "");
  const still = !!useReducedMotion();
  const [minPassed, setMinPassed] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setMinPassed(true), still ? 900 : MIN_MS);
    return () => clearTimeout(t);
  }, [done, still]);

  // Leave once the planner is ready and the moment has played, or on any click or key.
  useEffect(() => {
    if (done) return;
    if ((ready || bootError) && minPassed) finish();
  }, [done, ready, bootError, minPassed, finish]);
  useEffect(() => {
    if (done) return;
    const skip = () => (ready || bootError ? finish() : setMinPassed(true));
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [done, ready, bootError, finish]);

  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="intro"
          className="intro fixed inset-0 z-[80] grid cursor-pointer place-items-center overflow-hidden"
          role="presentation"
          initial={{ opacity: 1, "--hole": "-20%" } as TargetAndTransition}
          exit={(still ? { opacity: 0, transition: { duration: 0.35 } } : { "--hole": "96%", transition: { duration: 1.1, ease: [0.65, 0, 0.3, 1] } }) as TargetAndTransition}
          style={{
            background: "var(--ivory)",
            ["--hole" as string]: "-20%",
            maskImage: "radial-gradient(circle at 50% 46%, transparent var(--hole), #000 calc(var(--hole) + 14%))",
            WebkitMaskImage: "radial-gradient(circle at 50% 46%, transparent var(--hole), #000 calc(var(--hole) + 14%))",
          }}
        >
          {/* drifting colour light */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="intro-blob" style={{ background: "var(--terracotta-soft)", left: "-12%", top: "-18%", animationDelay: "0s" }} />
            <span className="intro-blob" style={{ background: "var(--marigold-soft)", right: "-16%", top: "8%", animationDelay: "-6s" }} />
            <span className="intro-blob" style={{ background: "var(--sage-soft)", left: "18%", bottom: "-26%", animationDelay: "-11s" }} />
            <span className="absolute inset-0 opacity-[0.08] mix-blend-multiply" style={{ backgroundImage: "var(--grain)" }} />
            <span className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, color-mix(in oklab, var(--espresso) 14%, transparent))" }} />
          </div>

          <motion.div
            className="relative flex flex-col items-center px-6 text-center"
            exit={still ? {} : { scale: 1.08, opacity: 0, filter: "blur(10px)", transition: { duration: 0.55, ease: EASE } }}
          >
            <div className="relative h-[148px] w-[148px] sm:h-[176px] sm:w-[176px]">
              <span aria-hidden className="absolute inset-[18%] rounded-full blur-2xl" style={{ background: "color-mix(in oklab, var(--marigold) 45%, transparent)" }} />
              <BloomMark still={still} />
            </div>

            <h1 className="display mt-7 flex text-[clamp(44px,7vw,76px)] leading-none" aria-label={NAME}>
              {NAME.split("").map((ch, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="intro-word inline-block"
                  initial={still ? false : { y: 26, opacity: 0, filter: "blur(8px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: 0.55 + i * 0.055, duration: 0.7, ease: EASE }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>

            <motion.p
              className="mt-4 text-lg font-semibold text-forest sm:text-xl"
              initial={still ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.6, ease: EASE }}
            >
              {greeting(now)}
              {name ? `, ${name}` : ""}
            </motion.p>
            <motion.p
              className="mt-1 text-sm text-muted"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.35, duration: 0.6 }}
            >
              {date}
            </motion.p>

            <motion.div
              className="mt-8 flex flex-col items-center gap-2.5"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <div className="relative h-[3px] w-44 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--espresso)_10%,transparent)]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--terracotta), var(--marigold))" }}
                  initial={{ width: "0%" }}
                  animate={{ width: ready ? "100%" : "72%" }}
                  transition={{ duration: ready ? 0.6 : 2.2, ease: EASE }}
                />
                <span className="intro-shine absolute inset-y-0 w-12" />
              </div>
              <p className="text-xs text-muted" aria-live="polite">
                {bootError ? "Something went wrong" : ready ? "Your day is ready" : "Opening your planner…"}
              </p>
            </motion.div>
          </motion.div>

          <motion.p
            className="absolute bottom-6 text-xs text-muted [@media(max-height:620px)]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 1.9, duration: 0.6 }}
          >
            Click anywhere to skip
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

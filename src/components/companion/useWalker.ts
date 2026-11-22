"use client";
/* Moves Pip around the page. Pip stands on "surfaces": the top edges of the cards on
   screen, and the bottom of the window as a floor. It walks back and forth, turns at
   the ends, sometimes sits, and now and then hops to a nearby card. It can be picked up
   and dropped anywhere; it then falls onto whatever card is below.
   Position is written straight to the element each frame; React only hears about pose
   changes (walking, sitting, held, falling, jumping) and which way Pip faces. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Motion } from "./types";

type Surface = Element | "floor";
interface Box {
  left: number;
  right: number;
  top: number;
}

const SPEED = 34; // px per second
const EDGE = 34; // keep away from rounded card corners
const GRAVITY = 2600;

function floorY() {
  return window.innerWidth < 600 ? window.innerHeight - 92 : window.innerHeight - 4;
}
function boxOf(s: Surface): Box {
  if (s === "floor") return { left: 8, right: window.innerWidth - 8, top: floorY() };
  const r = s.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top };
}
function usable(s: Surface) {
  if (s === "floor") return true;
  if (!s.isConnected) return false;
  const r = s.getBoundingClientRect();
  // Cards just under the top bar are skipped, so Pip never covers its buttons.
  return r.width >= 130 && r.top > 150 && r.top < floorY() - 40;
}
/** Card tops on screen. Only outer cards, never inside dialogs. */
function surfaces(): Element[] {
  return [...document.querySelectorAll("main .clay, nav[aria-label='Main'] > ul")].filter(
    (el) => !el.parentElement?.closest(".clay") && !el.closest("[role=dialog]") && usable(el),
  );
}
/** The surface right under a point: the nearest card top below it, or the floor. */
function below(x: number, y: number): Surface {
  let best: Surface = "floor";
  let top = floorY();
  for (const el of surfaces()) {
    const b = boxOf(el);
    if (x >= b.left + 16 && x <= b.right - 16 && b.top >= y - 6 && b.top < top) {
      best = el;
      top = b.top;
    }
  }
  return best;
}

interface State {
  mode: Motion;
  surface: Surface;
  rel: number;
  dir: 1 | -1;
  x: number;
  y: number;
  vy: number;
  sitUntil: number;
  jump: { fx: number; fy: number; to: Surface; rel: number; t: number; dur: number; h: number } | null;
  grab: { dx: number; dy: number; sx: number; sy: number; moved: boolean; id: number } | null;
}

export function useWalker(
  el: React.RefObject<HTMLDivElement | null>,
  { roam, paused, size, reduce }: { roam: boolean; paused: boolean; size: { w: number; h: number }; reduce: boolean },
) {
  const [motion, setMotion] = useState<Motion>("fall");
  const [facing, setFacing] = useState<1 | -1>(-1);
  const [pat, setPat] = useState(0);
  const st = useRef<State | null>(null);
  const opts = useRef({ roam, paused, size, reduce });
  opts.current = { roam, paused, size, reduce };

  const setMode = useCallback((m: Motion) => {
    const s = st.current!;
    if (s.mode !== m) {
      s.mode = m;
      setMotion(m);
    }
  }, []);
  const setDir = useCallback((d: 1 | -1) => {
    const s = st.current!;
    if (s.dir !== d) {
      s.dir = d;
      setFacing(d);
    }
  }, []);

  const fallTo = useCallback(
    (x: number, y: number) => {
      const s = st.current!;
      s.surface = below(x, y);
      s.vy = 0;
      s.x = x;
      s.y = Math.min(y, floorY());
      setMode("fall");
    },
    [setMode],
  );

  const land = useCallback(
    (surface: Surface, x: number) => {
      const s = st.current!;
      const b = boxOf(surface);
      s.surface = surface;
      s.rel = Math.min(Math.max(x - b.left, EDGE), b.right - b.left - EDGE);
      s.sitUntil = performance.now() + 900 + Math.random() * 1600;
      setMode("sit");
    },
    [setMode],
  );

  /** A hop to a card (or the floor) a little ahead, if there is one in reach. */
  const hopAhead = useCallback(
    (now: number) => {
      const s = st.current!;
      const options: { to: Surface; lx: number; ly: number }[] = [];
      for (const cand of [...surfaces(), "floor" as const]) {
        if (cand === s.surface) continue;
        const b = boxOf(cand);
        const lx = Math.min(Math.max(s.x + s.dir * 90, b.left + EDGE), b.right - EDGE);
        const dx = lx - s.x;
        const dy = b.top - s.y;
        if (s.dir * dx >= 20 && Math.abs(dx) <= 240 && dy > -250 && dy < 320) options.push({ to: cand, lx, ly: b.top });
      }
      if (!options.length) return false;
      const pick = options[Math.floor(Math.random() * options.length)];
      const rise = Math.max(36, s.y - pick.ly + 40);
      s.jump = { fx: s.x, fy: s.y, to: pick.to, rel: pick.lx - boxOf(pick.to).left, t: 0, dur: 0.55 + Math.min(0.3, Math.abs(pick.lx - s.x) / 800), h: rise };
      setMode("jump");
      s.sitUntil = now;
      return true;
    },
    [setMode],
  );

  // The animation loop.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const startX = window.innerWidth - (window.innerWidth < 600 ? 70 : 150);
    st.current = { mode: "fall", surface: "floor", rel: 0, dir: -1, x: startX, y: 40, vy: 0, sitUntil: 0, jump: null, grab: null };
    st.current.surface = below(startX, 40);
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const s = st.current!;
      const { roam, paused, size, reduce } = opts.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (s.mode === "held") {
        // position set by the pointer handlers
      } else if (s.mode === "fall") {
        if (!usable(s.surface)) s.surface = below(s.x, s.y);
        const b = boxOf(s.surface);
        s.vy += GRAVITY * dt;
        s.y += s.vy * dt;
        if (reduce || s.y >= b.top) {
          s.y = b.top;
          land(s.surface, s.x);
        }
      } else if (s.mode === "jump" && s.jump) {
        const j = s.jump;
        j.t = Math.min(1, j.t + dt / j.dur);
        const b = boxOf(j.to);
        const tx = b.left + j.rel;
        const ty = b.top;
        const e = j.t;
        s.x = j.fx + (tx - j.fx) * e;
        s.y = j.fy + (ty - j.fy) * e - 4 * j.h * e * (1 - e);
        if (e >= 1) {
          s.jump = null;
          if (usable(j.to)) land(j.to, tx);
          else fallTo(s.x, s.y);
        }
      } else {
        // On a surface: walk, sit, turn, hop.
        if (!usable(s.surface)) {
          fallTo(s.x, Math.min(s.y, floorY() - 60));
        } else {
          const b = boxOf(s.surface);
          const width = b.right - b.left;
          const min = EDGE;
          const max = Math.max(EDGE, width - EDGE);
          s.rel = Math.min(Math.max(s.rel, min), max);
          const canMove = roam && !paused && !reduce;
          if (s.mode === "walk") {
            if (!canMove) setMode("sit");
            else {
              s.rel += s.dir * SPEED * dt;
              if (s.rel <= min || s.rel >= max) {
                s.rel = Math.min(Math.max(s.rel, min), max);
                s.x = b.left + s.rel;
                if (!(Math.random() < 0.45 && hopAhead(now))) {
                  setDir(s.dir === 1 ? -1 : 1);
                  if (Math.random() < 0.5) {
                    s.sitUntil = now + 1500 + Math.random() * 3000;
                    setMode("sit");
                  }
                }
              } else if (Math.random() < dt * 0.1) {
                s.sitUntil = now + 2000 + Math.random() * 4000;
                setMode("sit");
              } else if (Math.random() < dt * 0.025) {
                hopAhead(now);
              }
            }
          } else if (s.mode === "sit" && canMove && now > s.sitUntil) {
            if (Math.random() < 0.3) setDir(s.dir === 1 ? -1 : 1);
            setMode("walk");
          }
          if (s.mode === "walk" || s.mode === "sit") {
            s.x = b.left + s.rel;
            s.y = b.top;
          }
        }
      }

      node.style.transform = `translate3d(${Math.round(s.x - size.w / 2)}px, ${Math.round(s.y - size.h + 2)}px, 0)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [el, land, fallTo, hopAhead, setMode, setDir]);

  // Picking Pip up. A press without movement is a pat.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const s = st.current;
      if (!s || e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      s.grab = { dx: e.clientX - s.x, dy: e.clientY - s.y, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
    },
    [],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = st.current;
      if (!s?.grab || s.grab.id !== e.pointerId) return;
      if (!s.grab.moved && Math.hypot(e.clientX - s.grab.sx, e.clientY - s.grab.sy) < 5) return;
      if (!s.grab.moved) {
        s.grab.moved = true;
        s.jump = null;
        setMode("held");
      }
      // Held by the scruff: the pointer sits a little above the head.
      s.x = Math.min(Math.max(e.clientX, 20), window.innerWidth - 20);
      s.y = Math.min(Math.max(e.clientY + opts.current.size.h * 0.8, opts.current.size.h), floorY());
    },
    [setMode],
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = st.current;
      if (!s?.grab || s.grab.id !== e.pointerId) return;
      const moved = s.grab.moved;
      s.grab = null;
      if (moved) fallTo(s.x, s.y);
      else setPat((p) => p + 1);
    },
    [fallTo],
  );

  /** Where Pip is now, for placing the speech bubble. */
  const where = useCallback(() => (st.current ? { x: st.current.x, y: st.current.y } : { x: 0, y: 0 }), []);

  return { motion, facing, pat, where, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

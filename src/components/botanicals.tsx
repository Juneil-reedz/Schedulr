"use client";
/* Hand-painted botanical motifs, drawn as local SVG so they render offline. */
import { useId } from "react";

type P = { className?: string };

/** A slight wobble so edges read as brushed paint, not vector-perfect. */
function Painterly({ id, scale = 2.2 }: { id: string; scale?: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} />
    </filter>
  );
}

export function Bloom({
  x = 0, y = 0, r = 10, petals = 6, color = "var(--rose)", deep = "var(--terracotta)", heart = "var(--marigold)", rotate = 0,
}: { x?: number; y?: number; r?: number; petals?: number; color?: string; deep?: string; heart?: string; rotate?: number }) {
  const gid = useId().replace(/:/g, "");
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <defs>
        <radialGradient id={`p${gid}`} cx="50%" cy="85%" r="90%">
          <stop offset="0" stopColor={deep} />
          <stop offset="0.65" stopColor={color} />
        </radialGradient>
      </defs>
      {Array.from({ length: petals }, (_, i) => (
        <ellipse key={i} rx={r * 0.48} ry={r * 0.78} cy={-r * 0.62} fill={`url(#p${gid})`} transform={`rotate(${(360 / petals) * i})`} />
      ))}
      <circle r={r * 0.36} fill={heart} />
      <circle r={r * 0.36} fill="none" stroke="var(--terracotta-deep)" strokeOpacity=".35" strokeWidth={r * 0.08} />
      {Array.from({ length: 5 }, (_, i) => (
        <circle key={i} r={r * 0.06} cx={Math.cos(i * 1.3) * r * 0.18} cy={Math.sin(i * 1.3) * r * 0.18} fill="var(--terracotta-deep)" opacity=".55" />
      ))}
    </g>
  );
}

export function Leaf({ x = 0, y = 0, len = 20, rotate = 0, color = "var(--sage)", vein = "var(--forest)" }: { x?: number; y?: number; len?: number; rotate?: number; color?: string; vein?: string }) {
  const w = len * 0.36;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d={`M0 0 C ${w} ${-len * 0.25} ${w * 0.9} ${-len * 0.8} 0 ${-len} C ${-w * 0.9} ${-len * 0.8} ${-w} ${-len * 0.25} 0 0 Z`} fill={color} />
      <path d={`M0 0 L0 ${-len * 0.9}`} stroke={vein} strokeOpacity=".45" strokeWidth={len * 0.04} strokeLinecap="round" />
    </g>
  );
}

/** Upright sprig with blossoms, for the clock tile. */
export function Sprig({ className }: P) {
  const f = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 90 150" className={className} aria-hidden="true">
      <defs><Painterly id={f} /></defs>
      <g filter={`url(#${f})`}>
        <path d="M46 148 C 44 120 50 96 44 70 C 40 52 46 34 52 18" stroke="var(--forest-soft)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M45 104 C 34 96 24 94 14 96" stroke="var(--forest-soft)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M46 78 C 58 70 68 68 78 70" stroke="var(--forest-soft)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Leaf x={45} y={130} len={26} rotate={-58} color="var(--sage)" />
        <Leaf x={46} y={122} len={22} rotate={52} color="var(--forest-soft)" />
        <Leaf x={30} y={98} len={18} rotate={-80} />
        <Leaf x={45} y={92} len={20} rotate={40} color="var(--forest-soft)" />
        <Leaf x={62} y={72} len={18} rotate={70} />
        <Leaf x={44} y={58} len={18} rotate={-40} color="var(--forest-soft)" />
        <Bloom x={52} y={16} r={11} color="var(--rose)" />
        <Bloom x={14} y={95} r={8} petals={5} color="var(--rose-soft)" rotate={20} />
        <Bloom x={78} y={68} r={9} petals={5} color="var(--terracotta-soft)" rotate={-10} />
        <circle cx="36" cy="40" r="4" fill="var(--rose)" />
        <circle cx="60" cy="44" r="3.4" fill="var(--terracotta-soft)" />
      </g>
    </svg>
  );
}

export function Sun({ className }: P) {
  const f = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <defs>
        <Painterly id={f} scale={1.6} />
        <radialGradient id={`s${f}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="var(--marigold-soft)" />
          <stop offset="1" stopColor="var(--marigold)" />
        </radialGradient>
      </defs>
      <g filter={`url(#${f})`}>
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M40 6 L43 17 L37 17 Z" fill="var(--marigold)" transform={`rotate(${i * 30} 40 40)`} />
        ))}
        <circle cx="40" cy="40" r="17" fill={`url(#s${f})`} />
      </g>
    </svg>
  );
}

export function Cloud({ className, rain = false, storm = false }: P & { rain?: boolean; storm?: boolean }) {
  return (
    <svg viewBox="0 0 90 70" className={className} aria-hidden="true">
      <path d="M22 44 C 8 44 8 26 22 26 C 24 14 42 10 50 20 C 60 12 76 20 72 32 C 84 34 82 48 70 48 L24 48 Z" fill="var(--cream)" stroke="var(--sand)" strokeWidth="2" />
      {rain && [26, 40, 54, 66].map((x) => <path key={x} d={`M${x} 54 l-3 9`} stroke="var(--sage)" strokeWidth="3" strokeLinecap="round" />)}
      {storm && <path d="M46 50 l-7 11 h7 l-4 9 l11 -14 h-7 l4 -6 z" fill="var(--marigold)" />}
    </svg>
  );
}

export function Moon({ className }: P) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <path d="M50 12 C 30 16 22 40 34 56 C 42 66 58 68 68 60 C 50 64 34 48 38 30 C 40 22 44 16 50 12 Z" fill="var(--marigold-soft)" stroke="var(--marigold)" strokeWidth="2" />
    </svg>
  );
}

/** A pair of leaves for the foot of a card. */
export function LeafPair({ className }: P) {
  const f = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <defs><Painterly id={f} /></defs>
      <g filter={`url(#${f})`}>
        <path d="M60 58 C 60 46 60 36 62 26" stroke="var(--forest-soft)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <Leaf x={60} y={52} len={34} rotate={-62} />
        <Leaf x={60} y={50} len={32} rotate={64} color="var(--forest-soft)" />
        <Leaf x={61} y={36} len={24} rotate={-30} color="var(--forest-soft)" />
        <Leaf x={61} y={34} len={22} rotate={34} />
        <Leaf x={62} y={26} len={16} rotate={0} />
      </g>
    </svg>
  );
}

export function Cactus({ className }: P) {
  const f = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <Painterly id={f} />
        <linearGradient id={`c${f}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--forest-soft)" />
          <stop offset=".55" stopColor="var(--sage)" />
          <stop offset="1" stopColor="var(--forest-soft)" />
        </linearGradient>
      </defs>
      <g filter={`url(#${f})`}>
        <path d="M43 94 L43 34 C 43 22 59 22 59 34 L59 94 Z" fill={`url(#c${f})`} />
        <path d="M43 64 L33 64 C 24 64 22 58 22 50 L22 40 C 22 32 32 32 32 40 L32 54 L43 54 Z" fill={`url(#c${f})`} />
        <path d="M59 58 L69 58 C 77 58 79 52 79 46 L79 32 C 79 24 69 24 69 32 L69 48 L59 48 Z" fill={`url(#c${f})`} />
        {[[51, 30], [51, 46], [51, 62], [51, 78], [27, 44], [74, 36]].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x - 3} ${y} l6 0 M${x} ${y - 3} l0 6`} stroke="var(--cream)" strokeOpacity=".7" strokeWidth="1.2" />
        ))}
        <Bloom x={51} y={22} r={8} petals={6} color="var(--rose)" />
        <Bloom x={27} y={32} r={6} petals={5} color="var(--terracotta-soft)" />
        <Bloom x={74} y={24} r={6} petals={5} color="var(--rose-soft)" />
      </g>
    </svg>
  );
}

/** The painted marigold band of flowers and leaves along a vine. */
/** The painted vine; `vertical` turns it to run top to bottom for the sidebar. */
export function FloralVine({ className, vertical = false }: P & { vertical?: boolean }) {
  const f = useId().replace(/:/g, "");
  const flowers = [
    [40, 30, 13, "var(--rose)"], [118, 22, 11, "var(--terracotta-soft)"], [196, 34, 14, "var(--rose)"], [276, 20, 10, "var(--rose-soft)"],
    [352, 32, 13, "var(--terracotta-soft)"], [430, 22, 12, "var(--rose)"], [510, 34, 13, "var(--rose-soft)"], [588, 24, 11, "var(--rose)"],
  ] as const;
  return (
    <svg viewBox={vertical ? "0 0 56 620" : "0 0 620 56"} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs><Painterly id={f} /></defs>
      <g transform={vertical ? "translate(56 0) rotate(90)" : undefined}>
      <g filter={`url(#${f})`}>
        <path d="M0 40 C 60 20 100 46 160 30 S 260 18 320 34 S 430 46 480 28 S 580 22 620 36" stroke="var(--forest-soft)" strokeWidth="2.4" fill="none" />
        {flowers.map(([x, y], i) => (
          <g key={`l${i}`}>
            <Leaf x={x + 18} y={y + 8} len={18} rotate={60 + (i % 2) * 40} color={i % 2 ? "var(--forest-soft)" : "var(--sage)"} />
            <Leaf x={x - 16} y={y + 10} len={16} rotate={-70 - (i % 3) * 15} color={i % 2 ? "var(--sage)" : "var(--forest-soft)"} />
          </g>
        ))}
        {flowers.map(([x, y, r, c], i) => <Bloom key={i} x={x} y={y} r={r} petals={i % 3 === 0 ? 8 : 6} color={c} rotate={i * 17} />)}
      </g>
      </g>
    </svg>
  );
}

/** Default artwork for the featured event: a painted doorway and a vase of flowers. */
export function PaintedDoorway({ className }: P) {
  const f = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <Painterly id={f} scale={3} />
        <linearGradient id={`w${f}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="color-mix(in oklab, var(--marigold) 70%, var(--marigold-soft))" />
          <stop offset=".5" stopColor="var(--marigold)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--marigold) 75%, var(--terracotta))" />
        </linearGradient>
        <linearGradient id={`d${f}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--forest-soft)" />
          <stop offset=".5" stopColor="color-mix(in oklab, var(--forest) 70%, var(--forest-soft))" />
          <stop offset="1" stopColor="var(--forest)" />
        </linearGradient>
        <radialGradient id={`l${f}`} cx="70%" cy="20%" r="70%">
          <stop offset="0" stopColor="var(--on-dark)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--on-dark)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g filter={`url(#${f})`}>
        <rect width="400" height="300" fill={`url(#w${f})`} />
        {[[30, 60, 40], [320, 210, 55], [70, 230, 30], [350, 50, 26]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.6} fill="color-mix(in oklab, var(--marigold) 60%, var(--terracotta-deep))" opacity=".28" />
        ))}
        <rect x="118" y="20" width="164" height="300" rx="6" fill={`url(#d${f})`} />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={124 + i * 40} y="20" width="3" height="300" fill="color-mix(in oklab, var(--forest) 75%, black)" opacity=".45" />)}
        <rect x="128" y="40" width="64" height="104" rx="4" fill="none" stroke="color-mix(in oklab, var(--forest) 75%, black)" strokeOpacity=".5" strokeWidth="3" />
        <rect x="208" y="40" width="64" height="104" rx="4" fill="none" stroke="color-mix(in oklab, var(--forest) 75%, black)" strokeOpacity=".5" strokeWidth="3" />
        <circle cx="202" cy="170" r="5" fill="color-mix(in oklab, var(--marigold) 75%, var(--terracotta))" />
        <rect x="0" y="262" width="400" height="38" fill="var(--terracotta)" />
        <rect x="0" y="262" width="400" height="5" fill="var(--terracotta-deep)" opacity=".6" />
        {/* vine climbing the wall */}
        <path d="M70 0 C 58 40 84 70 66 110 C 54 140 76 170 64 200" stroke="var(--forest-soft)" strokeWidth="3" fill="none" />
        {[20, 52, 84, 118, 150, 184].map((y, i) => (
          <Leaf key={y} x={66 + (i % 2 ? 8 : -6)} y={y} len={20} rotate={i % 2 ? 60 : -60} color={i % 2 ? "color-mix(in oklab, var(--sage) 50%, var(--forest-soft))" : "var(--sage)"} />
        ))}
        {/* vase and bouquet */}
        <g transform="translate(232 0)">
        <path d="M70 262 C 54 240 58 212 76 200 L104 200 C 122 212 126 240 110 262 Z" fill="var(--terracotta)" />
        <path d="M78 206 C 88 214 100 214 104 206" stroke="var(--marigold)" strokeWidth="3" fill="none" />
        <path d="M66 236 C 84 244 98 244 116 236" stroke="var(--ivory)" strokeOpacity=".7" strokeWidth="2.5" fill="none" />
        {[[-26, 0], [-12, -14], [4, -20], [20, -8], [30, 6]].map(([dx, dy], i) => (
          <path key={i} d={`M90 202 C ${90 + dx * 0.4} ${190 + dy} ${90 + dx * 0.8} ${170 + dy} ${90 + dx} ${150 + dy}`} stroke="var(--forest-soft)" strokeWidth="2.4" fill="none" />
        ))}
        <Leaf x={78} y={190} len={22} rotate={-70} color="color-mix(in oklab, var(--sage) 50%, var(--forest-soft))" />
        <Leaf x={104} y={186} len={22} rotate={70} color="var(--sage)" />
        <Bloom x={64} y={150} r={16} color="var(--rose)" deep="color-mix(in oklab, var(--terracotta) 70%, var(--rose))" />
        <Bloom x={86} y={128} r={18} color="color-mix(in oklab, var(--rose) 60%, var(--terracotta))" deep="var(--terracotta-deep)" rotate={18} />
        <Bloom x={110} y={138} r={15} color="var(--rose-soft)" deep="var(--rose)" rotate={-12} />
        <Bloom x={122} y={160} r={12} petals={5} color="var(--rose)" deep="color-mix(in oklab, var(--terracotta) 70%, var(--rose))" />
        <Bloom x={70} y={174} r={10} petals={5} color="var(--rose-soft)" />
        </g>
        <rect width="400" height="300" fill={`url(#l${f})`} />
      </g>
    </svg>
  );
}

/** Default illustration for the quote card: a potted bloom. */
export function PottedBloom({ className }: P) {
  const f = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden="true">
      <defs><Painterly id={f} /></defs>
      <g filter={`url(#${f})`}>
        <path d="M60 104 C 58 84 62 62 60 40" stroke="var(--forest)" strokeWidth="3" fill="none" />
        <Leaf x={60} y={92} len={30} rotate={-60} color="var(--sage)" />
        <Leaf x={60} y={84} len={28} rotate={58} color="var(--forest-soft)" />
        <Leaf x={60} y={66} len={20} rotate={-40} color="var(--forest-soft)" />
        <Bloom x={60} y={34} r={22} petals={8} color="var(--rose)" deep="var(--terracotta-deep)" />
        <Bloom x={34} y={62} r={10} petals={5} color="var(--marigold-soft)" deep="var(--marigold)" heart="var(--terracotta)" />
        <Bloom x={88} y={58} r={11} petals={6} color="var(--rose-soft)" />
        <path d="M34 104 L86 104 L80 136 L40 136 Z" fill="var(--forest)" />
        <path d="M30 100 L90 100 L90 110 L30 110 Z" fill="var(--forest-soft)" />
        <path d="M44 120 C 54 126 66 126 76 120" stroke="var(--marigold)" strokeWidth="2.5" fill="none" />
      </g>
    </svg>
  );
}

/** Tiny corner flourish for tiles. */
export function CornerBloom({ className }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <Leaf x={20} y={30} len={12} rotate={-60} />
      <Leaf x={20} y={30} len={11} rotate={50} color="var(--forest-soft)" />
      <Bloom x={20} y={18} r={8} petals={6} color="var(--rose)" />
    </svg>
  );
}

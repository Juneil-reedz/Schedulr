"use client";
import { useEffect, useState } from "react";
import { Check, ImagePlus, Palette, Trash2 } from "@/components/icons";
import { Button, Field, Input, Modal, Toggle, cn } from "./ui";
import { Bloom } from "./botanicals";
import { pickImage } from "@/lib/api";
import { useFileSrc, useNow } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { LayoutId, StyleId, ThemeId } from "@/lib/types";

export const THEMES: { id: ThemeId; name: string; note: string; swatch: string[] }[] = [
  { id: "marigold", name: "Marigold", note: "Warm plaster, terracotta and marigold", swatch: ["#f2e9db", "#bb6545", "#e5a72e", "#234b38"] },
  { id: "talavera", name: "Talavera", note: "White glaze with cobalt blue", swatch: ["#eef0f0", "#2f5d9e", "#e3b23c", "#1f3a5f"] },
  { id: "seaglass", name: "Sea glass", note: "Soft mint with coral and teal", swatch: ["#e9efe9", "#d9705a", "#e9b949", "#1f5c5a"] },
  { id: "desertrose", name: "Desert rose", note: "Blush clay with berry and olive", swatch: ["#f4e7e2", "#b5566a", "#d9a441", "#4d5a36"] },
  { id: "night", name: "Night garden", note: "Dark clay for the evening", swatch: ["#151d19", "#e38c64", "#e8b54a", "#c9dfc2"] },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

export function Avatar({ size = 44, className }: { size?: number; className?: string }) {
  const profile = useApp((s) => s.settings.profile);
  const src = useFileSrc(profile?.photo);
  const letters = initials(profile?.name ?? "").toUpperCase();
  return (
    <span
      className={cn("clay shape-pill grid shrink-0 place-items-center overflow-hidden", className)}
      style={{ width: size, height: size, ["--clay-fill" as string]: "var(--sage)" }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        letters ? (
          <span className="display text-on-dark" style={{ fontSize: size * 0.4 }}>
            {letters}
          </span>
        ) : (
          <svg viewBox="-14 -14 28 28" style={{ width: size * 0.62, height: size * 0.62 }}>
            <Bloom r={12} petals={6} />
          </svg>
        )
      )}
    </span>
  );
}

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** The name and picture in the top bar. Opens the profile editor. */
export function ProfileChip() {
  const profile = useApp((s) => s.settings.profile);
  const [open, setOpen] = useState(false);
  const now = useNow(60_000);
  const name = profile?.name?.trim();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press flex items-center gap-3 rounded-full py-1 pl-1 pr-4 hover:bg-cream-deep/70" aria-label={name ? `Your profile, ${name}` : "Set up your profile"}>
        <Avatar size={44} />
        <span className="hidden text-left min-[520px]:block">
          <span className="block text-xs text-muted">{greeting(now)}</span>
          <span className="block max-w-[180px] truncate text-md font-semibold text-forest">{name || "Add your name"}</span>
        </span>
      </button>
      <ProfileDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const profile = useApp((s) => s.settings.profile);
  const setSetting = useApp((s) => s.setSetting);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const [name, setName] = useState(profile?.name ?? "");
  const [photo, setPhoto] = useState<string | null>(profile?.photo ?? null);
  const preview = useFileSrc(photo);
  useEffect(() => {
    setName(profile?.name ?? "");
    setPhoto(profile?.photo ?? null);
  }, [profile?.name, profile?.photo]);

  async function choose() {
    try {
      const p = await pickImage();
      if (p) setPhoto(p);
    } catch (e) {
      fail(e);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await setSetting("profile", { name: name.trim(), photo });
      toast("Profile saved");
      onSaved?.();
    } catch (x) {
      fail(x);
    }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="clay shape-pill grid h-24 w-24 shrink-0 place-items-center overflow-hidden" style={{ ["--clay-fill" as string]: "var(--sage)" }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your profile picture" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials(name) ? (
              <span className="display text-4xl text-on-dark" aria-hidden>
                {initials(name).toUpperCase()}
              </span>
            ) : (
              <svg viewBox="-14 -14 28 28" className="h-14 w-14" aria-hidden>
                <Bloom r={12} petals={6} />
              </svg>
            )
          )}
        </span>
        <div className="flex flex-col items-start gap-1">
          <Button tone="clay" size="sm" onClick={choose}>
            <ImagePlus size={16} /> {photo ? "Change picture" : "Choose a picture"}
          </Button>
          {photo && (
            <Button tone="ghost" size="sm" onClick={() => setPhoto(null)}>
              Remove picture
            </Button>
          )}
        </div>
      </div>
      <Field label="Your name" htmlFor="profile-name" hint="Shown in the top bar with a greeting. It stays on this laptop.">
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should Schedulr call you?" autoComplete="name" />
      </Field>
      <div>
        <Button type="submit" tone="primary">
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Your profile" description="Your name and picture, kept on this laptop.">
      <ProfileForm onSaved={() => onOpenChange(false)} />
    </Modal>
  );
}

/** A choice card: the same frame for every option, a check on the chosen one. */
export function choiceClass(on: boolean) {
  return cn(
    "press relative rounded-[20px] p-2.5 text-left outline-offset-2 transition-colors",
    on ? "bg-cream-deep shadow-sunk outline-2 outline-terracotta" : "bg-[color-mix(in_oklab,var(--cream-deep)_45%,transparent)] hover:bg-cream-deep",
  );
}
export function Chosen({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span aria-hidden className="absolute -right-1.5 -top-1.5 z-[1] grid h-6 w-6 place-items-center rounded-full bg-terracotta text-on-dark shadow-raise">
      <Check size={14} strokeWidth={3} />
    </span>
  );
}

export function ThemePicker() {
  const theme = useApp((s) => s.settings.theme ?? "marigold");
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  return (
    <div role="radiogroup" aria-label="Original colours" className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-3">
      {THEMES.map((t) => {
        const on = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={t.note}
            onClick={() => setSetting("theme", t.id).catch(fail)}
            className={cn(choiceClass(on), "flex flex-col items-center gap-2")}
          >
            <Chosen on={on} />
            <span className="flex h-11 w-full overflow-hidden rounded-[12px] shadow-raise" aria-hidden>
              {t.swatch.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="text-center text-sm font-semibold leading-tight text-ink">{t.name}</span>
            <span className="sr-only">{t.note}</span>
          </button>
        );
      })}
    </div>
  );
}

export const STYLES: { id: StyleId; name: string; note: string }[] = [
  { id: "original", name: "Original", note: "Handmade clay, with five colour palettes." },
  { id: "soft3d", name: "Soft 3D", note: "Pastel mint and blush, soft and glossy." },
  { id: "glass", name: "Glass", note: "Frosted panels over your own picture." },
];

const SAMPLE_BG: Record<StyleId, string> = {
  original: "#f2e9db",
  soft3d: "linear-gradient(145deg, #fbe0d8, #dcefe4 55%, #cfe7da)",
  glass: "radial-gradient(70% 70% at 20% 85%, #f2a38c, transparent 70%), radial-gradient(80% 80% at 90% 10%, #f6d48a, transparent 70%), #f7e4c2",
};

/** A tiny drawing of each style, so the choice is visual. */
function StyleSample({ id }: { id: StyleId }) {
  if (id === "glass") {
    const bubble = (fill: string): React.CSSProperties => ({
      background: `radial-gradient(60% 45% at 35% 22%, rgb(255 255 255 / .85), transparent 70%), ${fill}`,
      boxShadow: "inset 0 -4px 6px rgb(255 255 255 / .35), inset 0 0 0 1px rgb(255 255 255 / .7), 0 5px 9px -4px rgb(120 80 30 / .45)",
    });
    return (
      <span aria-hidden className="relative block h-[74px] w-[112px] shrink-0 overflow-hidden rounded-[18px]" style={{ background: SAMPLE_BG.glass }}>
        <span
          className="absolute left-2.5 top-2.5 h-[54px] w-[54px] rounded-[14px]"
          style={{ background: "rgb(255 255 255 / .3)", backdropFilter: "blur(6px)", boxShadow: "inset 0 0 0 1.5px rgb(255 255 255 / .85), 0 6px 12px -6px rgb(120 80 30 / .4)" }}
        />
        <span className="absolute left-[18px] top-[18px] h-[18px] w-[18px] rounded-full" style={bubble("#f5b928")} />
        <span className="absolute left-[40px] top-[18px] h-[18px] w-[18px] rounded-full" style={bubble("#1d1a15")} />
        <span className="absolute left-[18px] top-[40px] h-[18px] w-[18px] rounded-full" style={bubble("#1d1a15")} />
        <span className="absolute left-[40px] top-[40px] h-[18px] w-[18px] rounded-full" style={bubble("#f5b928")} />
        <span className="absolute right-2.5 top-2.5 h-[54px] w-[30px] rounded-full" style={bubble("linear-gradient(180deg, rgb(255 255 255 / .35) 45%, #f5b928 45%)")} />
      </span>
    );
  }
  const soft = id === "soft3d";
  return (
    <span
      aria-hidden
      className="relative block h-[74px] w-[112px] shrink-0 overflow-hidden rounded-[18px]"
      style={{
        background: SAMPLE_BG[id],
        boxShadow: soft ? "inset 1px 1px 0 #fff, 6px 8px 16px -6px rgb(46 88 68 / .35)" : "inset 2px 3px 1px rgb(255 255 255/.6), 0 8px 14px -8px rgb(92 62 38 / .45)",
      }}
    >
      <span
        className="absolute left-2.5 top-2.5 h-[34px] w-[52px]"
        style={{
          borderRadius: soft ? 12 : "14px 18px 12px 20px / 16px 12px 18px 14px",
          background: soft ? "linear-gradient(150deg, #ffffff, #e6f1ea)" : "#f6ecdd",
          boxShadow: soft ? "-3px -3px 6px #fff, 5px 6px 10px -2px rgb(46 88 68 / .3)" : "inset 1px 2px 0 #fff, 0 6px 8px -5px rgb(92 62 38 / .5)",
        }}
      />
      <span
        className="absolute bottom-2.5 left-2.5 h-[18px] w-[40px] rounded-full"
        style={{ background: soft ? "linear-gradient(180deg, #6fb791, #3a8a66)" : "#bb6545" }}
      />
      <span
        className="absolute right-2.5 top-2.5 h-[54px] w-[36px]"
        style={{
          borderRadius: soft ? 12 : "16px 12px 18px 12px / 12px 18px 12px 16px",
          background: soft ? "linear-gradient(150deg, #fde9e3, #f4c0ab)" : "#e5a72e",
          boxShadow: soft ? "4px 6px 10px -3px rgb(46 88 68 / .28)" : "0 6px 8px -5px rgb(92 62 38 / .5)",
        }}
      />
    </span>
  );
}

export function StylePicker() {
  const style = useApp((s) => s.settings.style ?? "original");
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 @md:grid-cols-3">
      {STYLES.map((t) => {
        const on = style === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setSetting("style", t.id).catch(fail)}
            className={cn(choiceClass(on), "flex items-center gap-3 @md:flex-col @md:items-stretch @md:gap-2.5")}
          >
            <Chosen on={on} />
            <span className="grid h-[86px] w-[132px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[color-mix(in_oklab,var(--cream)_70%,transparent)] @md:w-full">
              <StyleSample id={t.id} />
            </span>
            <span className="min-w-0 @md:px-1 @md:pb-1">
              <span className="block text-md font-semibold text-ink">{t.name}</span>
              <span className="block text-xs leading-snug text-muted">{t.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One click moves to the next theme, in the top bar. */
export function StyleToggle() {
  const style = useApp((s) => s.settings.style ?? "original");
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const i = STYLES.findIndex((t) => t.id === style);
  const next = STYLES[(i + 1) % STYLES.length];
  const label = `Switch to the ${next.name} theme`;
  return (
    <Button tone="clay" size="icon" aria-label={label} title={label} onClick={() => setSetting("style", next.id).catch(fail)}>
      <Palette size={19} />
    </Button>
  );
}

/** The picture behind every page. Sits under all content and never takes clicks. */
export function Backdrop() {
  const backdrop = useApp((s) => s.settings.backdrop);
  const src = useFileSrc(backdrop?.image);
  useEffect(() => {
    document.documentElement.dataset.backdrop = src ? "image" : "none";
  }, [src]);
  if (!src) return null;
  return (
    <div aria-hidden className="backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute -inset-10 bg-cover bg-center"
        style={{ backgroundImage: `url("${src}")`, filter: backdrop?.blur ? "blur(18px) saturate(1.15)" : undefined }}
      />
      <div className="backdrop-veil absolute inset-0" />
    </div>
  );
}

/** Choose, soften or remove the background picture. */
export function BackdropPicker() {
  const backdrop = useApp((s) => s.settings.backdrop) ?? { image: null, blur: true };
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const src = useFileSrc(backdrop.image);
  async function choose() {
    try {
      const p = await pickImage();
      if (p) await setSetting("backdrop", { ...backdrop, image: p });
    } catch (e) {
      fail(e);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="clay-sunk relative grid h-[84px] w-[132px] shrink-0 place-items-center overflow-hidden rounded-[18px]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Current background picture" className="h-full w-full object-cover" style={backdrop.blur ? { filter: "blur(3px)", scale: "1.08" } : undefined} />
        ) : (
          <span className="px-2 text-center text-xs text-muted">No picture</span>
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={choose}>
            <ImagePlus size={16} /> {src ? "Change picture" : "Choose a picture"}
          </Button>
          {src && (
            <Button type="button" size="sm" onClick={() => setSetting("backdrop", { ...backdrop, image: null }).catch(fail)}>
              <Trash2 size={16} /> Remove
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <Toggle label="Soften the picture" checked={backdrop.blur} onChange={(v) => setSetting("backdrop", { ...backdrop, blur: v }).catch(fail)} />
          Soften the picture
        </label>
      </div>
    </div>
  );
}

export const LAYOUTS: { id: LayoutId; name: string; note: string }[] = [
  { id: "sidebar", name: "Sidebar", note: "Navigation down the left, the dashboard in three columns." },
  { id: "topbar", name: "Top bar", note: "Navigation across the top, the dashboard as a wide grid." },
  { id: "compact", name: "Compact", note: "A slim icon rail and cards packed closer together." },
];

const LAYOUT_BLOCKS: Record<LayoutId, { nav: number[]; blocks: number[][] }> = {
  sidebar: { nav: [6, 10, 7, 44], blocks: [[20, 8, 32, 30], [20, 42, 32, 14], [56, 8, 16, 20], [56, 32, 16, 24], [76, 8, 14, 48]] },
  topbar: { nav: [26, 6, 44, 7], blocks: [[8, 18, 38, 9], [49, 18, 19, 9], [71, 18, 18, 9], [8, 31, 38, 26], [49, 31, 19, 26], [71, 31, 18, 26]] },
  compact: { nav: [5, 14, 5, 36], blocks: [[15, 6, 23, 22], [15, 31, 23, 27], [41, 6, 23, 14], [41, 23, 23, 35], [67, 6, 23, 30], [67, 39, 23, 19]] },
};

/** A small wireframe of each layout. */
function LayoutSample({ id }: { id: LayoutId }) {
  const { nav, blocks } = LAYOUT_BLOCKS[id];
  const box = ([left, top, width, height]: number[]) => ({ left, top, width, height });
  return (
    <span aria-hidden className="clay-sunk relative block h-[64px] w-[96px] shrink-0 overflow-hidden rounded-[14px]">
      <span className="absolute rounded-full bg-terracotta" style={box(nav)} />
      {blocks.map((b, i) => (
        <span key={i} className="absolute rounded-[4px] bg-[color-mix(in_oklab,var(--forest)_22%,transparent)]" style={box(b)} />
      ))}
    </span>
  );
}

export function LayoutPicker() {
  const layout = useApp((s) => s.settings.layout ?? "sidebar");
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  return (
    <div role="radiogroup" aria-label="Layout" className="grid grid-cols-1 gap-3 @md:grid-cols-3">
      {LAYOUTS.map((l) => {
        const on = layout === l.id;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setSetting("layout", l.id).catch(fail)}
            className={cn(choiceClass(on), "flex items-center gap-3 @md:flex-col @md:items-stretch @md:gap-2.5")}
          >
            <Chosen on={on} />
            <span className="grid h-[86px] w-[132px] shrink-0 place-items-center rounded-[14px] bg-[color-mix(in_oklab,var(--cream)_70%,transparent)] @md:w-full">
              <LayoutSample id={l.id} />
            </span>
            <span className="min-w-0 @md:px-1 @md:pb-1">
              <span className="block text-md font-semibold text-ink">{l.name}</span>
              <span className="block text-xs leading-snug text-muted">{l.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

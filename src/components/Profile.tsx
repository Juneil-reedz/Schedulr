"use client";
import { useEffect, useState } from "react";
import { ImagePlus, Palette } from "@/components/icons";
import { Button, Field, Input, Modal, cn } from "./ui";
import { Bloom } from "./botanicals";
import { pickImage } from "@/lib/api";
import { useFileSrc, useNow } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { StyleId, ThemeId } from "@/lib/types";

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

export function ThemePicker() {
  const theme = useApp((s) => s.settings.theme ?? "marigold");
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  return (
    <div role="radiogroup" aria-label="Original colours" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {THEMES.map((t) => {
        const on = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setSetting("theme", t.id).catch(fail)}
            className={cn("press flex items-center gap-3 rounded-[20px] p-3 text-left", on ? "bg-cream-deep shadow-sunk outline-2 outline-offset-2 outline-terracotta" : "hover:bg-cream-deep/60")}
          >
            <span className="flex shrink-0 overflow-hidden rounded-[14px] shadow-raise" aria-hidden>
              {t.swatch.map((c) => (
                <span key={c} className="h-12 w-5" style={{ background: c }} />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block text-md font-semibold text-ink">{t.name}</span>
              <span className="block text-xs text-muted">{t.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const STYLES: { id: StyleId; name: string; note: string }[] = [
  { id: "original", name: "Original", note: "The handmade clay look, with the colour palettes below." },
  { id: "soft3d", name: "Soft 3D", note: "Pastel mint and blush, glossy rounded surfaces and floating cards." },
];

/** A tiny drawing of each style, so the choice is visual. */
function StyleSample({ id }: { id: StyleId }) {
  const soft = id === "soft3d";
  return (
    <span
      aria-hidden
      className="relative block h-[74px] w-[112px] shrink-0 overflow-hidden rounded-[18px]"
      style={{
        background: soft ? "linear-gradient(145deg, #fbe0d8, #dcefe4 55%, #cfe7da)" : "#f2e9db",
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
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {STYLES.map((t) => {
        const on = style === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setSetting("style", t.id).catch(fail)}
            className={cn("press flex items-center gap-3.5 rounded-[22px] p-3 text-left", on ? "bg-cream-deep shadow-sunk outline-2 outline-offset-2 outline-terracotta" : "hover:bg-cream-deep/60")}
          >
            <StyleSample id={t.id} />
            <span className="min-w-0">
              <span className="block text-md font-semibold text-ink">{t.name}</span>
              <span className="block text-xs text-muted">{t.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One-click switch between the two themes, in the top bar. */
export function StyleToggle() {
  const style = useApp((s) => s.settings.style ?? "original");
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const next: StyleId = style === "soft3d" ? "original" : "soft3d";
  const label = `Switch to the ${next === "soft3d" ? "Soft 3D" : "Original"} theme`;
  return (
    <Button tone="clay" size="icon" aria-label={label} title={label} onClick={() => setSetting("style", next).catch(fail)}>
      <Palette size={19} />
    </Button>
  );
}

"use client";
/* The opening screen's state. Other parts (Pip's greeting, the update window) wait until
   it has finished, so nothing talks or pops up behind it. */
import { create } from "zustand";

const KEY = "schedulr.intro";

/** Whether the opening screen plays (Settings > Opening animation). Kept in local storage
    so it is known before the planner's settings load. */
export function introEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setIntroEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* a preference, not essential */
  }
}

export const useIntro = create<{ done: boolean; finish: () => void }>((set) => ({
  done: typeof window === "undefined" ? true : !introEnabled(),
  finish: () => set({ done: true }),
}));

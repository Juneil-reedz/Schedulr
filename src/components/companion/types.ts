import type { Mood } from "@/lib/companion/lines";

/** What the body is doing, apart from the face's mood. */
export type Motion = "sit" | "walk" | "jump" | "held" | "fall";

export interface CharacterProps {
  mood: Mood;
  speaking: boolean;
  word: number;
  sass: boolean;
  /** Changes with each new line, to replay one-off gestures. */
  cue: number;
  motion: Motion;
  /** Changes on each pat, for a happy hop. */
  pat: number;
}

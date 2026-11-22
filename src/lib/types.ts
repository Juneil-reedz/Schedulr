export type Scope = "work" | "personal";

export interface Category {
  id: string;
  name: string;
  color: string;
  scope: Scope;
}

export interface Participant {
  name: string;
  email: string;
}

export type Freq = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
  freq: Freq;
  interval: number;
  weekdays: number[];
  until: string | null;
  count: number | null;
}

export interface ReminderSpec {
  id: string;
  offsetMinutes: number | null;
  at: string | null;
}

export type EventKind = "event" | "meeting";
export type LocationType = "none" | "physical" | "online" | "hybrid";

export interface SchedEvent {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  categoryId: string | null;
  /** "YYYY-MM-DDTHH:MM", or "YYYY-MM-DD" for all-day events (end inclusive). */
  start: string;
  end: string;
  allDay: boolean;
  locationType: LocationType;
  location: string;
  meetingUrl: string;
  participants: Participant[];
  agenda: string;
  recur: Recurrence;
  important: boolean;
  imagePath: string | null;
  reminders: ReminderSpec[];
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  key: string;
  event: SchedEvent;
  start: string;
  end: string;
  conflict: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  categoryId: string | null;
  due: string | null;
  priority: number;
  done: boolean;
  doneAt: string | null;
  eventId: string | null;
  recur: Recurrence;
  remindOffset: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  kind: "quote" | "note";
  body: string;
  author: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReminderStatus = "upcoming" | "fired" | "missed" | "silenced" | "snoozed" | "dismissed" | "done";

export interface ReminderItem {
  key: string;
  sourceKind: "event" | "task" | "overdue";
  sourceId: string;
  title: string;
  body: string;
  fireAt: string;
  status: ReminderStatus;
  snoozeUntil: string | null;
  categoryId: string | null;
  startsAt: string | null;
}

export interface Focus {
  dnd: boolean;
  work: boolean;
  personal: boolean;
  sleep: boolean;
}

export interface WeatherSettings {
  enabled: boolean;
  place: string;
  lat: number | null;
  lon: number | null;
  unit: "celsius" | "fahrenheit";
}

export interface WeatherReading {
  temp: number;
  code: number;
  isDay: boolean;
  unit: "celsius" | "fahrenheit";
  at: string;
  place: string;
}

export interface ComposioSettings {
  apiKey: string;
  userId: string;
}

/** The overall look: the original clay, Soft 3D, or Glass. */
export type StyleId = "original" | "soft3d" | "glass";

/** Pip, the royal herald who reads out the schedule. */
export interface CompanionSettings {
  enabled: boolean;
  voice: boolean;
  /** A voice name from the computer, or null for the best available. */
  voiceName: string | null;
  pitch: "low" | "normal" | "high";
  /** Which royals Pip compares you to. */
  title: "queen" | "king" | "monarch";
  /** When Pip last greeted, so the full greeting happens once a day. */
  lastGreet?: string;
}

/** A picture shown behind every page, in any theme. */
export interface Backdrop {
  /** Stored attachment path, or a data URL in the browser preview. */
  image: string | null;
  /** Soften the picture so text stays easy to read. */
  blur: boolean;
}

/** How pages are arranged. Every layout has the same pages and features. */
export type LayoutId = "sidebar" | "topbar" | "compact";

export type ThemeId = "marigold" | "talavera" | "seaglass" | "desertrose" | "night";

export interface Profile {
  name: string;
  /** Stored attachment path, or a data URL in the browser preview. */
  photo: string | null;
}

export interface Settings {
  style?: StyleId;
  layout?: LayoutId;
  theme?: ThemeId;
  profile?: Profile;
  backdrop?: Backdrop;
  companion?: Partial<CompanionSettings>;
  /** The newest version the person was already told about. */
  updateNotified?: string;
  focus?: Focus;
  closeToTray?: boolean;
  snoozeMinutes?: number;
  clock24h?: boolean;
  weather?: WeatherSettings;
  weatherLast?: WeatherReading;
  featuredImage?: string | null;
  quoteImage?: string | null;
  composio?: ComposioSettings;
  [key: string]: unknown;
}

export interface Paths {
  data: string;
  db: string;
  attachments: string;
  backups: string;
  exports: string;
}

export interface Boot {
  settings: Settings;
  categories: Category[];
  paths: Paths;
  version: string;
  timezone: string;
}

export interface Battery {
  percent: number;
  charging: boolean;
}

export interface BackupFile {
  path: string;
  name: string;
  size: number;
  modified: string;
}

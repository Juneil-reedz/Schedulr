/* What Pip, the royal herald, says. Majestic, playful, a little sarcastic.
   Every line is short. Placeholders: {Hon} "Ma'am" or "Sir", {Title} the honorific with
   the first name ("Ma'am Danda", or just "Ma'am"), {name} the first name (or the
   honorific when there is none), {rulers} queens or kings,
   {title} an event or reminder, {time}, {mins}, {count}, {things}. */

export type Mood = "idle" | "greeting" | "talking" | "happy" | "surprised" | "sleepy";

export type Topic =
  | "greetMorning"
  | "greetAfternoon"
  | "greetEvening"
  | "greetNight"
  | "welcomeBack"
  | "busy"
  | "some"
  | "one"
  | "empty"
  | "tasksOnly"
  | "dueToday"
  | "overdue"
  | "missed"
  | "soon"
  | "now"
  | "reminder"
  | "taskDone"
  | "allDone"
  | "quipNext"
  | "quipOverdue"
  | "quipFree"
  | "quipAny"
  | "pat";

export const MOOD: Record<Topic, Mood> = {
  greetMorning: "greeting",
  greetAfternoon: "greeting",
  greetEvening: "greeting",
  greetNight: "greeting",
  welcomeBack: "greeting",
  busy: "surprised",
  some: "talking",
  one: "talking",
  empty: "sleepy",
  tasksOnly: "talking",
  dueToday: "talking",
  overdue: "surprised",
  missed: "surprised",
  soon: "surprised",
  now: "surprised",
  reminder: "surprised",
  taskDone: "happy",
  allDone: "happy",
  quipNext: "talking",
  quipOverdue: "talking",
  quipFree: "sleepy",
  quipAny: "talking",
  pat: "happy",
};

export const LINES: Record<Topic, string[]> = {
  greetMorning: [
    "{Title}! Your royal scheduler has arrived. Let's see what chaos awaits us today!",
    "Good morning, {Hon}! The kingdom is awake. The coffee, less so. Let's review the royal agenda.",
    "Hail, {Title}! I have polished my crown and your calendar. Only one of them was dusty.",
    "Rise and reign, {Title}! Your humble herald reporting for duty.",
  ],
  greetAfternoon: [
    "Good afternoon, {Hon}! Your royal scheduler has arrived, fashionably late, as is tradition.",
    "Ah, {Title}! The afternoon court is now in session. Let's see what's on the menu.",
    "{Title}! Half the day is gone. Let's make the other half look intentional.",
  ],
  greetEvening: [
    "Good evening, {Hon}! Still ruling at this hour? Bold. Let's see what's left.",
    "Ah, {Title}, the evening court opens. Candles lit, calendar ready.",
    "Evening, {Hon}! The sun has clocked out. We, apparently, have not.",
  ],
  greetNight: [
    "{Title}, it is very late. Even the moon is yawning. A quick look, then bed?",
    "Burning the royal midnight oil, {Title}? I'll keep it brief. Mostly.",
  ],
  welcomeBack: [
    "Back so soon, {Hon}? I kept your throne warm.",
    "Welcome back, {Title}. Nothing exploded while you were away. Mostly.",
    "The royal herald returns to duty! As do you, apparently.",
    "Ah, {Title}! I was just guarding your calendar. Fiercely. With my leaves.",
  ],
  busy: [
    "Oh, {Hon}! Your schedule is busier than a royal banquet. {count} missions await you today!",
    "{count} things today, {Title}. I'd fetch you a second crown, but you'd only schedule it.",
    "Brace yourself, {Hon}: {count} items today. The royal calendar is sweating.",
  ],
  some: [
    "You have {things} today, {Title}. First up: {title} at {time}.",
    "A civilised day, {Hon}: {things}. We begin with {title} at {time}.",
    "The royal agenda holds {things}, {Title}. Opening act: {title} at {time}.",
  ],
  one: [
    "Just one thing today, {Title}: {title} at {time}. A delightfully light royal workload.",
    "One appointment, {Hon}: {title} at {time}. Practically a holiday.",
  ],
  empty: [
    "Well, well, {Hon}! Nothing on your schedule today. Even {rulers} deserve a day off!",
    "An empty calendar, {Title}. I shall nap in solidarity.",
    "No events, no meetings. {Hon}, this is either peace or a conspiracy.",
  ],
  tasksOnly: [
    "No events today, {Title}, but {things} due. They're looking at you.",
    "A calendar free of events, {Hon}! Just {things} due. A royal stroll, really.",
  ],
  dueToday: [
    "Also, {things} due today. They're looking at you.",
    "And {things} due today, {Title}. No pressure. Some pressure.",
  ],
  overdue: [
    "Oh, and {things} overdue. They've started a small rebellion.",
    "Also, {things} overdue, {Hon}. The peasants are restless.",
  ],
  missed: [
    "While you were away, {count} reminders went off. I shouted. Nobody heard.",
    "{Hon}, {count} reminders rang while you were gone. They're waiting in Reminders.",
  ],
  soon: [
    "Psst! {Title}! {title} starts in {mins} minutes. The royal clock waits for no one!",
    "Heads up, {Hon}! {title} in {mins} minutes. Do try to look surprised.",
    "{mins} minutes until {title}, {Title}. Shall I sound the trumpets? I can't. But imagine them.",
  ],
  now: [
    "{title} is starting now, {Hon}! Go, go, go! Majestically!",
    "It's time, {Title}: {title}. Off you go, crown first.",
  ],
  reminder: [
    "Royal reminder, {Title}: {title}!",
    "Hear ye, hear ye! {title}. That's the reminder. Carry on.",
    "{Hon}, a reminder has arrived by royal pigeon: {title}.",
  ],
  taskDone: [
    "Splendid work, {Hon}! Another task conquered. Your kingdom is proud!",
    "Task vanquished! {Title}, the bards will sing of this. Briefly.",
    "Done and dusted! I'd applaud, but I'm a flower.",
    "Another one bites the royal dust. Well done, {Title}!",
  ],
  allDone: [
    "Every task done, {Hon}! I'm genuinely impressed. Don't get used to it.",
    "The task list is empty, {Title}! The kingdom celebrates. I celebrate. Mildly.",
  ],
  quipNext: [
    "Next on the royal agenda: {title} at {time}. Plenty of time. Suspiciously plenty.",
    "Just so you know, {Title}: {title} at {time}. I'll be here. Watching. Lovingly.",
  ],
  quipOverdue: [
    "Gentle reminder, {Title}: {things} overdue. They've started a book club.",
    "{Hon}, {things} overdue. I'm not saying anything. I'm just saying it.",
  ],
  quipFree: [
    "Nothing left today, {Hon}. The rest is royal leisure. Use it wisely. Or don't.",
    "Your afternoon is free, {Title}. I've cleared my schedule too. It was empty.",
  ],
  pat: [
    "Hehe! That tickles, {Hon}!",
    "A royal pat! I accept it graciously.",
    "Careful, {Title}, the crown is on loan.",
    "Ooh, more of that, please. For morale.",
    "You may pat the herald. Once. Okay, twice.",
  ],
  quipAny: [
    "Remember to drink water, {Hon}. Hydrated {rulers} rule better.",
    "I've checked the calendar twice, {Title}. It's still there.",
    "Posture check, {Hon}! Crowns slide off slouching heads.",
  ],
};

const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function things(n: number, noun: string) {
  const word = n <= 10 ? NUM[n] : String(n);
  return `${word} ${noun}${n === 1 ? "" : "s"}`;
}

export interface Vars {
  title?: string;
  time?: string;
  mins?: number;
  count?: number;
  things?: string;
}

export interface Address {
  honorific: string;
  /** Honorific and first name together, e.g. "Ma'am Danda". */
  title: string;
  name: string;
  rulers: string;
}

/* Remembers the last few lines of each topic so Pip does not repeat itself. */
const RECENT_KEY = "schedulr.pip.recent";
function recent(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "{}");
  } catch {
    return {};
  }
}

export function compose(topic: Topic, addr: Address, vars: Vars = {}) {
  const pool = LINES[topic];
  const mem = recent();
  const used = mem[topic] ?? [];
  const fresh = pool.map((_, i) => i).filter((i) => !used.includes(i));
  const choices = fresh.length ? fresh : pool.map((_, i) => i).filter((i) => i !== used[used.length - 1]);
  const pick = choices[Math.floor(Math.random() * choices.length)] ?? 0;
  mem[topic] = [...used, pick].slice(-Math.max(1, pool.length - 1));
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(mem));
  } catch {
    /* memory is a nicety */
  }
  const text = pool[pick]
    .replaceAll("{Title}", addr.title)
    .replaceAll("{Hon}", addr.honorific)
    .replaceAll("{name}", addr.name)
    .replaceAll("{rulers}", addr.rulers)
    .replaceAll("{title}", vars.title ?? "")
    .replaceAll("{time}", vars.time ?? "")
    .replaceAll("{mins}", String(vars.mins ?? ""))
    .replaceAll("{count}", String(vars.count ?? ""))
    .replaceAll("{things}", vars.things ?? "");
  // A capital letter after the honorific starts a sentence ("{Title}!" can start one too).
  return text.charAt(0).toUpperCase() + text.slice(1);
}

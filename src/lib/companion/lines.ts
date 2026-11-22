/* What Pip, the royal herald, says. Majestic, playful, a little sarcastic.
   Every line is short. Placeholders: {Majesty} the honorific, {name} the person's first
   name (or the honorific when there is none), {rulers} queens / kings / monarchs,
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
  | "quipAny";

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
};

export const LINES: Record<Topic, string[]> = {
  greetMorning: [
    "{Majesty}, {name}! Your royal scheduler has arrived. Let's see what chaos awaits us today!",
    "Good morning, {Majesty}! The kingdom is awake. The coffee, less so. Let's review the royal agenda.",
    "Hail, {name}! I have polished my crown and your calendar. Only one of them was dusty.",
    "Rise and reign, {name}! Your humble herald reporting for duty.",
  ],
  greetAfternoon: [
    "Good afternoon, {Majesty}! Your royal scheduler has arrived, fashionably late, as is tradition.",
    "Ah, {name}! The afternoon court is now in session. Let's see what's on the menu.",
    "{Majesty}, {name}! Half the day is gone. Let's make the other half look intentional.",
  ],
  greetEvening: [
    "Good evening, {Majesty}! Still ruling at this hour? Bold. Let's see what's left.",
    "Ah, {name}, the evening court opens. Candles lit, calendar ready.",
    "Evening, {Majesty}! The sun has clocked out. We, apparently, have not.",
  ],
  greetNight: [
    "{Majesty}, {name}, it is very late. Even the moon is yawning. A quick look, then bed?",
    "Burning the royal midnight oil, {name}? I'll keep it brief. Mostly.",
  ],
  welcomeBack: [
    "Back so soon, {Majesty}? I kept your throne warm.",
    "Welcome back, {name}. Nothing exploded while you were away. Mostly.",
    "The royal herald returns to duty! As do you, apparently.",
    "Ah, {name}! I was just guarding your calendar. Fiercely. With my leaves.",
  ],
  busy: [
    "Oh, {Majesty}! Your schedule is busier than a royal banquet. {count} missions await you today!",
    "{count} things today, {name}. I'd fetch you a second crown, but you'd only schedule it.",
    "Brace yourself, {Majesty}: {count} items today. The royal calendar is sweating.",
  ],
  some: [
    "You have {things} today, {name}. First up: {title} at {time}.",
    "A civilised day, {Majesty}: {things}. We begin with {title} at {time}.",
    "The royal agenda holds {things}, {name}. Opening act: {title} at {time}.",
  ],
  one: [
    "Just one thing today, {name}: {title} at {time}. A delightfully light royal workload.",
    "One appointment, {Majesty}: {title} at {time}. Practically a holiday.",
  ],
  empty: [
    "Well, well, {Majesty}! Nothing on your schedule today. Even {rulers} deserve a day off!",
    "An empty calendar, {name}. I shall nap in solidarity.",
    "No events, no meetings. {Majesty}, this is either peace or a conspiracy.",
  ],
  tasksOnly: [
    "No events today, {name}, but {things} due. They're looking at you.",
    "A calendar free of events, {Majesty}! Just {things} due. A royal stroll, really.",
  ],
  dueToday: [
    "Also, {things} due today. They're looking at you.",
    "And {things} due today, {name}. No pressure. Some pressure.",
  ],
  overdue: [
    "Oh, and {things} overdue. They've started a small rebellion.",
    "Also, {things} overdue, {Majesty}. The peasants are restless.",
  ],
  missed: [
    "While you were away, {count} reminders went off. I shouted. Nobody heard.",
    "{Majesty}, {count} reminders rang while you were gone. They're waiting in Reminders.",
  ],
  soon: [
    "Psst! {name}! {title} starts in {mins} minutes. The royal clock waits for no one!",
    "Heads up, {Majesty}! {title} in {mins} minutes. Do try to look surprised.",
    "{mins} minutes until {title}, {name}. Shall I sound the trumpets? I can't. But imagine them.",
  ],
  now: [
    "{title} is starting now, {Majesty}! Go, go, go! Majestically!",
    "It's time, {name}: {title}. Off you go, crown first.",
  ],
  reminder: [
    "Royal reminder, {name}: {title}!",
    "Hear ye, hear ye! {title}. That's the reminder. Carry on.",
    "{Majesty}, a reminder has arrived by royal pigeon: {title}.",
  ],
  taskDone: [
    "Splendid work, {Majesty}! Another task conquered. Your kingdom is proud!",
    "Task vanquished! {name}, the bards will sing of this. Briefly.",
    "Done and dusted! I'd applaud, but I'm a flower.",
    "Another one bites the royal dust. Well done, {name}!",
  ],
  allDone: [
    "Every task done, {Majesty}! I'm genuinely impressed. Don't get used to it.",
    "The task list is empty, {name}! The kingdom celebrates. I celebrate. Mildly.",
  ],
  quipNext: [
    "Next on the royal agenda: {title} at {time}. Plenty of time. Suspiciously plenty.",
    "Just so you know, {name}: {title} at {time}. I'll be here. Watching. Lovingly.",
  ],
  quipOverdue: [
    "Gentle reminder, {name}: {things} overdue. They've started a book club.",
    "{Majesty}, {things} overdue. I'm not saying anything. I'm just saying it.",
  ],
  quipFree: [
    "Nothing left today, {Majesty}. The rest is royal leisure. Use it wisely. Or don't.",
    "Your afternoon is free, {name}. I've cleared my schedule too. It was empty.",
  ],
  quipAny: [
    "Remember to drink water, {Majesty}. Hydrated {rulers} rule better.",
    "I've checked the calendar twice, {name}. It's still there.",
    "Posture check, {Majesty}! Crowns slide off slouching heads.",
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
    .replaceAll("{Majesty}", addr.honorific)
    .replaceAll("{name}", addr.name)
    .replaceAll("{rulers}", addr.rulers)
    .replaceAll("{title}", vars.title ?? "")
    .replaceAll("{time}", vars.time ?? "")
    .replaceAll("{mins}", String(vars.mins ?? ""))
    .replaceAll("{count}", String(vars.count ?? ""))
    .replaceAll("{things}", vars.things ?? "");
  // A capital letter after the honorific starts a sentence ("{name}!" can start one too).
  return text.charAt(0).toUpperCase() + text.slice(1);
}

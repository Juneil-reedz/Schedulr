// Hash routes for the single-page preview. "settings" is reserved by claude.ai, so that page is #preferences.
export const ROUTES: Record<string, string> = {
  "/": "dashboard", "/calendar/": "calendar", "/events/": "events", "/meetings/": "meetings",
  "/reminders/": "reminders", "/tasks/": "tasks", "/notepad/": "notepad", "/settings/": "preferences",
};
export function toHash(href: string) {
  const path = href.split("#")[0] || "/";
  return `#${ROUTES[path] ?? "dashboard"}`;
}
export function currentPath() {
  const h = (typeof location !== "undefined" ? location.hash : "").replace("#", "");
  return Object.keys(ROUTES).find((k) => ROUTES[k] === h) ?? "/";
}

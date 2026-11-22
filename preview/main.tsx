import { createRoot } from "react-dom/client";
import { Shell } from "@/components/Shell";
import Dashboard from "@/app/page";
import CalendarPage from "@/app/calendar/page";
import EventsPage from "@/app/events/page";
import MeetingsPage from "@/app/meetings/page";
import RemindersPage from "@/app/reminders/page";
import TasksPage from "@/app/tasks/page";
import NotepadPage from "@/app/notepad/page";
import SettingsPage from "@/app/settings/page";
import { usePathname } from "./next-navigation";

const PAGES: Record<string, () => React.JSX.Element> = {
  "/": Dashboard, "/calendar/": CalendarPage, "/events/": EventsPage, "/meetings/": MeetingsPage,
  "/reminders/": RemindersPage, "/tasks/": TasksPage, "/notepad/": NotepadPage, "/settings/": SettingsPage,
};

function App() {
  const path = usePathname();
  const Page = PAGES[path] ?? Dashboard;
  return <Shell><Page key={path} /></Shell>;
}

createRoot(document.getElementById("root")!).render(<App />);

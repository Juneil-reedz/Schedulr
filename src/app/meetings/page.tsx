"use client";
import { addDays } from "date-fns";
import { ListOrdered, MapPin, Plus, Users, Video } from "@/components/icons";
import { EventList } from "@/components/EventList";
import { PageHeader } from "@/components/Shell";
import { Button, SectionTitle } from "@/components/ui";
import { useOccurrences } from "@/components/widgets/calendar";
import { openUrl } from "@/lib/api";
import { countdown, fmtTime, parse, relDay } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import { useApp } from "@/lib/store";

export default function MeetingsPage() {
  const openEvent = useApp((s) => s.openEvent);
  const h24 = useApp((s) => s.settings.clock24h ?? false);
  const now = useNow(30_000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const occ = useOccurrences(today, addDays(today, 14)).filter((o) => o.event.kind === "meeting" && parse(o.end) > now);
  return (
    <>
      <PageHeader title="Meetings" help={<><p>Your meetings in the next two weeks, with the people, the agenda and a Join button for the meeting link.</p><p>Below them is every meeting you have saved.</p></>}>
        <Button tone="primary" onClick={() => openEvent({ kind: "meeting" })}>
          <Plus size={18} /> New meeting
        </Button>
      </PageHeader>
      <SectionTitle className="mb-3">Next two weeks</SectionTitle>
      {occ.length === 0 ? (
        <p className="clay shape-a mb-8 px-7 py-6 text-muted">No meetings in the next two weeks.</p>
      ) : (
        <ul className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {occ.slice(0, 9).map((o) => {
            const s = parse(o.start), e = parse(o.end);
            const agenda = o.event.agenda.split("\n").map((l) => l.trim()).filter(Boolean);
            return (
              <li key={o.key} className="clay shape-b clay-lift flex flex-col px-6 py-5">
                <p className="text-sm font-semibold text-terracotta">
                  {relDay(s, now)}, {fmtTime(s, h24)} to {fmtTime(e, h24)}
                </p>
                <h3 className="display mt-1 text-2xl leading-snug text-forest">{o.event.title}</h3>
                <p className="num mt-0.5 text-sm text-muted">{s <= now ? "Happening now" : countdown(s, now)}</p>
                {o.event.participants.length > 0 && (
                  <p className="mt-3 flex items-start gap-2 text-sm text-ink">
                    <Users size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    {o.event.participants.map((p) => p.name || p.email).join(", ")}
                  </p>
                )}
                {o.event.location && (
                  <p className="mt-1.5 flex items-start gap-2 text-sm text-ink">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden /> {o.event.location}
                  </p>
                )}
                {agenda.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 text-sm text-ink">
                    <ListOrdered size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    <ol className="list-inside list-decimal">
                      {agenda.slice(0, 4).map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {o.event.meetingUrl && (
                    <Button tone="forest" size="sm" onClick={() => openUrl(o.event.meetingUrl)}>
                      <Video size={15} /> Join
                    </Button>
                  )}
                  <Button tone="clay" size="sm" onClick={() => openEvent(o.event)}>
                    Details
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <SectionTitle className="mb-3">All meetings</SectionTitle>
      <EventList kind="meeting" />
    </>
  );
}

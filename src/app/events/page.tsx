"use client";
import { Plus } from "@/components/icons";
import { EventList } from "@/components/EventList";
import { PageHeader } from "@/components/Shell";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/store";

export default function EventsPage() {
  const openEvent = useApp((s) => s.openEvent);
  return (
    <>
      <PageHeader title="Events" help={<><p>Every event and meeting you have saved. Search by title, place, person or agenda, and filter by category.</p><p>From here you can edit, duplicate or delete an event, or save an .ics file to send as an invitation.</p></>}>
        <Button tone="primary" onClick={() => openEvent({ kind: "event" })}>
          <Plus size={18} /> New event
        </Button>
      </PageHeader>
      <EventList />
    </>
  );
}

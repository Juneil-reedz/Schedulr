"use client";
import { format, isSameDay } from "date-fns";
import { ImagePlus, MapPin, Video } from "@/components/icons";
import { PaintedDoorway } from "../botanicals";
import { Button, Help, cn } from "../ui";
import { pickImage } from "@/lib/api";
import { countdown, fmtTime, parse, relDay } from "@/lib/dates";
import { useFileSrc, useNow } from "@/lib/hooks";
import { useApp, useVisible } from "@/lib/store";

const svg = (d: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${d}'/></svg>`)}")`;

/* The wavy frame from the reference, as a stretchable mask. */
const OUTER = svg(
  "M9 5 C22 1 38 5 54 3 C70 1 87 -1 95 7 C101 15 94 29 97 44 C100 61 93 73 96 86 C98 96 86 100 70 97 C53 94 38 99 22 97 C8 95 1 88 3 74 C5 59 0 46 2 30 C4 17 0 9 9 5 Z",
);
const INNER = svg(
  "M10 6 C23 3 38 7 54 5 C69 3 85 2 92 9 C97 16 91 29 94 44 C96 60 90 72 93 84 C94 93 84 96 69 94 C53 91 38 96 23 94 C10 92 5 86 6 74 C8 60 3 46 5 31 C7 19 3 11 10 6 Z",
);

/** The next featured occurrence, respecting the Work and Personal focus modes. */
export function useFeatured() {
  const featured = useApp((s) => s.featured);
  const visible = useVisible();
  return featured && visible(featured.event.categoryId) ? featured : null;
}

/** The painted frame on its own: the event's picture, your chosen picture, or the painting. */
export function FeaturedFrame({ className }: { className?: string }) {
  const occ = useFeatured();
  const fallbackImage = useApp((s) => s.settings.featuredImage);
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const toast = useApp((s) => s.toast);
  const src = useFileSrc(occ?.event.imagePath || fallbackImage);

  async function changePicture() {
    try {
      const path = await pickImage();
      if (path) {
        await setSetting("featuredImage", path);
        toast("Dashboard picture changed");
      }
    } catch (e) {
      fail(e);
    }
  }

  return (
    <figure aria-label={occ ? `Picture for ${occ.event.title}` : "Dashboard picture"} className={cn("float relative m-0 min-h-[420px]", className)}>
      <div className="absolute inset-0 [filter:drop-shadow(0_20px_22px_rgb(var(--shadow-ink)/.28))_drop-shadow(0_3px_3px_rgb(var(--shadow-ink)/.18))]">
        <div
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,var(--cream),var(--cream-deep))]"
          style={{ maskImage: OUTER, WebkitMaskImage: OUTER, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
        >
          <div
            className="absolute inset-[3.2%] overflow-hidden bg-marigold"
            style={{ maskImage: INNER, WebkitMaskImage: INNER, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <PaintedDoorway className="h-full w-full" />
            )}
          </div>
        </div>
      </div>
      <Help title="Dashboard picture" className="absolute left-[7%] top-[8%] z-10 bg-cream">
        <p>A picture to set the mood. It shows the featured event’s own picture if it has one, otherwise one you choose with the Picture button, or this painting.</p>
      </Help>
      <Button tone="clay" size="sm" onClick={changePicture} className="absolute bottom-[8%] right-[7%] z-10" aria-label="Change the dashboard picture">
        <ImagePlus size={16} /> Picture
      </Button>
    </figure>
  );
}

/** Title, time, place, countdown and the way into the event. */
export function FeaturedDetails() {
  const occ = useFeatured();
  const h24 = useApp((s) => s.settings.clock24h ?? false);
  const openEvent = useApp((s) => s.openEvent);
  const now = useNow(30_000);

  if (!occ) {
    return (
      <div>
        <h2 id="featured-h" className="display pr-9 text-3xl text-forest">
          Nothing planned yet
        </h2>
        <p className="mt-1 max-w-[34ch] text-sm text-muted">Your next event or meeting will show here, with a countdown.</p>
        <Button tone="primary" size="sm" className="mt-3" onClick={() => openEvent({ kind: "event", important: true })}>
          Plan an event
        </Button>
      </div>
    );
  }

  const start = parse(occ.start);
  const end = parse(occ.end);
  const live = !occ.event.allDay && start <= now && now < end;
  const when = occ.event.allDay
    ? `${relDay(start, now)}, all day`
    : `${relDay(start, now)}, ${fmtTime(start, h24)} to ${isSameDay(start, end) ? fmtTime(end, h24) : `${format(end, "EEE d MMM")} ${fmtTime(end, h24)}`}`;
  const where = occ.event.location || occ.event.meetingUrl.replace(/^https?:\/\//, "");

  return (
    <div>
      <h2 id="featured-h" className="display pr-9 text-3xl leading-tight text-forest">
        {occ.event.title}
      </h2>
      <p className="mt-1.5 text-base font-semibold text-ink">
        {when}
        {occ.event.kind === "meeting" && <span className="ml-2 rounded-full bg-sage/25 px-2 py-0.5 text-xs text-forest">Meeting</span>}
      </p>
      {where && (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted">
          {occ.event.location ? <MapPin size={15} aria-hidden /> : <Video size={15} aria-hidden />}
          <span className="truncate">{where}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="display num text-2xl text-terracotta" aria-live="polite">
          {live ? `Now, ends ${countdown(end, now)}` : countdown(start, now)}
        </p>
        <Button tone="primary" size="sm" onClick={() => openEvent(occ.event)}>
          Open details
        </Button>
      </div>
    </div>
  );
}

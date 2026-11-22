"use client";
import { FeaturedFrame } from "@/components/widgets/featured";
import { DayAgenda, MiniCalendar } from "@/components/widgets/calendar";
import { PinnedBand, QuoteCard } from "@/components/widgets/notes";
import { ReminderPlayer } from "@/components/widgets/reminder";
import { ClockTile, FocusTile, QuickTiles, StatsTile, WeatherTile } from "@/components/widgets/small";

export default function Dashboard() {
  return (
    <div className="floaty">
      <h1 className="sr-only">Dashboard</h1>
      <div className="board">
        <div className="col col-a">
          <FeaturedFrame className="o-1 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]" />
          <div className="o-5 flex items-stretch gap-5 max-[479px]:flex-col">
            <StatsTile className="w-[138px] shrink-0 max-[479px]:w-full" />
            <MiniCalendar className="min-w-0 flex-1" />
          </div>
        </div>
        <div className="col col-b">
          <ClockTile className="o-3" />
          <ReminderPlayer className="o-4" />
          <QuickTiles className="o-8" />
          <DayAgenda className="o-day" />
        </div>
        <div className="col col-c">
          <WeatherTile className="o-2" />
          <FocusTile className="o-6" />
          <QuoteCard className="o-7" />
        </div>
      </div>
      <PinnedBand className="mt-7" />
    </div>
  );
}

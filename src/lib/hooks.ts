"use client";
import { useEffect, useState } from "react";
import { dtStr } from "./dates";
import { useApp } from "./store";
import type { WeatherReading } from "./types";

/** The current time, re-read from the operating system on every tick. */
export function useNow(stepMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      t = setTimeout(tick, stepMs - (d.getTime() % stepMs) + 5);
    };
    tick();
    const resync = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", resync);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [stepMs]);
  return now;
}

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};
export const weatherText = (code: number) => WMO[code] ?? "Weather";
export const weatherKind = (code: number): "sun" | "cloud" | "rain" | "storm" =>
  code <= 1 ? "sun" : code <= 48 ? "cloud" : code >= 95 ? "storm" : "rain";

export type WeatherState =
  | { kind: "off" }
  | { kind: "loading" }
  | { kind: "live"; reading: WeatherReading }
  | { kind: "stale"; reading: WeatherReading }
  | { kind: "unavailable" };

/** Local weather from Open-Meteo, only when the user has switched it on. */
export function useWeather(): WeatherState {
  const weather = useApp((s) => s.settings.weather);
  const last = useApp((s) => s.settings.weatherLast);
  const setSetting = useApp((s) => s.setSetting);
  const [state, setState] = useState<WeatherState>({ kind: "loading" });

  useEffect(() => {
    if (!weather?.enabled || weather.lat == null || weather.lon == null) {
      setState({ kind: "off" });
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const unit = weather.unit ?? "celsius";
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${weather.lat}&longitude=${weather.lon}&current=temperature_2m,weather_code,is_day&temperature_unit=${unit}&timezone=auto`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        const reading: WeatherReading = {
          temp: Math.round(j.current.temperature_2m),
          code: j.current.weather_code,
          isDay: j.current.is_day === 1,
          unit,
          at: dtStr(new Date()),
          place: weather.place,
        };
        if (!alive) return;
        setState({ kind: "live", reading });
        setSetting("weatherLast", reading).catch(() => {});
      } catch {
        if (!alive) return;
        const prev = useApp.getState().settings.weatherLast;
        setState(prev ? { kind: "stale", reading: prev } : { kind: "unavailable" });
      }
    };
    if (last && last.place === weather.place) setState({ kind: "stale", reading: last });
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    window.addEventListener("online", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("online", load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.enabled, weather?.lat, weather?.lon, weather?.unit, weather?.place]);

  return state;
}

/** Resolves an attachment path to a displayable URL. */
export function useFileSrc(path: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("./api").then(({ fileSrc }) => fileSrc(path)).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [path]);
  return src;
}

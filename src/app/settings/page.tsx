"use client";
import { format } from "date-fns";
import { Archive, Download, FolderOpen, ImagePlus, Link2, RotateCcw, Search } from "@/components/icons";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { Button, Field, Input, Segmented, Select, SectionTitle, Toggle } from "@/components/ui";
import { api, autostart, confirmAsk, errorText, openPath, openUrl, pickBackupFile, pickImage, revealPath } from "@/lib/api";
import { TOOLKITS, connectLink, connectedAccounts } from "@/lib/composio";
import { parse } from "@/lib/dates";
import { useApp } from "@/lib/store";
import { BackdropPicker, LayoutPicker, ProfileForm, StylePicker, ThemePicker } from "@/components/Profile";
import { UpdatesPanel } from "@/components/Updates";
import { FeedbackForm } from "@/components/Feedback";
import type { BackupFile, WeatherSettings } from "@/lib/types";

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3.5 first:border-t-0">
      <div className="min-w-0">
        <p className="text-md text-ink">{title}</p>
        {hint && <p className="max-w-[56ch] text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Weather() {
  const w = useApp((s) => s.settings.weather);
  const setSetting = useApp((s) => s.setSetting);
  const fail = useApp((s) => s.fail);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }[]>([]);
  const cur: WeatherSettings = { enabled: false, place: "", lat: null, lon: null, unit: "celsius", ...w };
  const save = (p: Partial<WeatherSettings>) => setSetting("weather", { ...cur, ...p }).catch(fail);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&format=json`);
      const j = await r.json();
      setResults(j.results ?? []);
      if (!j.results?.length) fail("No place found with that name.");
    } catch {
      fail("Could not reach the weather service. Check your connection.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <section id="weather" className="clay shape-b px-6 py-5">
      <SectionTitle>Weather</SectionTitle>
      <p className="mt-1 max-w-[60ch] text-sm text-muted">Uses the free Open-Meteo service. Only the place you choose is sent. When you are offline the last reading is shown with its time.</p>
      <Row title="Show local weather">
        <Toggle label="Show local weather" checked={cur.enabled} onChange={(enabled) => save({ enabled })} />
      </Row>
      {cur.enabled && (
        <>
          <Row title="Place" hint={cur.place || "No place chosen yet"}>
            <Segmented label="Unit" value={cur.unit} onChange={(unit) => save({ unit })} options={[{ value: "celsius", label: "°C" }, { value: "fahrenheit", label: "°F" }]} />
          </Row>
          <form onSubmit={search} className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for your town or city" aria-label="Search for a place" />
            <Button type="submit" tone="forest" disabled={!q.trim() || searching}>
              <Search size={16} /> {searching ? "Finding…" : "Find"}
            </Button>
          </form>
          {results.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {results.map((r) => {
                const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
                return (
                  <li key={`${r.latitude},${r.longitude}`}>
                    <Button
                      tone="clay"
                      size="sm"
                      onClick={() => {
                        save({ place: label, lat: r.latitude, lon: r.longitude });
                        setResults([]);
                        setQ("");
                      }}
                    >
                      {label}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Data() {
  const paths = useApp((s) => s.paths);
  const desktop = useApp((s) => s.desktop);
  const refresh = useApp((s) => s.refresh);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const load = () => api.listBackups().then(setBackups).catch(() => setBackups([]));
  useEffect(() => {
    load();
  }, []);
  async function restore(path: string) {
    if (!(await confirmAsk("Replace everything in Schedulr with this backup? Your current data is backed up first, so you can go back."))) return;
    try {
      await api.restoreBackup(path);
      await refresh();
      await load();
      toast("Backup restored");
    } catch (e) {
      fail(e);
    }
  }
  return (
    <section className="clay shape-a px-6 py-5">
      <SectionTitle>Your data</SectionTitle>
      <p className="mt-1 max-w-[62ch] text-sm text-muted">
        Everything is stored in one SQLite file on this laptop. Nothing is sent anywhere unless you turn on weather or connect an account below. A backup is also made automatically once a day.
      </p>
      <Row title="Data folder" hint={paths?.data}>
        <Button tone="clay" size="sm" disabled={!desktop} onClick={() => paths && openPath(paths.data).catch(fail)}>
          <FolderOpen size={16} /> Open
        </Button>
      </Row>
      <Row title="Back up now" hint="Saves a copy of the database in the backups folder.">
        <Button
          tone="forest"
          size="sm"
          onClick={async () => {
            try {
              const p = await api.backupNow();
              toast("Backup saved");
              load();
              revealPath(p);
            } catch (e) {
              fail(e);
            }
          }}
        >
          <Archive size={16} /> Back up
        </Button>
      </Row>
      <Row title="Restore from a file" hint="Choose a .db backup, for example one copied from another laptop.">
        <Button
          tone="clay"
          size="sm"
          onClick={async () => {
            try {
              const p = await pickBackupFile(paths?.backups);
              if (p) restore(p);
            } catch (e) {
              fail(e);
            }
          }}
        >
          <RotateCcw size={16} /> Restore
        </Button>
      </Row>
      <Row title="Export" hint="A JSON file with everything, or an .ics calendar any calendar app can open.">
        <div className="flex gap-2">
          <Button tone="clay" size="sm" onClick={() => api.exportJson().then((p) => (toast("Export saved"), revealPath(p)), fail)}>
            <Download size={16} /> JSON
          </Button>
          <Button tone="clay" size="sm" onClick={() => api.exportIcs().then((p) => (toast("Calendar exported"), revealPath(p)), fail)}>
            <Download size={16} /> Calendar .ics
          </Button>
        </div>
      </Row>
      {backups.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer py-2 text-base font-semibold text-forest">Backups on this laptop ({backups.length})</summary>
          <ul className="divide-y divide-line">
            {backups.map((b) => (
              <li key={b.path} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  {format(parse(b.modified), "EEE d MMM yyyy, HH:mm")}
                  <span className="text-muted">
                    {" "}
                    {b.name.includes("auto") ? "daily" : b.name.includes("before-restore") ? "before a restore" : "manual"}, {(b.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <Button tone="ghost" size="sm" onClick={() => restore(b.path)}>
                  Restore this one
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Integrations() {
  const cfg = useApp((s) => s.settings.composio);
  const setSetting = useApp((s) => s.setSetting);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const [key, setKey] = useState(cfg?.apiKey ?? "");
  const [user, setUser] = useState(cfg?.userId ?? "schedulr-user");
  const [accounts, setAccounts] = useState<string[] | null>(null);
  const ready = !!cfg?.apiKey;
  return (
    <section className="clay shape-c px-6 py-5">
      <SectionTitle>Connected calendars</SectionTitle>
      <p className="mt-1 max-w-[62ch] text-sm text-muted">
        Optional. Schedulr works fully without this. With your own Composio API key you can connect Google Calendar, Gmail or Outlook, then copy an event there from its details. Nothing is sent until you confirm.
      </p>
      <form
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await setSetting("composio", { apiKey: key.trim(), userId: user.trim() || "schedulr-user" });
            toast(key.trim() ? "Composio key saved on this laptop" : "Composio disconnected");
          } catch (x) {
            fail(x);
          }
        }}
      >
        <Field label="Composio API key" htmlFor="cp-key">
          <Input id="cp-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key" />
        </Field>
        <Field label="User id" htmlFor="cp-user">
          <Input id="cp-user" value={user} onChange={(e) => setUser(e.target.value)} />
        </Field>
        <Button type="submit" tone="forest">
          Save
        </Button>
      </form>
      {ready && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TOOLKITS.map((t) => (
            <Button
              key={t.slug}
              tone="clay"
              size="sm"
              onClick={async () => {
                if (!(await confirmAsk(`Open the ${t.name} sign-in page in your browser to connect it through Composio?`))) return;
                try {
                  await openUrl(await connectLink(cfg!, t.slug));
                } catch (e) {
                  fail(errorText(e));
                }
              }}
            >
              <Link2 size={15} /> Connect {t.name}
            </Button>
          ))}
          <Button
            tone="ghost"
            size="sm"
            onClick={async () => {
              try {
                const list = await connectedAccounts(cfg!);
                setAccounts(list.map((a) => `${a.toolkit?.slug ?? "account"} (${a.status.toLowerCase()})`));
              } catch (e) {
                fail(e);
              }
            }}
          >
            Check connections
          </Button>
          {accounts && <p className="w-full text-sm text-muted">{accounts.length ? accounts.join(", ") : "No accounts connected yet."}</p>}
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const s = useApp((x) => x.settings);
  const setSetting = useApp((x) => x.setSetting);
  const desktop = useApp((x) => x.desktop);
  const version = useApp((x) => x.version);
  const toast = useApp((x) => x.toast);
  const fail = useApp((x) => x.fail);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    autostart.isEnabled().then(setAuto).catch(() => {});
  }, []);
  const choose = async (key: "featuredImage" | "quoteImage") => {
    try {
      const p = await pickImage();
      if (p) await setSetting(key, p);
    } catch (e) {
      fail(e);
    }
  };
  return (
    <>
      <PageHeader title="Settings" help={<p>Your profile and theme, reminders and startup, weather, pictures, backups and exports, and the optional connection to other calendars.</p>} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section className="clay shape-b px-6 py-5">
            <SectionTitle>Profile</SectionTitle>
            <div className="mt-3">
              <ProfileForm />
            </div>
          </section>
          <section className="clay shape-c px-6 py-5">
            <SectionTitle>Theme</SectionTitle>
            <p className="mb-3 mt-1 text-sm text-muted">Changes how everything looks, straight away. Your pages, buttons and data stay the same. The palette button in the top bar switches too.</p>
            <StylePicker />
            {(s.style ?? "original") === "original" ? (
              <>
                <p className="mb-3 mt-5 text-md font-semibold text-forest">Original colours</p>
                <ThemePicker />
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">
                {s.style === "glass" ? "Glass has its own honey, sky blue and ink colours." : "Soft 3D has its own pastel colours."} The Original colour palettes come back when you switch to Original.
              </p>
            )}
            <p className="mb-1 mt-5 text-md font-semibold text-forest">Background picture</p>
            <p className="mb-3 text-sm text-muted">Shown behind every page, in any theme. It looks best with Glass, where the panels are see-through.</p>
            <BackdropPicker />
          </section>
          <section className="clay shape-b px-6 py-5">
            <SectionTitle>Layout</SectionTitle>
            <p className="mb-3 mt-1 text-sm text-muted">Arranges the pages differently. Every page, button and feature stays the same. On a narrow window the menu always sits at the bottom.</p>
            <LayoutPicker />
          </section>
          <section className="clay shape-a px-6 py-5">
            <SectionTitle>Reminders and startup</SectionTitle>
            <Row title="Keep running in the tray when closed" hint="Reminders keep coming while the window is closed. Quit from the tray icon.">
              <Toggle label="Keep running in the tray" checked={s.closeToTray ?? true} onChange={(v) => setSetting("closeToTray", v).catch(fail)} />
            </Row>
            <Row title="Start with Windows" hint="Opens quietly in the tray when you sign in, so reminders are never off.">
              <Toggle
                label="Start with Windows"
                checked={auto}
                onChange={async (v) => {
                  try {
                    await autostart.set(v);
                    setAuto(v);
                  } catch (e) {
                    fail(e);
                  }
                }}
              />
            </Row>
            <Row title="Snooze length">
              <Select aria-label="Snooze length" value={s.snoozeMinutes ?? 10} onChange={(e) => setSetting("snoozeMinutes", Number(e.target.value)).catch(fail)} className="w-[150px]">
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m === 60 ? "1 hour" : `${m} minutes`}
                  </option>
                ))}
              </Select>
            </Row>
            <Row title="24-hour clock">
              <Toggle label="24-hour clock" checked={s.clock24h ?? true} onChange={(v) => setSetting("clock24h", v).catch(fail)} />
            </Row>
            <Row title="Test notification" hint="Check that Windows lets Schedulr show notifications.">
              <Button tone="clay" size="sm" onClick={() => api.testNotification().then(() => toast("Sent"), fail)}>
                Send one
              </Button>
            </Row>
          </section>
          <Weather />
          <section className="clay shape-c px-6 py-5">
            <SectionTitle>Pictures</SectionTitle>
            <Row title="Dashboard picture" hint="Shown in the wavy frame when the featured event has no picture of its own.">
              <div className="flex gap-2">
                <Button tone="clay" size="sm" onClick={() => choose("featuredImage")}>
                  <ImagePlus size={16} /> Choose
                </Button>
                {s.featuredImage && (
                  <Button tone="ghost" size="sm" onClick={() => setSetting("featuredImage", null)}>
                    Use the painting
                  </Button>
                )}
              </div>
            </Row>
            <Row title="Quote card illustration">
              <div className="flex gap-2">
                <Button tone="clay" size="sm" onClick={() => choose("quoteImage")}>
                  <ImagePlus size={16} /> Choose
                </Button>
                {s.quoteImage && (
                  <Button tone="ghost" size="sm" onClick={() => setSetting("quoteImage", null)}>
                    Use the flowers
                  </Button>
                )}
              </div>
            </Row>
          </section>
        </div>
        <div className="flex flex-col gap-6">
          <section className="clay shape-a px-6 py-5">
            <SectionTitle>Updates</SectionTitle>
            <div className="mt-3">
              <UpdatesPanel />
            </div>
          </section>
          <section className="clay shape-c px-6 py-5">
            <SectionTitle>Feedback</SectionTitle>
            <p className="mb-4 mt-1 text-sm text-muted">Found a problem, or have an idea? It goes straight to the developer. The speech-bubble button in the top bar opens this too.</p>
            <FeedbackForm />
          </section>
          <Data />
          <Integrations />
          <p className="px-2 text-xs text-muted">{desktop ? `Schedulr ${version}` : "Browser preview. Install the desktop app to save your data."}</p>
        </div>
      </div>
    </>
  );
}

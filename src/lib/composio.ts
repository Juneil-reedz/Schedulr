/**
 * Optional Composio connection for Google Calendar, Gmail and Outlook.
 * Nothing here runs unless the user adds their own Composio API key and
 * confirms each action.
 */
import { parse } from "./dates";
import type { ComposioSettings, SchedEvent } from "./types";

const BASE = "https://backend.composio.dev/api/v3";

export const TOOLKITS = [
  { slug: "googlecalendar", name: "Google Calendar" },
  { slug: "gmail", name: "Gmail" },
  { slug: "outlook", name: "Outlook Calendar" },
] as const;

async function req<T>(cfg: ComposioSettings, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": cfg.apiKey, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw `Composio answered ${res.status}: ${text.slice(0, 200)}`;
  return (text ? JSON.parse(text) : {}) as T;
}

interface Page<T> {
  items: T[];
}

export async function connectedAccounts(cfg: ComposioSettings) {
  const r = await req<Page<{ id: string; status: string; toolkit?: { slug: string } }>>(cfg, `/connected_accounts?user_ids=${encodeURIComponent(cfg.userId)}`);
  return r.items ?? [];
}

/** Returns the page where the user signs in to the service. */
export async function connectLink(cfg: ComposioSettings, toolkit: string) {
  const configs = await req<Page<{ id: string }>>(cfg, `/auth_configs?toolkit_slug=${toolkit}`);
  const authConfig = configs.items?.[0]?.id;
  if (!authConfig) throw `There is no auth config for ${toolkit} in your Composio project yet. Create one in the Composio dashboard first.`;
  const r = await req<{ redirect_url?: string; redirectUrl?: string }>(cfg, `/connected_accounts/link`, {
    method: "POST",
    body: JSON.stringify({ auth_config_id: authConfig, user_id: cfg.userId }),
  });
  const url = r.redirect_url ?? r.redirectUrl;
  if (!url) throw "Composio did not return a sign-in link.";
  return url;
}

/** Copies one event to the connected Google Calendar. Invites go out only if the user included attendees. */
export async function pushToGoogleCalendar(cfg: ComposioSettings, ev: SchedEvent, sendInvites: boolean) {
  const s = parse(ev.start), e = parse(ev.end);
  const minutes = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
  return req(cfg, `/tools/execute/GOOGLECALENDAR_CREATE_EVENT`, {
    method: "POST",
    body: JSON.stringify({
      user_id: cfg.userId,
      arguments: {
        summary: ev.title,
        description: [ev.description, ev.agenda && `Agenda:\n${ev.agenda}`].filter(Boolean).join("\n\n"),
        start_datetime: ev.allDay ? `${ev.start}T00:00:00` : `${ev.start}:00`,
        event_duration_hour: Math.floor(minutes / 60),
        event_duration_minutes: minutes % 60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: ev.location || ev.meetingUrl || undefined,
        attendees: sendInvites ? ev.participants.map((p) => p.email).filter(Boolean) : [],
        send_updates: sendInvites,
      },
    }),
  });
}

# Schedulr

A local-first Windows desktop planner for events, meetings, tasks and reminders, in a handcrafted floral clay style.

Built with Tauri 2, Next.js (static export), React, TypeScript, Tailwind CSS, Radix primitives styled in the shadcn pattern, Motion, and SQLite (rusqlite, compiled in).

## Build the Windows installer

**On your Windows laptop** (one time: install [Node.js 22](https://nodejs.org), [Rust](https://rustup.rs) and the "Desktop development with C++" workload from the Visual Studio Build Tools):

```powershell
npm ci
npm run tauri build
```

The installers land in `src-tauri\target\release\bundle\nsis\Schedulr_1.0.0_x64-setup.exe` and `...\bundle\msi\`.

**Or on GitHub:** push this folder to a repository, open Actions, and run "Windows installer". The `.exe` and `.msi` are attached to the run.

## Develop

```bash
npm ci
npm run tauri dev      # the desktop app with hot reload
npm run dev            # the interface alone in a browser (in-memory preview, nothing saved; add ?sample for sample data)
cd src-tauri && cargo test --lib   # 19 tests: database, recurrence, conflicts, reminders, missed reminders, focus modes, .ics
```

## Where data lives

`%APPDATA%\com.schedulr.app\`
- `schedulr.db`: everything (SQLite, WAL mode)
- `backups\`: a daily automatic backup plus any you make (the 30 newest are kept)
- `attachments\`: pictures you choose for events and the dashboard
- `exports\`: JSON and `.ics` exports

Uninstalling or updating the app does not delete this folder.

## How reminders work

A background thread in the Rust process checks every minute boundary (at most every 15 seconds) and whenever you edit something. Every reminder instance is written to `reminder_log`, so nothing fires twice.

- Closing the window hides Schedulr to the system tray; reminders keep coming. Quit from the tray icon.
- "Start with Windows" (Settings) launches it quietly in the tray at sign-in.
- Reminders cannot be delivered while the laptop is shut down or asleep. On the next start (or wake), anything that came due more than 5 minutes earlier is marked **missed**, listed on the Reminders page, and summarised in one notification.
- Do not disturb and Sleep silence notifications (the reminders are still listed). Work hides personal categories and only notifies about work; Personal does the opposite.
- Windows notifications do not support Snooze/Dismiss buttons for this kind of app, so snooze, dismiss and complete live in the app (dashboard reminder card and Reminders page). Clicking the tray icon opens the window.

## Optional services

- **Weather**: off by default. Turn it on in Settings and choose a place; it uses Open-Meteo and sends only that place's coordinates. Offline, the last reading is shown with its time.
- **Composio**: off by default. Paste your own Composio API key in Settings to connect Google Calendar, Gmail or Outlook, then copy an event to Google Calendar from its details (you confirm each one). The key is stored in the local database.
- **Battery**: shown only when Windows reports a battery; otherwise the cactus tile shows today's tasks.

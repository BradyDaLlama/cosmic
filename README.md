# cosmic

A personal life organizer. The Today screen brings together Google Calendar events, Google Tasks, weather,
notes, routines, habits and goals, with a pngtuber reading out the day's briefing. It's a Next.js web app,
with an Android app (Capacitor) that wraps it.

## Features

- **Today:** greeting and briefing, a weather pill that scrubs through the forecast, and Up next from
  Google Calendar with rain, snow and thunderstorm changes in between.
- **Calendar:** switch Up next between cards and a day timeline where events fill their time slots, overlaps
  stack like Google Calendar and a line marks now. Add events (timed or all-day, to any calendar you can edit) from
  `+ Event` or by tapping an open stretch of the timeline.
- **Tasks:** Google Tasks is the source of truth. Today shows what's due; `/tasks` shows every list.
- **Routines:** checklists of task and wait steps that start fresh each day and can mark a habit done.
- **Habits and goals:** daily, weekly or monthly habits with streaks, and numbers logged over time with charts.
- **Notes:** free text or lists to check off and reorder, kept apart from Google Tasks, each with an icon,
  a color and the day it was created. Archiving hides a note from Today but keeps its contents.
- **AI briefing (optional):** a small self-hosted model rewrites the Today briefing from your events, tasks,
  habits and weather, streaming it into the bubble as it's written. Without one, the plain briefing stays.

## Layout

| Path               | What                                               |
| ------------------ | -------------------------------------------------- |
| `apps/web`         | Next.js app: the UI and the API routes             |
| `apps/web/app/api` | Google sign-in, Tasks, Calendar, MongoDB data, AI  |
| `apps/mobile`      | Capacitor Android app that loads the deployed site |

Google holds tasks and calendar events, and the sign-in is an encrypted cookie. Everything else (settings,
habits, goals, routines, notes) is stored in MongoDB Atlas.

The design system lives in [BradyDaLlama/ui](https://github.com/BradyDaLlama/ui) and is installed from GitHub
Packages as `@bradydallama/tokens` and `@bradydallama/ui`. The display font (Mini Wakuwaku Maru, personal-use
license) is bundled here only and supplied to the components through `--bd-font-display`.

## Setup

1. **Node 24** (see `.nvmrc`).
2. **Package token.** Installing needs `NPM_TOKEN`, a GitHub personal access token (classic) with only
   `read:packages`, read by `.npmrc`. Set it once per machine (`setx NPM_TOKEN <token>` on Windows, then open
   a new terminal).
3. **Environment.** Copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in. It explains each
   value: Google OAuth client, session secret, allowed emails, MongoDB, and the optional AI model.
4. **Demo mode.** Leave `NEXT_PUBLIC_TASKS_BACKEND` unset to run without Google or MongoDB. Tasks and
   calendar events are sample data, and habits, goals, routines and notes are saved in the browser.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck
npm run format
```

## Android app

The app opens `https://cosmic.bradydallama.com` in a native shell, so web deploys reach the phone without a
new APK. Google sign-in runs in a Chrome tab and returns to the app through a `cosmic://auth` link. Rebuild
the APK only when the native side changes (plugins, `capacitor.config.ts`, the Android project).

Needs Android Studio. After changing plugins or `capacitor.config.ts`:

```bash
npm run sync --workspace mobile
npm run open --workspace mobile     # opens Android Studio; run on a device from there
```

## Design system changes

To try unpublished changes, point `@bradydallama/ui` at a local checkout (`"file:../../../ui/packages/ui"`)
and run `npm run build` in that package after each change; `next.config.ts` detects the link by itself.
Switch back to the registry version before deploying. New versions are released from the ui repo
(`npx changeset`, push, merge the "Version packages" pull request).

## Deploying

Vercel, with `apps/web` as the project root and Node 24. Set `NPM_TOKEN` and every value from `.env.example` in the
project's environment variables, add the production redirect URI
(`https://<domain>/api/auth/google/callback`) to the Google OAuth client, and allow Vercel in Atlas's IP
access list.

# Convina DevOps Bot — Session Log

**Date:** Monday, June 29, 2026  
**Project:** `convina-devops-bot`  
**Repo:** https://github.com/andrucastro/convina-devops-bot  
**Production URL:** https://convina-devops-bot.onrender.com  
**Previous (Railway):** https://convina-devops-bot-production.up.railway.app  
**EC2 (optional / in progress):** `3.141.100.66` (HTTP only until domain/HTTPS)

This document records everything built, fixed, and configured during today's development session.

---

## Project Overview

A Slack bot built with **Node.js** and **@slack/bolt** that exposes a `/dv-release` slash command with deployment request workflows (button → modal).

### Tech Stack

| Item | Detail |
|------|--------|
| Runtime | Node.js |
| Framework | @slack/bolt v4 |
| Env loading | dotenv |
| Local dev | nodemon (`npm run dev`) |
| Hosting | Railway (nixpacks) |

### Project Structure

```
convina-devops-bot/
├── .cursor/
│   └── rules/
│       └── auto-readme-context.mdc  # Cursor rule: read/update AUTO_README.md
├── AUTO_README.md                # Living session log & project context
├── ARCHITECTURE.md               # Architecture, setup & deployment reference
├── sql/
│   └── deployment_requests.sql # Supabase table schema
├── src/
│   ├── app.js                  # Bolt app entry point
│   ├── commands/
│   │   └── devops.js           # /dv-release slash command
│   ├── db/
│   │   └── supabase.js         # Supabase client
│   ├── handlers/
│   │   └── deployment.js       # Button + modal handlers
│   ├── services/
│   │   └── deploymentRequests.js # Ticket CRUD
│   └── utils/
│       └── channel.js          # Channel membership checks
├── railway.toml                # Railway deploy config
├── package.json
├── .env                        # Local secrets (gitignored)
├── .env.example
└── .gitignore
```

---

## Chronological Event History

### 1. Created `.gitignore`

Added a standard Node.js `.gitignore` covering:

- `node_modules/`
- `.env` and `.env.*` (except `.env.example`)
- Logs, build output, OS files, editor directories

---

### 2. Fixed `/devops` — `channel_not_found` Error

**Problem:** Running `/devops` in Slack threw:

```
Error: An API error occurred: channel_not_found
```

The handler was using `client.chat.postEphemeral()`, which requires the bot to be a **member** of the channel.

**Fix:** Switched to Bolt's `respond()` helper, which replies via Slack's `response_url` and does not require channel membership.

**File changed:** `src/commands/devops.js`

---

### 3. Clarified Private Channel vs Workspace Install

**Context:** App was installed in private channel `#dev-ops`, but errors persisted.

**Key learning:** Installing an app to a workspace ≠ the bot being a member of a private channel. The bot must be explicitly invited:

```
/invite @YourBotName
```

Or via: Channel details → **Integrations** → **Add apps**

---

### 4. Added Channel Membership Check + Invite Instructions

**Request:** Show a helpful error when the bot is not in a channel, with invite guidance.

**Implementation:** Created `src/utils/channel.js` with:

- `isBotInChannel()` — checks membership via `conversations.info`
- `tryJoinPublicChannel()` — auto-joins public channels (needs `channels:join` scope)
- `buildNotInChannelBlocks()` — Block Kit message with `/invite` instructions
- `ensureBotInChannel()` — orchestrates the check before showing the menu

**Limitation discovered:** Slack does **not** expose an API to trigger the native "invite to channel" dialog. That prompt only appears when a **human** @mentions the bot in the message composer.

---

### 5. Fixed `missing_scope` Crash

**Problem:** Channel membership check called `conversations.info`, which requires OAuth scopes the app did not have:

```
error: missing_scope
needed: channels:read, groups:read, mpim:read, im:read
```

This caused an unhandled error that stopped the command handler.

**Fix:**

- Treat `missing_scope` as "skip check, proceed anyway" (slash `respond()` works without membership)
- Wrap all channel logic in try/catch so the server never crashes
- Added try/catch in `devops.js` as a final safety net

**Console message when scopes are missing:**

```
[channel] Skipping membership check (missing OAuth scopes). Add channels:read and groups:read to enable it.
```

**Optional scopes to add** (api.slack.com → OAuth & Permissions → reinstall app):

| Scope | Purpose |
|-------|---------|
| `channels:read` | Check membership in public channels |
| `groups:read` | Check membership in private channels |
| `channels:join` | Auto-join public channels |

---

### 6. Deployed to Railway

**Steps documented:**

1. Push code to GitHub (`andrucastro/convina-devops-bot`)
2. Create Railway project from GitHub repo
3. Set environment variables in Railway:
   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`
   - Do **not** set `PORT` (Railway injects it)
4. Generate public domain under Settings → Networking

**`railway.toml` config:**

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
```

---

### 7. Fixed Railway Build Error — `restartPolicyType`

**Problem:**

```
Failed to parse your service config.
Error: deploy.restartPolicyType: Invalid input
```

**Cause:** Used `on-failure` (invalid kebab-case).

**Fix:** Changed to `ON_FAILURE` (valid Railway enum).

Valid values: `ON_FAILURE`, `ALWAYS`, `NEVER`

---

### 8. Configured Slack URLs for Production

**Production domain:** `convina-devops-bot.onrender.com`

**Slack Request URLs** (both use the same endpoint):

| Setting | URL |
|---------|-----|
| Slash Commands → `/dv-release`, `/dv-add-app`, `/dv-delete-app` | `https://convina-devops-bot.onrender.com/slack/events` |
| Interactivity & Shortcuts | `https://convina-devops-bot.onrender.com/slack/events` |

Bolt handles slash commands, button clicks, and modals on `/slack/events`.

---

### 9. Local Development Workflow (Documented)

**Current setup (HTTP mode):** To test locally, you must temporarily point Slack URLs to ngrok:

```bash
npm run dev          # runs on port 3000
ngrok http 3000      # exposes local server
```

Then set Slack URLs to `https://YOUR-NGROK-ID.ngrok.io/slack/events`, and switch back to Railway when done.

**Recommended alternatives (not yet implemented):**

1. **Socket Mode** — no ngrok, no URL switching; add `SLACK_APP_TOKEN` locally only
2. **Separate dev Slack app** — dev app → ngrok, prod app → Railway
3. **Test on Railway only** — push and test in production (slower iteration)

---

### 10. Created `AUTO_README.md` + Cursor Rule

**Request:** Document session history and keep it updated automatically.

**Created:**

- `AUTO_README.md` — living project log (architecture, fixes, deploy config, checklists)
- `.cursor/rules/auto-readme-context.mdc` — Cursor rule (`alwaysApply: true`) that instructs the agent to:
  1. Read `AUTO_README.md` before making project changes
  2. Update `AUTO_README.md` after any meaningful change (features, fixes, config, structure)

---

### 11. Created `ARCHITECTURE.md`

**Request:** Stable architectural reference for future context (setup, deployment, Slack integration).

**Created:** `ARCHITECTURE.md` covering:

- System overview and Mermaid diagrams (request flow, deployment)
- Project structure and module responsibilities
- Slack integration (HTTP mode, scopes, URLs, private channels)
- Railway deployment (env vars, `railway.toml`, deploy workflow)
- Local development options
- Error handling patterns and extension points

**Also updated:** `.cursor/rules/auto-readme-context.mdc` to read/update both `AUTO_README.md` and `ARCHITECTURE.md`.

---

### 12. Connected Supabase for deployment tickets

**What:**
- Added `@supabase/supabase-js`
- `src/db/supabase.js` — Supabase client (uses `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`)
- `src/services/deploymentRequests.js` — create/update/get ticket helpers
- `sql/deployment_requests.sql` — table schema to run in Supabase SQL Editor
- `.env.example` — documents required env vars
- Modal submit now inserts a row and confirms with ticket id `DEP-<n>`

**Required env vars:**
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # or SUPABASE_SECRET_KEY
```

**Manual step:** Run `sql/deployment_requests.sql` in Supabase → SQL Editor before testing create.
Enable RLS when prompted (script includes `enable row level security`). Bot uses service/secret key, which bypasses RLS.

---

## Environment Variables

### Local (`.env`)

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
PORT=3000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### Railway (dashboard → Variables)

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (local development) |
| `npm start` | Start production server (used by Railway) |

---

## Current Bot Features

### `/dv-release` Slash Command

Shows an ephemeral message with:

- Prompt: *"What would you like to do?"*
- Button: **Create Deployment Request**
- Button: **Open Requests** — table of open tickets (`pending` / `approved`) with Complete actions
- Button: **Completed Requests** — last 5 completed tickets

Formerly `/devops` (renamed Jul 22, 2026).

### `/dv-add-app` Slash Command

Opens a modal to create a new row in the `apps` table (name input).

### `/dv-delete-app` Slash Command

Opens a modal with an apps dropdown and deletes the selected app. Blocked if the app is referenced by existing deployment tickets.

### Deployment Request Modal

Opened when the button is clicked. Fields:

| Field | Type | Required |
|-------|------|----------|
| App/Service | Select from `apps` table | Yes |
| Environment | Select (Staging / Production) | Yes |
| Batch start | Date picker | Yes |
| Batch end | Date picker | Yes |
| Description | Multiline text | No |

On submit, request is saved to Supabase (`deployment_requests`) and the user gets an ephemeral confirmation with ticket id `DEP-<n>`. TODO: post trackable channel message, status buttons, CI/CD trigger.

**Field rename (Jul 22, 2026):** form/DB field `branch` → `batch`. If the table already existed, run `sql/rename_branch_to_batch.sql` in Supabase.

**Quick actions (Jul 22, 2026):** ticket summary includes **Mark as Completed** button; updates status to `completed` and replaces the ephemeral message. Run `sql/add_completed_status.sql` if the table predates this status.

**Batch date range (Jul 22, 2026):** Batch uses two Slack datepickers. Values are stored as `batch_start` / `batch_end` (date columns). Slack summary formats the display range from those dates. Run `sql/migrate_batch_to_dates.sql` on existing tables.

**Apps lookup (Jul 22, 2026):** Added `apps` table (`id`, `name`). App/Service modal field is a dropdown loaded from Supabase. Tickets store `app_id` FK. Run `sql/apps.sql` then `sql/migrate_add_app_id.sql`.

**App management commands (Jul 22, 2026):**
- `/dv-add-app` — modal to create an app name in `apps`
- `/dv-delete-app` — modal dropdown to delete an app (blocked if referenced by tickets)
- Register both slash commands in Slack app settings with Request URL `.../slack/events`

**Command rename (Jul 22, 2026):** `/devops` → `/dv-release`. Update/create the slash command in Slack app settings; remove old `/devops` if unused.

**Note:** Each Slack slash command has its **own** Request URL. `/dv-release` must point at the same `/slack/events` URL as `/dv-add-app` (ngrok locally). Wrong URL → `operation_timeout`. Channel membership check was removed from `/dv-release` because `respond()` does not require the bot in-channel.

**Open Requests list (Jul 23, 2026):** `/dv-release` menu includes **Open Requests** button. Lists `pending`/`approved` tickets in a Slack table-style code block, with Complete actions (refreshes the list after completion).

**Completed Requests list (Jul 23, 2026):** `/dv-release` menu includes **Completed Requests** button. Lists the **last 5** tickets with status `completed` (newest updated first).

**Render deploy (Jul 23, 2026):** Production moved to Render Free at `https://convina-devops-bot.onrender.com`. Slack Request URLs should use `https://convina-devops-bot.onrender.com/slack/events`. Note: Free tier may cold-start after idle (possible Slack `operation_timeout` on first request). Env vars required: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). Start: `npm start`.

---

## Known Issues & Notes

- Visiting the Railway root URL (`/`) in a browser shows "Unhandled HTTP request" — this is normal; Slack POSTs to `/slack/events`
- Channel membership check is skipped until `channels:read` / `groups:read` scopes are added
- Local `npm run dev` and Railway production should not both receive Slack events — only one URL should be active in Slack app settings at a time (unless using Socket Mode or a separate dev app)

---

## Slack App Configuration Checklist

- [x] App installed to workspace
- [x] Slash command `/dv-release` created (formerly `/devops`)
- [ ] Slash commands `/dv-add-app` and `/dv-delete-app` created (Request URL → `/slack/events`)
- [x] Request URL points to Railway `/slack/events` (or ngrok for local)
- [x] Interactivity enabled, URL points to Railway `/slack/events`
- [x] Bot token scopes: `commands`, `chat:write`, etc.
- [ ] Optional: `channels:read`, `groups:read`, `channels:join` for membership checks
- [ ] Optional: Socket Mode for easier local development

---

*Auto-generated session log — June 29, 2026*

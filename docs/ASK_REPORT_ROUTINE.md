# CoComms Ask / Report — Dev agent pickup routine

In-desk **Ask / Report** persists a `SupportPing` row, emails the owner, and is meant to wake **CoComms Dev** (Cursor / Grok Bot) within minutes.

## What users submit

From Match Desk (toolbar) or Settings → Ask / Report:

| Field | Values |
|-------|--------|
| Type | Ask · Bug · XI wrong · Billing · Other |
| Message | Required |
| Context (optional) | Match title, AF fixture id, lineup source (`expected` / `confirmed`), URL |

## Persist + wake path (production)

1. **DB:** `SupportPing` (`status=open`) via `POST /api/support/report` (authed user).
2. **Email:** Resend/SMTP owner alert to `chris@ronniedogmedia.com` (or `OWNER_ALERT_EMAIL`), subject starts with **`[CoComms Ask/Report]`**. Reply-To = reporter.
3. **File inbox:** best-effort append to `data/support-pings.jsonl` on writable FS (local/dev). **Skip on Netlify serverless** — DB + email are the durable wake signals.

## Owner APIs (owner-email allowlist)

Allowlist floor: `chris@ronniedogmedia.com`, `comeontheoviedo@gmail.com` (+ optional `OWNER_EMAIL_ALLOWLIST`).

```http
GET  /api/owner/support-pings?status=open
GET  /api/owner/support-pings?status=all&limit=50
PATCH /api/owner/support-pings
Content-Type: application/json

{ "id": "<pingId>", "status": "resolved" }
```

Re-open: `{ "id": "<pingId>", "status": "open" }`.

## Parent must create the Cursor routine

This box cannot create Grok/Cursor routines via API. **Chris (or parent agent) must create:**

| Field | Value |
|-------|--------|
| **Name** | `CoComms Ask/Report pickup` |
| **Trigger** | Every **5 minutes** (fastest reliable) **or** email inbox when subject contains `[CoComms Ask/Report]` |
| **Prompt** | (paste below) |

### Exact routine prompt

```
You are CoComms Dev for the wpm-live / CoComms product (repo path on Chris’s machine: /Users/chrisdarwen/wpm-live; production https://www.cocomms.online).

Every run:
1. As an owner-authed session (chris@ronniedogmedia.com or comeontheoviedo@gmail.com), GET https://www.cocomms.online/api/owner/support-pings?status=open
   — or query Postgres SupportPing where status='open' ordered by createdAt asc.
2. For each open ping:
   a. Read type, message, context JSON (matchTitle, afFixtureId, lineupSource, url, matchId).
   b. Investigate in the repo / production logs / desk behaviour. Fix in code when safe and in scope; otherwise reply with a clear diagnosis and next step.
   c. Reply to the reporter by email (their address is on the ping / Reply-To of the owner alert). Subject: Re: [CoComms Ask/Report] …
   d. PATCH /api/owner/support-pings with { "id": "<id>", "status": "resolved" } when done or when you’ve handed off with a written reply.
3. If no open pings, exit quietly.
4. Prefer small, reviewed fixes + Netlify prod deploy when a code change ships. Do not burn match-pass credits or touch billing unless type=billing.
```

## Example ping test

1. Sign in on production as any user.
2. Open a Match Desk → click **Ask / Report** → type **Ask** → message `routine smoke test — ignore` → leave context on → Send.
3. Confirm:
   - Email arrives at chris@ronniedogmedia.com with subject `[CoComms Ask/Report] Ask · …`
   - `GET /api/owner/support-pings?status=open` (owner session) returns the new row.
4. After the 5-min routine runs (or manual run), ping should move to `resolved` once acted on.

## Related code

- `components/feedback/ask-report-modal.tsx`
- `app/api/support/report/route.ts`
- `app/api/owner/support-pings/route.ts`
- `lib/support-ping-alert.ts`, `lib/owner-access.ts`
- Prisma model `SupportPing`

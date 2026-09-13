# CoComms welcome email (Polar trial unlock)

Sent **once** when a Polar checkout unlocks a user's trial (`billingStatus → trial`
and they were not already on a live trial). Wired from
`app/api/billing/polar/webhook/route.ts`. Stripe paths are untouched.

## Behaviour

| Piece | Detail |
|-------|--------|
| Trigger | First trial unlock from Polar webhook (`order.paid`, `checkout.updated`, or subscription → `trial`) |
| Idempotency | `User.welcomeEmailSentAt` — claimed atomically before send; concurrent webhooks only send once |
| Not re-sent | Later `subscription.updated` / renewals / already-live trial |
| Fail-soft | Mail helper **never throws**. Missing config → log + skip. Provider failure clears the flag so a later unlock-path event can retry |
| Reply-to | `help@cocomms.online` (override with `EMAIL_REPLY_TO`) |

## Copy rules

- Brand: **CoComms** (commentary co-pilot)
- Soft plan mention when known: Unlimited vs Match Desk Pass
- Trial: 14 days · up to 3 desks · cancel anytime
- Quick start: desk → paste research notes → Official XI → Scripts/Notes
- Links: https://www.cocomms.online · Training `/training`
- Vibe: *"Bring your notes. We file them where you need them."*
- **Forbidden:** Gemini, OBS, BYO Notebook, Speaks, "generic SaaS shell"

## Env (Netlify `pitchline-app`)

Prefer **Resend**:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=CoComms <help@cocomms.online>
# optional
EMAIL_REPLY_TO=help@cocomms.online
```

Or **SMTP**:

```bash
SMTP_HOST=smtp.example.com
SMTP_USER=...
SMTP_PASS=...
SMTP_PORT=587          # optional, default 587
SMTP_SECURE=false      # optional; true for port 465
EMAIL_FROM=CoComms <help@cocomms.online>
```

SMTP needs the `nodemailer` package (listed in `package.json`). Resend uses
`fetch` only — no extra SDK.

## Code

| File | Role |
|------|------|
| `lib/email.ts` | Resend / SMTP send helper |
| `lib/welcome-email.ts` | HTML + text + idempotent send |
| `prisma` + `netlify/database` migration `20260913163000_user_welcome_email_sent_at` | `welcomeEmailSentAt` column |

## Deploy note

Netlify Database applies SQL under `netlify/database/migrations/`. After deploy,
confirm the column exists (or that the Netlify DB migration ran). Until mail env
is set, unlocks still succeed — welcome is simply skipped in logs.

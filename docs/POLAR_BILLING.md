# Polar billing (temporary MoR while Stripe is parked)

CoComms commercial model is unchanged. Polar is the **primary** checkout / portal / webhook
provider when `POLAR_ACCESS_TOKEN` is set. Stripe code stays in the repo but is inactive
while Polar is configured.

## Locked commercial model

| Path | What happens |
|------|----------------|
| **Unlimited** | Card-upfront Checkout · 14-day trial · max 3 desks · converts to **£22/mo GBP** unless cancelled |
| **Match Desk Pass** | One-time pack **1 · £8 / 5 · £25 / 10 · £30** · same 14d / 3-desk trial in-app · after trial keeps purchased credits |

Cancel anytime → **Settings → Manage billing** → Polar customer portal.

Copy brand: **CoComms** only (no Gemini / OBS / BYO / Speaks on Pricing).

## Live vs blocked

| Piece | Status |
|-------|--------|
| Checkout / portal / webhook routes | **Live in repo** (`/api/billing/*`, `/api/billing/polar/webhook`) |
| Provider switch | Polar → Stripe → app-side trial |
| Org | **Ronnie Dog Media** (`ronnie-dog-media`) — default presentment **GBP** |
| Products | **Created** — Unlimited £22/mo + 14d trial; Pass 1 £8 / 5 £25 / 10 £30 |
| Webhook endpoint | **Live** → `https://www.cocomms.online/api/billing/polar/webhook` |
| Product IDs + access token + webhook secret on Netlify | **Set on pitchline-app production** (never commit secrets) |
| Real charged checkouts | **Ready for Chris smoke test** (card-upfront trial on Unlimited) |

## Chris must… (checklist)

1. Create / sign in at [polar.sh](https://polar.sh) (use **Sandbox** first if you want a dry run: [sandbox.polar.sh](https://sandbox.polar.sh)).
2. Create an organization (suggested slug: `cocomms`).
3. Create an **Organization Access Token** (Settings → Access tokens) with scopes roughly:
   - `checkouts:write`, `products:read`, `products:write`, `customers:read`, `customers:write`,
     `customer_sessions:write`, `subscriptions:read`, `orders:read`, `webhooks:read`, `webhooks:write`
4. Create products (dashboard **or** `npx tsx scripts/polar-seed-products.ts` once the token is in `.env`):

   | Product | Type | Price | Trial |
   |---------|------|-------|-------|
   | CoComms Unlimited | Subscription monthly | **£22.00 GBP** | **14 days** (card collected at checkout — Polar default for trials) |
   | CoComms Match Desk Pass 1 | One-time | **£8.00 GBP** | none on Polar; app grants 14d trial via webhook |
   | CoComms Match Desk Pass 5 | One-time | **£25.00 GBP** | same |
   | CoComms Match Desk Pass 10 | One-time | **£30.00 GBP** | same (floor pack so it doesn’t undercut Unlimited) |

5. Copy each **product id** (UUID) into Netlify env (below).
6. Webhooks → Add endpoint:
   - URL: `https://www.cocomms.online/api/billing/polar/webhook`
   - Events: `checkout.updated`, `order.paid`, `subscription.created`, `subscription.active`,
     `subscription.updated`, `subscription.canceled`, `subscription.revoked`
   - Copy the signing secret → `POLAR_WEBHOOK_SECRET`
7. Paste env vars on **Netlify site `pitchline-app` only**, then redeploy.
8. Smoke-test: Pricing → Checkout Unlimited (sandbox card) → Settings shows trial → Manage billing opens portal.

## Netlify env (`pitchline-app`)

```bash
# Prefer Polar (primary). Do NOT invent / paste fake secrets into git.
POLAR_ACCESS_TOKEN=          # polar_oat_… from Polar org settings
POLAR_WEBHOOK_SECRET=        # from webhook endpoint
POLAR_SERVER=production      # or sandbox
POLAR_PRODUCT_UNLIMITED=     # product UUID
POLAR_PRODUCT_PASS_1=
POLAR_PRODUCT_PASS_5=
POLAR_PRODUCT_PASS_10=
NEXT_PUBLIC_APP_URL=https://www.cocomms.online

# Stripe remains parked — leave unset (or keep for later). Code path only runs if Polar is NOT configured.
# STRIPE_SECRET_KEY=
# STRIPE_PRICE_UNLIMITED=price_1UEqHNDxFzIII5bI65Xe2X2k
# STRIPE_PRICE_PASS_1=price_1UEqHxDxFzIII5bIREWbhi3G
# STRIPE_PRICE_PASS_5=price_1UEqHyDxFzIII5bI10zezbCw
# STRIPE_PRICE_PASS_10=price_1UEqHzDxFzIII5bIOotem2LF
# STRIPE_WEBHOOK_SECRET=
```

Success / cancel URLs default to `https://www.cocomms.online/settings?billing=success` and
`/pricing?billing=cancel` (override via checkout body if needed).

## App routes

| Route | Role |
|-------|------|
| `POST /api/billing/checkout` | Polar or Stripe Checkout for Unlimited / Match Desk Pass |
| `POST /api/billing/portal` | Polar customer session portal (or Stripe portal) |
| `POST /api/billing/polar/webhook` | Unlock trial / plan / credits on `User` |
| `POST /api/billing/webhook` | Legacy Stripe webhook (inactive while Polar primary) |
| `GET /api/billing/status` | Trial snapshot + provider status |
| `POST /api/billing/trial` | App-side cancel / resume |

## Seed products via API

With `POLAR_ACCESS_TOKEN` (and optional `POLAR_SERVER=sandbox`) in `.env`:

```bash
npx tsx scripts/polar-seed-products.ts
```

Prints product UUIDs to paste into Netlify. Does nothing without a real token.

## Docs / Polar references

- Next.js adapter: https://polar.sh/docs/integrate/sdk/adapters/nextjs
- Trials (card collected, charge after trial): https://polar.sh/docs/features/subscriptions/trials
- Customer portal: https://polar.sh/docs/features/customer-portal/navigate-customers
- Checkout API: https://polar.sh/docs/features/checkout/session

## Live product IDs (ronnie-dog-media org)

| Env | Product UUID |
|-----|--------------|
| `POLAR_PRODUCT_UNLIMITED` | `b05cb997-f0a6-4830-9331-636bdf9fd25b` |
| `POLAR_PRODUCT_PASS_1` | `4cbbe0a6-b084-4073-85df-d6bd308c0049` |
| `POLAR_PRODUCT_PASS_5` | `a442296a-4569-4b3c-9cce-9c9e056329f0` |
| `POLAR_PRODUCT_PASS_10` | `e7166b4f-e3b1-427d-b83b-85eecb06326c` |

Webhook endpoint (enabled): `https://www.cocomms.online/api/billing/polar/webhook`  
Webhook id: `038933a1-35f8-49d6-bd3d-336c86a44c72`

These IDs are already set on Netlify `pitchline-app` (production + previews) together with `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET`.

## Stripe parking note

Existing Stripe price ids and routes remain. As soon as `POLAR_ACCESS_TOKEN` +
`POLAR_PRODUCT_UNLIMITED` are set, Checkout and Manage billing use Polar only.


## Production product IDs (safe to share)

```
POLAR_PRODUCT_UNLIMITED=c463ee10-0c73-4968-ae00-e0f5e4c2e31e
POLAR_PRODUCT_PASS_1=80ae93bc-a45a-496e-900d-72ef5233f3fd
POLAR_PRODUCT_PASS_5=b759f291-78cd-47b0-a3ad-62403a237586
POLAR_PRODUCT_PASS_10=3b6e02a2-f90e-4570-b99c-00fb2a3c41a4
```

Webhook endpoint id: `038933a1-35f8-49d6-bd3d-336c86a44c72` (secret only on Netlify).

## Welcome email

On first Polar trial unlock the webhook sends a one-shot CoComms welcome email
(idempotent via `User.welcomeEmailSentAt`). See **docs/WELCOME_EMAIL.md**.

Requires `RESEND_API_KEY` **or** `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` on
Netlify. Without mail env the webhook still unlocks trial and only logs a skip.


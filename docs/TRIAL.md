# CoComms trial model (for Chris)

## Locked customer process

1. **Start:** Stripe Checkout subscription for **Unlimited** with `trial_period_days=14` and `payment_method_collection=always` (card-upfront).
2. **During trial:** max **3 match desks** (`lib/trial.ts`).
3. **Default at trial end:** converts to Unlimited **£22/mo** unless cancelled.
4. **Mid-trial options:**
   - **Cancel anytime** (Customer Portal from Settings) → no Unlimited charge; access until trial end, then expired.
   - **Stay on Unlimited** → do nothing; card charged £22/mo after trial.
   - **Opt into pay-per-match:** buy a **Match Desk Pass** pack (1 / 5 / 10 credits) via Checkout `plan: "switch_to_pass"`. Webhook credits `matchPassCredits` and **cancels the Unlimited trial subscription** so it does not convert to £22.

## Product rules

| Rule | Value |
|------|--------|
| Trial length | **14 days** (not 48h-only) |
| Desk cap on trial | **3 match desks** |
| Converts to | **Unlimited £22/mo** unless cancelled |
| Card | Prefer **card-upfront** Checkout when billing keys exist |
| Cancel | Settings → Plan → **Cancel trial** / **Manage billing** (Customer Portal) |
| Pay-per-match | Match Desk Pass packs: **1 · £8** / **5 · £25** / **10 · £30** (one credit = one desk) |
| Demo | `@pitchline.app` accounts stay **uncapped** |

## Two modes

### A) Billing keys present (`STRIPE_SECRET_KEY` + `STRIPE_PRICE_UNLIMITED`)

1. Signup (`/signup`) creates the user + app trial row, then redirects to Checkout when configured.
2. Checkout creates a **subscription** with `trial_period_days: 14` and `payment_method_collection: always` (card upfront).
3. After trial, Unlimited £22 charges unless the customer cancels in the **Customer Portal** (Settings → Manage billing / cancel).
4. Mid-trial **switch to Match Desk Pass**: `POST /api/billing/checkout` with `{ plan: "switch_to_pass", credits: 1|5|10 }` → one-time payment; webhook sets credits and cancels Unlimited (immediate cancel while `trialing`).
5. Plain pack purchase (no switch): `{ plan: "match_pass", credits: 1|5|10 }` adds credits only.
6. Desk create enforces the **3-desk** cap while trial is active; after trial / on pass-only, spends `matchPassCredits` when creating a desk. Webhook sets `billingStatus` from Checkout / subscription events.

### B) Keys missing (current Netlify until Chris adds products)

1. Signup starts **app-side** trial: `billingStatus=trial`, `trialEndsAt = now+14d`.
2. Settings shows trial status, desks used / 3, days left, and **Cancel trial**.
3. Cancel sets `cancelAtPeriodEnd` + `billingStatus=cancelled`; access until `trialEndsAt`, **no convert**.
4. Resume (app-side only) clears cancel while still inside the window.
5. When keys appear later, same Settings buttons prefer Portal / Checkout — no UX redesign required.

## Entitlements

- `lib/trial.ts` — `buildTrialSnapshot`, `assertCanCreateDesk`, `maybeConsumeMatchPassCredit`
- `POST /api/match-days` — rejects 4th desk on trial (403) / expired without credits (402); spends a pass credit when applicable
- Demo `demo@pitchline.app` (and `@pitchline.app`) treated as **Unlimited** (no desk cap)

## Livemode price IDs (already created)

| SKU | Env | Price id |
|-----|-----|----------|
| Unlimited £22/mo | `STRIPE_PRICE_UNLIMITED` | `price_1UEqHNDxFzIII5bI65Xe2X2k` |
| Match Pass 1 · £8 | `STRIPE_PRICE_PASS_1` | `price_1UEqHxDxFzIII5bIREWbhi3G` |
| Match Pass 5 · £25 | `STRIPE_PRICE_PASS_5` | `price_1UEqHyDxFzIII5bI10zezbCw` |
| Match Pass 10 · £30 | `STRIPE_PRICE_PASS_10` | `price_1UEqHzDxFzIII5bIOotem2LF` |

Secret key + webhook secret must come from **Stripe Dashboard** (never commit).

## Chris blockers (billing)

Set on **pitchline-app only** (Netlify env):

1. `STRIPE_SECRET_KEY` (Dashboard → API keys)
2. `STRIPE_PRICE_UNLIMITED=price_1UEqHNDxFzIII5bI65Xe2X2k`
3. `STRIPE_PRICE_PASS_1=price_1UEqHxDxFzIII5bIREWbhi3G`
4. `STRIPE_PRICE_PASS_5=price_1UEqHyDxFzIII5bI10zezbCw`
5. `STRIPE_PRICE_PASS_10=price_1UEqHzDxFzIII5bIOotem2LF`
6. Optional `STRIPE_PUBLISHABLE_KEY`
7. Enable **Customer Portal** (cancel / payment method)
8. Webhook → `https://www.cocomms.online/api/billing/webhook` · events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` · set `STRIPE_WEBHOOK_SECRET`
9. `NEXT_PUBLIC_APP_URL=https://www.cocomms.online`

## Routes

| Route | Role |
|-------|------|
| `/` | Sales homepage (guests) |
| `/signup` | Trial signup |
| `/pricing` | Unlimited £22 + Match Desk Pass packs |
| `/settings` (Plan) | Trial status · mid-trial choices · cancel / portal / pass switch |
| `/api/billing/checkout` | Unlimited trial Checkout · `match_pass` / `switch_to_pass` |
| `/api/billing/portal` | Customer Portal |
| `/api/billing/status` | Snapshot + start app trial |
| `/api/billing/trial` | App-side cancel / resume |
| `/api/billing/webhook` | Signature verify + entitlement sync |

## Schema

`User.billingStatus`, `trialStartedAt`, `trialEndsAt`, `trialCancelledAt`, `cancelAtPeriodEnd`, `stripeCustomerId`, `stripeSubscriptionId`, `matchPassCredits` — migrations `20260912140000_user_billing_trial` + `20260912153000_user_match_pass_credits` (+ Netlify DB SQL mirrors).

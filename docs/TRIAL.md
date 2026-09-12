# CoComms trial model (for Chris)

## Locked customer process (choose at start)

At trial **START** the customer chooses **Unlimited** OR **Match Desk Pass** (1 / 5 / 10).

| Path | Checkout | Trial | After trial |
|------|----------|-------|-------------|
| **Unlimited** | `mode=subscription`, `trial_period_days=14`, `payment_method_collection=always` | 14 days · max **3 desks** | Converts to **£22/mo** unless cancelled via **Customer Portal** |
| **Match Desk Pass** | `mode=payment` for chosen pack (1·£8 / 5·£25 / 10·£30) | Same **14d / 3-desk** trial granted **in-app** by webhook | Keeps **purchased credits** (not Unlimited). Cancel mid-trial supported |

Both paths are **card-upfront**.

## Product rules

| Rule | Value |
|------|--------|
| Choose at start | Unlimited **or** Match Desk Pass (1 / 5 / 10) |
| Trial length | **14 days** |
| Desk cap on trial | **3 match desks** |
| Unlimited converts to | **£22/mo** unless cancelled (Customer Portal) |
| Pass after trial | Purchased `matchPassCredits` remain (one credit = one desk) |
| Card | **Card-upfront** Checkout when billing keys exist |
| Cancel | Unlimited → Portal; Pass → Settings Cancel trial (app-side) |
| Demo | `@pitchline.app` accounts stay **uncapped** |

## Two modes

### A) Billing keys present (`STRIPE_SECRET_KEY` + prices)

1. Signup (`/signup`) plan picker → account create → Checkout for the chosen plan.
2. **Unlimited:** subscription Checkout with 14-day trial + always collect payment method.
3. **Match Desk Pass:** one-time payment; webhook increments `matchPassCredits` and opens the same 14d trial window (`grantTrial`).
4. Desk create enforces the **3-desk** cap while trial is active; after trial / on pass-only, spends `matchPassCredits` when creating a desk.
5. Webhook sets `billingStatus`, Stripe ids; Unlimited `trialing` → `active` on conversion.

### B) Keys missing (until Chris finishes Netlify env)

1. Signup starts **app-side** trial: `billingStatus=trial`, `trialEndsAt = now+14d`.
2. Settings shows trial status, desks used / 3, days left, and **Cancel trial**.
3. Cancel sets `cancelAtPeriodEnd` + `billingStatus=cancelled`; access until `trialEndsAt`.
4. When keys appear later, same Settings / Checkout CTAs — no UX redesign required.

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

1. `STRIPE_SECRET_KEY` (Dashboard → API keys) — parent collects from Chris; do not set from agents
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
| `/` | Sales homepage (choose-at-start copy) |
| `/signup` | Plan picker + trial signup |
| `/pricing` | Unlimited vs Match Desk Pass packs |
| `/settings` (Plan) | Trial status · cancel / portal · Pass top-ups |
| `/api/billing/checkout` | `{ plan: "unlimited" }` · `{ plan: "match_pass", credits: 1\|5\|10 }` |
| `/api/billing/portal` | Customer Portal |
| `/api/billing/status` | Snapshot + start app trial |
| `/api/billing/trial` | App-side cancel / resume |
| `/api/billing/webhook` | Signature verify + entitlement sync |

## Schema

`User.billingStatus`, `trialStartedAt`, `trialEndsAt`, `trialCancelledAt`, `cancelAtPeriodEnd`, `stripeCustomerId`, `stripeSubscriptionId`, `matchPassCredits` — migrations `20260912140000_user_billing_trial` + `20260912153000_user_match_pass_credits` (+ Netlify DB SQL mirrors).

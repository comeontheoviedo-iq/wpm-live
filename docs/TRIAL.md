# CoComms trial model (for Chris)

## Product rules

| Rule | Value |
|------|--------|
| Trial length | **14 days** (not 48h-only) |
| Desk cap on trial | **3 match desks** |
| Converts to | **Unlimited £22/mo** unless cancelled |
| Card | Prefer **card-upfront** Checkout when billing keys exist |
| Cancel | Settings → Plan → **Cancel trial** (app-side) or **Manage billing / cancel** (Customer Portal when keys exist) |

## Two modes

### A) Billing keys present (`STRIPE_SECRET_KEY` + `STRIPE_PRICE_UNLIMITED`)

1. Signup (`/signup`) creates the user + app trial row, then redirects to Checkout when configured.
2. Checkout creates a **subscription** with `trial_period_days: 14` and `payment_method_collection: always` (card upfront).
3. After trial, Unlimited £22 charges unless the customer cancels in the **Customer Portal** (Settings → Manage billing / cancel).
4. Desk create still enforces the **3-desk** cap while `billingStatus` is trial (app entitlement). Mark `billingStatus=active` via webhook (TODO) or operator when paid.

### B) Keys missing (current Netlify until Chris adds products)

1. Signup starts **app-side** trial: `billingStatus=trial`, `trialEndsAt = now+14d`.
2. Settings shows trial status, desks used / 3, days left, and **Cancel trial**.
3. Cancel sets `cancelAtPeriodEnd` + `billingStatus=cancelled`; access until `trialEndsAt`, **no convert**.
4. Resume (app-side only) clears cancel while still inside the window.
5. When keys appear later, same Settings buttons prefer Portal / Checkout — no UX redesign required.

## Entitlements

- `lib/trial.ts` — `buildTrialSnapshot`, `assertCanCreateDesk`
- `POST /api/match-days` — rejects 4th desk on trial (403) / expired (402)
- Demo `demo@pitchline.app` (and `@pitchline.app`) treated as **Unlimited** (no desk cap)

## Chris blockers (billing)

Create in the billing Dashboard, then set on **pitchline-app only**:

1. Product **Unlimited** · recurring **£22/mo**
2. Copy price id → `STRIPE_PRICE_UNLIMITED`
3. `STRIPE_SECRET_KEY` (+ optional publishable key)
4. Enable **Customer Portal** (cancel / payment method)
5. Webhook → `https://www.cocomms.online/api/billing/webhook` · set `STRIPE_WEBHOOK_SECRET`
6. Prefer webhook handlers to flip `User.billingStatus` to `active` on `checkout.session.completed` / `customer.subscription.updated` (scaffold today)

## Routes

| Route | Role |
|-------|------|
| `/` | Sales homepage (guests) |
| `/signup` | Trial signup |
| `/pricing` | Unlimited £22 + trial CTA |
| `/settings` (Plan) | Trial status + cancel / portal |
| `/api/billing/checkout` | Card-upfront trial Checkout |
| `/api/billing/portal` | Customer Portal |
| `/api/billing/status` | Snapshot + start app trial |
| `/api/billing/trial` | App-side cancel / resume |

## Schema

`User.billingStatus`, `trialStartedAt`, `trialEndsAt`, `trialCancelledAt`, `cancelAtPeriodEnd`, `stripeCustomerId`, `stripeSubscriptionId` — migration `20260912140000_user_billing_trial` (+ Netlify DB SQL mirror).

# Lineup Verify (FotMob / SofaScore)

Commentators compare CoComms XI to trusted public sources via **Verify** on the desk safeguards row.

## What Verify does

- Opens **FotMob** and **SofaScore** search tabs for `Home vs Away YYYY-MM-DD` (Europe/London date).
- Shows **our side**: source badge (Official / Live / Predicted / Last XI), last sync time (Lon), starter counts, empty-slot warning.
- **No scrapers**, Puppeteer, or Netlify HTML fetch of FotMob/SofaScore (ToS + brittle). Human compare only.

## Official vs Live

- **Official** = kickoff named XI from API-Football startXI.
- **Live** = current pitch after substitutions (kickoff was Official). Live sync resets to kickoff Official then replays subst chronologically so repeated polls do not scramble slots.

## Pitch colour (FotMob-style)

- **Official / Live** → green striped pitch (matchday grass).
- **Predicted / Last XI** → distinct slate-blue striped pitch (not grass), so commentators never mistake a predicted XI for Official.


# CoComms DEMO video — Matchday Cut

**Cut:** short matchday energy (Strasbourg vs Monaco desk) — feature pass, not a tour dump  
**Length:** ~58s (target 45–90s)  
**Asset:** `/public/videos/cocomms-matchday-demo.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-matchday-demo.mp4`  
**Desk:** matchDayId `cmtuguaof0004rarmb9711ja5` — https://www.cocomms.online/match-day/cmtuguaof0004rarmb9711ja5  
**Login shown:** `chris@ronniedogmedia.com` (CB) — not demo@ / tester@  
**Audio:** silent bed (null AAC). **Chris VO TBD — captions = script.** Burned ASS captions match the VO script below so Chris can record over later.

## Voiceover script (timed captions)

Matchday.

You've got the mic.

CoComms is your commentary co-pilot.

Open the Strasbourg–Monaco desk.

Live feed. Score. Dynamic lineups on the pitch.

Scripts where your eyes need them.

Research filed into Notes — ready when the board goes up.

LEAGUE poster. HOOKS poster. DATA VIZ when you reopen it — not spam on the call.

The desk stays out of the way.

Stay on the call.

One matchday desk.

CoComms.

Start your trial — walk into the next kick-off ready.

## Shot list (sequenced)

| t | Visual | Beat |
|---|--------|------|
| 0–4s | Homepage (prod) | Matchday / co-pilot |
| 4–10.5s | Desk LIVE · Strasbourg–Monaco · pitch + XI · score · action ticker | Open desk · live feed / lineups |
| 10.5–16s | On-air chrome (clean) | Pitch hero · no intel clutter |
| 16–21.5s | Scripts | Scripts where eyes need them |
| 21.5–26.5s | Research | Prep filed · ready when board goes up |
| 26.5–31.5s | LEAGUE poster (full-screen, Esc) | Reopenable poster — not a flash |
| 31.5–36.5s | HOOKS poster (full-screen, Esc) | Quick narrative cards |
| 36.5–41.5s | DATA VIZ reopen (single card from Notes) | Reopenable viz — not spammy popup stack |
| 41.5–47s | Clean on-air desk | Desk stays out of the way |
| 47–52.5s | Homepage CTA | Start your trial |

## Do / don't

- **Do:** co-pilot language; Strasbourg–Monaco live desk; pitch + XI; live feed/score; Scripts/Research; LEAGUE / HOOKS / DATA VIZ as **posters**; action ticker if visible; on-air chrome  
- **Don't:** Gemini, OBS, BYO, Speaks, SaaS-shell framing; **no auto data-viz / live-intel flash spam** in frame (Clear / wait out / on-air; DATA VIZ only as intentional reopen)  
- **Footage:** public homepage + real desk UI as chris@ (scrubbed; no demo@ / tester@ login chrome)

## Rebuild (Air + box)

```bash
# Captures: scripts/capture-demo-stras-monaco.mjs (JWT session as chris@)
# Assemble on box (ffmpeg) from tmp/demo-video-stras or /workspace/demo-video-stras
# Silent + burned captions — Chris VO TBD
ffmpeg -y -f concat -safe 0 -i slides.txt -vf "ass=captions.ass" \
  -c:v libx264 -pix_fmt yuv420p -r 30 -movflags +faststart silent_captions.mp4
ffmpeg -y -i silent_captions.mp4 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -c:v copy -c:a aac -b:a 64k -shortest -movflags +faststart \
  public/videos/cocomms-matchday-demo.mp4
```

## Swap VO later

Replace audio only (keep burned captions, or re-burn without captions if Chris wants clean plate):

```bash
ffmpeg -y -i public/videos/cocomms-matchday-demo.mp4 -i NEW_VO.wav \
  -c:v copy -map 0:v:0 -map 1:a:0 -shortest -movflags +faststart \
  public/videos/cocomms-matchday-demo.mp4
```

# CoComms DEMO video — Matchday Cut

**Cut:** short matchday energy (not a feature tour)  
**Length:** ~46s (target 45–90s)  
**Asset:** `/public/videos/cocomms-matchday-demo.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-matchday-demo.mp4`  
**VO:** macOS `say -v Daniel` (en_GB). Chris can swap VO later — captions are burned in and match this script.

## Voiceover script

Matchday.

You've got the mic.

CoComms is your commentary co-pilot.

You bring the notes — and the voice.

We file the prep… so everything you need is ready when kick-off hits.

Open the desk.

Live feed on one side.

Dynamic lineups on the pitch.

Your Scripts and Notes — right where your eyes need them.

No scramble through tabs when the fourth official board goes up.

The desk stays out of the way… so you can stay on the call.

Need a player flash? Open a dossier.

Check the league.

Keep calling.

From prep… to live… to full time.

One matchday desk.

CoComms.

Commentary that stays seamless.

Start your trial — and walk into the next kick-off ready.

## Shot list (sequenced)

| t | Visual | Beat |
|---|--------|------|
| 0–4.5s | Homepage (prod) | Matchday / co-pilot |
| 4.5–10s | Live desk | Bring notes + voice; we file prep |
| 10–15.5s | On-air chrome | Live feed / lineups |
| 15.5–20.5s | Scripts | Scripts where eyes need them |
| 20.5–26s | Research / notes | No scramble when board goes up |
| 26–31s | Broadcast desk | Desk stays out of the way |
| 31–35s | Dossier | Player flash |
| 35–38.5s | League | Check league; keep calling |
| 38.5–42.5s | Post-match desk | Prep → live → FT |
| 42.5–46s | Homepage CTA | Start your trial |

## Do / don't

- **Do:** co-pilot language; bring notes + voice; we file prep; live feed / lineups / desk  
- **Don't:** Gemini, OBS, BYO, Speaks, SaaS-shell framing  
- **Footage:** public homepage + real desk UI (scrubbed; no demo@ / tester@ login chrome)

## Rebuild (Air)

```bash
# VO
say -v Daniel -r 145 -f tmp/demo-video/vo.txt -o tmp/demo-video/vo.aiff
afconvert -f WAVE -d LEI16@44100 tmp/demo-video/vo.aiff tmp/demo-video/vo.wav
# Assemble with ffmpeg (box or brew ffmpeg) from tmp/demo-video/slides + captions
```

## Swap VO later

Replace audio only:

```bash
ffmpeg -y -i public/videos/cocomms-matchday-demo.mp4 -i NEW_VO.wav \
  -c:v copy -map 0:v:0 -map 1:a:0 -shortest -movflags +faststart \
  public/videos/cocomms-matchday-demo.mp4
```

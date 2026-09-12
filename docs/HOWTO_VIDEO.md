# CoComms HOW-TO video — get the best out of it

**Cut:** short training walkthrough (Signup → desk → Research → Notes/Scripts → live basics)  
**Length:** ~63s (target 60–120s)  
**Asset:** `/public/videos/cocomms-howto.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-howto.mp4`  
**VO:** macOS `say -v Daniel` (en_GB). Chris can swap VO later — captions are burned in and match this script.

## Voiceover script

Here's how to get the best out of CoComms — your commentary co-pilot.

Start a free trial. Pick Unlimited… or a Match Desk Pass.

Create your account. Card-upfront. Fourteen days. Three desks to learn the workflow.

Open the Dashboard… and create a match desk for your fixture.

Then dump your research. Paste your prep into Research.

We file it where you need it — into Notes… and into Scripts.

Sort your buckets. Pin the hooks. Tidy the Scripts so you're not scrambling when the board goes up.

On matchday, open the live desk.

Feed sync keeps events flowing on one side.

Dynamic lineups sit on the pitch.

Need a poster… or a player flash? Open a dossier — then keep calling.

The desk stays out of the way… so you can stay on the call.

Bring your notes. Bring your voice.

From signup… to prep… to live.

One matchday desk.

CoComms.

Walk into the next kick-off ready.

## Shot list (sequenced)

| t | Visual | Beat |
|---|--------|------|
| 0–6s | Homepage (prod) | How-to / co-pilot |
| 6–14s | Signup · plan picker | Trial · Unlimited or Pass |
| 14–20.5s | Dashboard · Create desk | Stand up a match desk |
| 20.5–28.5s | Research | Research dump / paste prep |
| 28.5–34s | Notes | Filed into Notes |
| 34–39.5s | Scripts | Filed into Scripts · tidy hooks |
| 39.5–45.5s | Live desk | Open live desk · feed sync |
| 45.5–51.5s | Pitch / broadcast | Dynamic lineups on the pitch |
| 51.5–57s | Dossier | Poster / player flash |
| 57–63.4s | Homepage CTA | Signup → prep → live · ready |

## Do / don't

- **Do:** co-pilot language; signup/plan → create desk → Research dump → Notes/Scripts → live feed / pitch / posters  
- **Don't:** Gemini, OBS, BYO, Speaks, SaaS-shell framing  
- **Footage:** public homepage + signup; dashboard create-desk empty state; scrubbed desk UI stills (no live Strasbourg–Monaco capture)

## Rebuild (Air)

```bash
# VO
say -v Daniel -r 145 -f tmp/howto-video/vo.txt -o tmp/howto-video/vo.aiff
afconvert -f WAVE -d LEI16@44100 tmp/howto-video/vo.aiff tmp/howto-video/vo.wav
# Assemble with ffmpeg (box or brew ffmpeg) from tmp/howto-video /workspace/howto-video slides + captions
```

## Swap VO later

Replace audio only:

```bash
ffmpeg -y -i public/videos/cocomms-howto.mp4 -i NEW_VO.wav \
  -c:v copy -map 0:v:0 -map 1:a:0 -shortest -movflags +faststart \
  public/videos/cocomms-howto.mp4
```

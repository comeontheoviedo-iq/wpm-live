# CoComms DEMO video — HOMEPAGE TRAILER

**Cut:** TRAILER — salesy wow / co-pilot energy (not a how-to)  
**Length:** ~42s (target 30–45s)  
**Asset:** `/public/videos/cocomms-trailer.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-trailer.mp4`  
**Homepage:** hero points at trailer path. **Training** hub keeps Matchday Cut (`cocomms-matchday-demo.mp4`) + how-to separate.  
**Desk:** Strasbourg vs Monaco — matchDayId `cmtuguaof0004rarmb9711ja5`  
**Login shown:** `chris@ronniedogmedia.com` (CB) — not demo@ / tester@  
**Audio:** royalty-free self-generated sports-energy bed (see Music) + burned ASS captions for Chris VO tomorrow. Duck bed under captions.

## Music bed (license)

| Field | Value |
|-------|--------|
| Source | **Self-generated** ambient sports-energy bed (Python + stdlib `wave`) |
| File | built into trailer AAC; source WAV on assemble box `demo-video-trailer/music/sports-energy-bed.wav` |
| License | **Original / all rights owned by project** — not a commercial track; safe for site/demo use |
| Notes | ~118 BPM kick/snare pulse + ducked bass + shimmer. Volume ~0.22 under captions. **Never** replace with copyrighted commercial music. Prefer Mixkit / Pixabay / CC0 if swapping later — credit here. |

## Voiceover script (timed captions) — TRAILER

Matchday. You've got the mic.

CoComms — your commentary co-pilot.

Pitch alive. Score. Scrolling action ticker.

On-air chrome. Stay on the call.

STATS — when you need them.

LEAGUE poster. Instant context.

HOOKS. Narrative cards. Fast.

Scripts — where your eyes need them.

Research filed. Ready when the board goes up.

The desk stays out of the way.

One matchday desk. CoComms.  
Start your trial — walk into kick-off ready.

## Shot list (sequenced)

| t | Visual | Beat |
|---|--------|------|
| 0–3s | Homepage (prod) | Matchday / mic |
| 3–7s | Desk HT cut (Strasbourg–Monaco · pitch + XI) | Co-pilot · pitch alive |
| 7–11s | Desk live FT · NEXT ticker | Score · scrolling action ticker |
| 11–14s | On-air chrome | Stay on the call |
| 14–18s | STATS overlay | Intentional STATS — not spam flash |
| 18–21.5s | LEAGUE poster | Instant context |
| 21.5–25s | HOOKS poster | Narrative cards |
| 25–28s | Scripts | Eyes-ready |
| 28–31s | Research | Prep filed |
| 31–34.5s | Clean on-air desk | Desk stays out of the way |
| 34.5–42s | Homepage CTA | Trial / kick-off ready |

## Do / don't

- **Do:** trailer pacing; co-pilot tagline energy; Strasbourg–Monaco; pitch + XI; action ticker; STATS; LEAGUE / HOOKS posters; Scripts/Research; on-air chrome; burned captions for VO  
- **Don't:** tutorial tone; Gemini / OBS / BYO / Speaks / SaaS-shell framing; **no spammy data-viz popup flash stack**  
- **Footage:** public homepage + real desk UI as chris@

## Rebuild

```bash
# Captures: scripts/capture-trailer-stras-monaco.mjs + scripts/capture-trailer-posters.mjs
# Assemble on box (ffmpeg) from /workspace/demo-video-trailer
ffmpeg -y -f concat -safe 0 -i slides.txt -vf "ass=captions.ass" \
  -c:v libx264 -pix_fmt yuv420p -r 30 -movflags +faststart silent_captions.mp4
ffmpeg -y -i silent_captions.mp4 -i music/sports-energy-bed.wav \
  -filter_complex "[1:a]volume=0.22,afade=t=in:st=0:d=0.6,afade=t=out:st=40.5:d=1.5[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart \
  public/videos/cocomms-trailer.mp4
```

## Swap VO later

```bash
ffmpeg -y -i public/videos/cocomms-trailer.mp4 -i NEW_VO.wav \
  -filter_complex "[1:a][0:a]amix=inputs=2:duration=first:dropout_transition=2,volume=1[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -shortest -movflags +faststart \
  public/videos/cocomms-trailer.mp4
```

Or replace audio only and keep burned captions as VO guide.

# CoComms DEMO video — HOMEPAGE TRAILER

**Cut:** TRAILER — 30s promo following Chris’s script exactly  
**Length:** 30.0s  
**Asset:** `/public/videos/cocomms-trailer.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-trailer.mp4`  
**Homepage:** hero points at trailer path. **Training** hub keeps Matchday Cut (`cocomms-matchday-demo.mp4`) + how-to untouched.  
**Desk:** Strasbourg vs Monaco — matchDayId `cmtuguaof0004rarmb9711ja5`  
**Login shown:** `chris@ronniedogmedia.com` (CB) — not demo@ / tester@  
**Audio:** **NO MUSIC — Chris VO TBD.** Silent AAC bed only (so VO can be laid on tomorrow). Burned captions = the VO lines.

## Voiceover script (timed captions) — TRAILER

Kick-off’s approaching. Your research is scattered. Finding the right fact takes too long.

Meet CoComms, built for football commentators.

Bring match prep together in one clear workspace.

Find player details or match notes when you need them.

Spend less time searching, and more time telling the story.

Get matchday-ready. Try it free at cocomms.online.

## Shot list (sequenced)

| Time | Show | VO | On-screen |
|---|---|---|---|
| 0–4 | Chaos prep: Research + staged browser tabs / notes / team-sheet clutter | “Kick-off’s approaching. Your research is scattered. Finding the right fact takes too long.” | Too many tabs. Not enough time. |
| 4–8 | Reveal CoComms name, then clean Strasbourg–Monaco desk | “Meet CoComms, built for football commentators.” | Your matchday preparation, organised. |
| 8–15 | Feature 1: select fixture (dashboard boards) → open match desk | “Bring match prep together in one clear workspace.” | One clear workspace |
| 15–22 | Feature 2: player dossier (Filip Jörgensen) — facts enlarged | “Find player details or match notes when you need them.” | Facts when you need them |
| 22–26 | Ready-for-kickoff desk + on-air chrome | “Spend less time searching, and more time telling the story.” | Ready for the next big moment. |
| 26–30 | End card: logo, Try it free, cocomms.online — hold 4s | “Get matchday-ready. Try it free at cocomms.online.” | CoComms · Try it free · cocomms.online |

## Do / don't

- **Do:** follow this time table; max two features (fixture → desk, then player dossier); enlarge readable facts; burned VO captions; 4s end card; silent  
- **Don't:** music bed; tutorial tone; Gemini / OBS / BYO / Speaks; **no data-viz popup spam**; don't touch the Training how-to  
- **Footage:** real product screens (guest homepage unused in cut; dashboard + Strasbourg–Monaco desk as chris@). Chaos tabs are staged over Research.

## Rebuild

```bash
# Captures on Air: node scripts/capture-trailer-promo30.mjs
#   (needs /tmp/.cocomms_session_jwt)
# Assemble on box (ffmpeg) from /workspace/demo-video-promo30
ffmpeg -y -f concat -safe 0 -i clips/concat.txt -vf "ass=captions.ass" \
  -c:v libx264 -pix_fmt yuv420p -r 30 silent_captions.mp4
ffmpeg -y -i silent_captions.mp4 -f lavfi -i anullsrc=r=44100:cl=stereo \
  -c:v copy -c:a aac -shortest -movflags +faststart \
  public/videos/cocomms-trailer.mp4
```

## Swap VO later

```bash
ffmpeg -y -i public/videos/cocomms-trailer.mp4 -i NEW_VO.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest -movflags +faststart \
  public/videos/cocomms-trailer.mp4
```

Keep burned captions as the VO guide. **Do not add a music bed.**

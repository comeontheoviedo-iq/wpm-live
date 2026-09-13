# CoComms DEMO video — HOMEPAGE TRAILER

**Cut:** SALES TRAILER — stills-based wow cut (Ken Burns)  
**Length:** 35.0s  
**Asset:** `/public/videos/cocomms-trailer.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-trailer.mp4`  
**Homepage:** hero points at trailer path. **Training** hub keeps Matchday Cut (`cocomms-matchday-demo.mp4`) + how-to untouched.  

**Audio:** **MUSIC YES** — Pixabay royalty-free football bed (ducked ~−20 LUFS for VO headroom). **NO burned VO captions.** Chris VO TBD after script brainstorm.  

**Music track:** *Football Soccer Game Music 43 Second* by BombinSound  
**License:** Pixabay Content License (free commercial use)  
**License URL:** https://pixabay.com/service/license-summary/  
**Track page:** https://pixabay.com/music/percussion-football-football-soccer-game-music-43-second-490557/  

**Stills:** Chris Galatasaray pitch hero + approved desk stills (goal/sub v2, ticker, profile, stats, scripts, prep). Branded open/close reused from promo30.  

## Shot order

| Time | Shot |
|---|---|
| 0–3s | Branded title open (promo30) |
| 3–7s | Chris pitch — Galatasaray desk (hero) |
| 7–11s | Action ticker |
| 11–15s | GOAL popup (v2) |
| 15–18s | SUB popup (v2) |
| 18–21s | Player profile |
| 21–24s | STATS |
| 24–27s | Scripts |
| 27–30s | Prep Status |
| 30–35s | Branded end CTA — Try it free · cocomms.online |

## Do / don't

- **Do:** stills + subtle Ken Burns; music present but ducked for later VO; branded open/close; salesy wow  
- **Don't:** burned VO captions; Gemini / OBS / BYO / Speaks / SaaS-shell copy; tutorial tone; old pitch / old goal-sub stills  

## Swap VO later

```bash
ffmpeg -y -i public/videos/cocomms-trailer.mp4 -i NEW_VO.wav \
  -filter_complex "[0:a]volume=0.35[m];[m][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]" \
  -map 0:v:0 -map "[a]" -c:v copy -c:a aac -movflags +faststart \
  public/videos/cocomms-trailer.mp4
```

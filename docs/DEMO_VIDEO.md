# CoComms DEMO video — HOMEPAGE TRAILER

**Cut:** SALES TRAILER — stills-based wow cut (**static stills**, no Ken Burns / zoom / pan)  
**Length:** 35.0s  
**Asset:** `/public/videos/cocomms-trailer.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-trailer.mp4`  
**Homepage:** hero points at trailer path. **Training** hub keeps Matchday Cut (`cocomms-matchday-demo.mp4`) + how-to untouched.  

**Audio:** **MUSIC + Chris VO** — Pixabay royalty-free football bed ducked under Chris VO (sidechain-style ~−18 to −22 dB relative while speaking). **NO burned VO captions.** VO trimmed of leading/trailing silence (~2.6s / ~4.1s) and aligned near 0; trimmed VO ~31.8s, video holds to 35s end card.  

**Music track:** *Football Soccer Game Music 43 Second* by BombinSound  
**License:** Pixabay Content License (free commercial use)  
**License URL:** https://pixabay.com/service/license-summary/  
**Track page:** https://pixabay.com/music/percussion-football-football-soccer-game-music-43-second-490557/  

**Stills:** Chris Galatasaray pitch hero + approved desk stills (goal/sub v2, ticker, profile, stats, scripts, prep). Branded open/close reused from promo30 (those clips may keep existing motion). **Still segments are frozen frames only.**  

## Shot order

| Time | Shot |
|---|---|
| 0–3s | Branded title open (promo30) |
| 3–7s | Chris pitch — Galatasaray desk (hero) — STATIC |
| 7–11s | Action ticker — STATIC |
| 11–15s | GOAL popup (v2) — STATIC |
| 15–18s | SUB popup (v2) — STATIC |
| 18–21s | Player profile — STATIC |
| 21–24s | STATS — STATIC |
| 24–27s | Scripts — STATIC |
| 27–30s | Prep Status — STATIC |
| 30–35s | Branded end CTA — Try it free · cocomms.online |

## Do / don't

- **Do:** static stills (no zoom/pan); music + Chris VO (music ducked); branded open/close; salesy wow  
- **Don't:** Ken Burns / zoom / pan on stills; burned VO captions; Gemini / OBS / BYO / Speaks / SaaS-shell copy; tutorial tone; old pitch / old goal-sub stills  

## Re-mix VO

```bash
ffmpeg -y -i public/videos/cocomms-trailer.mp4 -i NEW_VO.m4a \
  -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=35,atrim=0:35[vo];[0:a]volume=0.55[m];[vo]asplit=2[sc][vm];[m][sc]sidechaincompress=threshold=0.012:ratio=10:attack=20:release=350[d];[d][vm]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v:0 -map "[a]" -c:v copy -c:a aac -movflags +faststart \
  public/videos/cocomms-trailer.mp4
```

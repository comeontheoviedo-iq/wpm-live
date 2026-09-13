# CoComms HOW-TO video — Training hub

**Cut:** Chris Beaumont's Loom of the real CoComms process (locked source of truth for Training how-to)  
**Length:** ~17 min (1032s)  
**Asset:** `/public/videos/cocomms-howto.mp4`  
**Public URL:** `https://www.cocomms.online/videos/cocomms-howto.mp4`  
**Training hub:** `/training` (account-only)  
**Encode:** H.264 + AAC, 1440×796, `+faststart` remux for web playback  

Homepage trailer stays `/videos/cocomms-trailer.mp4` — do not overwrite it with this asset.

## Source

Chris's training Loom (real process). Replaces the previous short bot stand-in walkthrough.

## Placement

| Surface | Path | Notes |
|---------|------|--------|
| Training hub | `/training` | How-to player → `/videos/cocomms-howto.mp4` |
| Static asset | `/videos/cocomms-howto.mp4` | Served from `public/videos/` |
| Homepage | trailer only | `cocomms-trailer.mp4` — untouched |

## Replace later

Drop a new export over `public/videos/cocomms-howto.mp4`, prefer remux with faststart:

```bash
ffmpeg -y -i NEW_LOOM.mp4 -c copy -movflags +faststart public/videos/cocomms-howto.mp4
```

Keep aspect — do not crop awkwardly if dimensions differ from site `aspect-video` frames (player uses `object-contain`).

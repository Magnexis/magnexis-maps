# Demo assets

| File | Description |
| --- | --- |
| `magnexis-maps-demo.mp4` | Product demo (~50s) — continuous live MapLibre camera + UI |
| `frames/` | Still frames grabbed during the same recording pass |
| `linkedin-post-draft.md` | Company Page post copy for LinkedIn |
| `record-demo.mjs` | Recorder (Playwright Edge + CDP screencast + ffmpeg) |

## Record a smooth demo

Requires Magnexis web on `http://localhost:3000`, Playwright (`npm i playwright`), system Edge, and ffmpeg.

```bash
set MAGNEXIS_DEMO_OUT=C:\Users\matth\OneDrive\Desktop\gitlab\magnexis-maps\docs\demo
node docs\demo\record-demo.mjs
```

(If Node can’t resolve `playwright` from the repo, run from a folder that has it installed, e.g. `%TEMP%\magnexis-demo-playwright`, and point `MAGNEXIS_DEMO_OUT` at `docs\demo`.)

The script drives `window.__mxMap` with long `flyTo` / `easeTo` moves, types search live, switches Magnexis Standard → Night, and encodes a 30 fps H.264 MP4 from a CDP screencast (not still Ken Burns frames).

Do **not** rebuild the MP4 from `seq/` stills — that path looks like a slideshow.

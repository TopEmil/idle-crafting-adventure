# Embervein

Idle crafting adventure in a bioluminescent underground forge. Built for **CrazyGames** HTML5 (Vite + TypeScript + PixiJS).

## Play locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. The CrazyGames SDK script loads from CDN; outside their iframe ads/data simply disable safely.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite server |
| `npm run build` | Typecheck + production build + `release/embervein.zip` |
| `npm test` | Economy & ad-gate unit tests |
| `npm run preview` | Preview `dist/` |

## Screenshots & storefront art

- Gameplay: [`docs/screenshots/`](docs/screenshots/)
- CrazyGames covers (title **Embervein** only): `release/covers/*.jpg`
- In-game cavern backdrop: `public/art/forge-bg.jpg`

## Submission package

After `npm run build`:

| Asset | Path |
| --- | --- |
| Game zip | `release/embervein.zip` |
| Landscape cover 1920×1080 | `release/covers/cover-1920x1080.jpg` |
| Portrait cover 800×1200 | `release/covers/cover-800x1200.jpg` |
| Square cover 800×800 | `release/covers/cover-800x800.jpg` |
| Landscape trailer ~18s | `release/trailers/embervein-landscape-18s.mp4` |
| Portrait trailer ~18s | `release/trailers/embervein-portrait-18s.mp4` |
| Metadata draft | `docs/store-metadata.md` |
| QA checklist | `docs/crazygames-checklist.md` |
| Leaderboard setup | `docs/leaderboard.md` |
| Design bible | `docs/design.md` |

Build budget: zip is well under the 15–18MB initial target (see `release/build-report.json`).

## CrazyGames portal (account required)

1. Log in at [developer.crazygames.com](https://developer.crazygames.com/)
2. Create game → upload `release/embervein.zip`
3. Upload covers (+ trailers)
4. Paste English metadata from `docs/store-metadata.md`
5. Run QA Tool against `docs/crazygames-checklist.md`
6. Submit **Basic Launch**

No portal credentials are stored in this repo — upload is the only remaining external step.

## Stack

- Vite + TypeScript
- PixiJS forge scene + HTML/CSS HUD overlay
- Fixed-timestep economy sim (~10 Hz)
- LocalStorage + CrazyGames SDK Data module
- Midgame / rewarded ads with disabled & adblock-safe paths

## License

Game content © project authors. Fonts: Fraunces & DM Sans (OFL via Fontsource).

# Embervein — CrazyGames QA / Submission Checklist

Use with the [CrazyGames Developer Portal](https://developer.crazygames.com/) QA Tool and docs.

## Build & package

- [ ] `npm run build` succeeds
- [ ] `release/embervein.zip` exists and is ≤18MB (target ≤15–18MB initial)
- [ ] File count ≤1500; no source maps shipping in zip
- [ ] Relative asset paths (`base: './'`) — works in iframe
- [ ] English UI only for v1

## SDK lifecycle

- [ ] `sdkGameLoadingStart` before load work
- [ ] `sdkGameLoadingStop` when interactive
- [ ] `gameplayStart` when player controls forge
- [ ] `gameplayStop` on sheets/modals/ads
- [ ] No custom fullscreen button

## Ads (ad-safe)

- [ ] Midgame only after expedition claim / prestige / major milestone modal close
- [ ] Never on Recipes / Expeditions / Forge / Ledger / settings open
- [ ] First midgame after ~3–5 min or first real expedition claim
- [ ] Rewarded: video affordance, equal “No thanks”, coin alternative
- [ ] No reward on `adError` / unfilled
- [ ] Ads disabled path: no freeze, no dead reward buttons
- [ ] Adblock: game fully playable; notice only on blocked rewards
- [ ] Mute/pause audio only during `adStarted`; resume on finish/error

## Persistence

- [ ] LocalStorage save/load
- [ ] SDK Data module cloud save with local fallback
- [ ] Offline progress cap + summary modal

## UX / iframe

- [ ] Lands in gameplay (≤1 click)
- [ ] Space / arrow keys do not scroll the host page
- [ ] Readable at common iframe sizes and `devicePixelRatio: 1`
- [ ] Touch targets usable on mobile

## Content

- [ ] Recipes, stations, expeditions, prestige (Reforge) playable
- [ ] Audio bed + SFX at consistent levels
- [ ] Onboarding skippable and visual-first

## Store assets

- [ ] Cover 1920×1080 (landscape)
- [ ] Cover 800×1200 (portrait)
- [ ] Cover 800×800 (square)
- [ ] Title only on covers — no borders, badges, or CrazyGames logo
- [ ] Trailers 15–20s landscape + portrait **or** recorded gameplay clips + high-quality stills
- [ ] Metadata draft in `docs/store-metadata.md`

## Portal (external account)

- [ ] Login to Developer Portal
- [ ] Upload zip + covers (+ trailers)
- [ ] Paste metadata
- [ ] Preview in QA Tool → submit **Basic Launch**

## Post–Basic Launch

- [ ] Monitor ≥7 days / ≥500 plays before Full Implementation push

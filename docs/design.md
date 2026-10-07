# Embervein — Design Bible

## Theme & fiction

You run a forge deep in a bioluminescent mineral cavern. Vein-light paints the stone cyan; your hearth burns ember-orange. Gather ore, craft tools, unlock stations, send scouts into glowing tunnels, and eventually **Reforge** the forge for permanent power.

Tone: hopeful craft fantasy, PEGI 12–friendly. No gore, gambling UI, or realistic violence.

## Visual identity

| Token | Value | Use |
| --- | --- | --- |
| Deep charcoal | `#0B1C22` | Base void / canvas clear |
| Teal cavern | `#163A44` | Mid-ground stone, panels |
| Ember orange | `#E85D04` | Primary CTA, craft burst, prestige |
| Amber spark | `#F48C06` | Hover / highlight |
| Cyan mineral | `#2EC4B6` | Vein glow, secondary accents |
| Pale mist | `#E8F1F2` | Body text |
| Soft slate | `#8FA8B0` | Secondary labels |

**Fonts (self-hosted):** Fraunces (display / brand), DM Sans (UI).

**Not allowed:** purple gradients, cream+serif terracotta, generic neon-purple dark-glow AI look.

**First viewport:** brand *Embervein*, forge scene full-bleed, resource strip, one primary CTA (Tap Vein / Craft). No card dashboard, no hero overlays/badges.

## Signature motion

1. **Ember pulse** — hearth glow breathes ~1.2s ease-in-out.
2. **Craft burst** — radial sparks on successful craft.
3. **Expedition return** — scout silhouette slides in + cyan trail before loot modal.

## Core loops

```
Gather → Craft → Unlock stations → Expeditions → Recipes/Gear → Reforge (prestige)
```

| Beat | Target |
| --- | --- |
| First purchase / tool | < 30 seconds |
| First real expedition claim | ~3–5 minutes |
| First prestige (Reforge) | ~45–90 minutes of engaged play |
| Offline catch-up | Capped (default 8h); always show summary modal |

## Economy targets

- Fixed-timestep sim at **10 Hz**; rendering independent.
- Soft cost curves (roughly ×1.15–1.22 per level).
- Always one visible next goal (recipe, station, or expedition).
- Prestige grants permanent production multiplier + cosmetic forge skin unlocks.
- Data-driven tables in `src/data/` — balance without code rewrites.

## Systems summary

1. **Resources:** Ore, Emberglass, Glowdust, Alloy, Relics (prestige currency).
2. **Stations:** Smelter → Anvil → Enchanter — each unlocks auto-production and changes forge look.
3. **Recipes:** Tools and gear that boost click power / station output.
4. **Expeditions:** Timed scout runs; return modal is primary midgame-ad hook.
5. **Offline:** Simulated ticks up to cap; summary lists gains.
6. **Reforge:** Reset production progress for Relics + permanent mult.

## HUD wireframes (notes)

### Main

```
┌──────────────────────────────────────────┐
│ Embervein          Ore Emberglass …  ⚙  │
│                                          │
│         [ full-bleed Pixi forge ]        │
│                                          │
│  [ Tap Vein ]              [ Craft ▸ ]   │
│  Recipes | Expeditions | Forge | Ledger  │
└──────────────────────────────────────────┘
```

Sheets slide up for Recipes / Expeditions / Forge / Ledger — not floating cards.

### Expedition return

```
┌────────────────────────────┐
│  Scouts returned           │
│  Loot list…                │
│  [ Claim ]  [ ▶ 2× Loot ]  │
│            [ No thanks ]   │
└────────────────────────────┘
```

Equal-weight “No thanks”; coin alternative when available; no reward on `adError`.

### Prestige (Reforge)

```
┌────────────────────────────┐
│  Reforge the Forge         │
│  Gain Relics + permanent × │
│  [ Reforge ] [ Not yet ]   │
└────────────────────────────┘
```

Midgame ad may fire **after** confirm modal closes — never mid-animation freeze without SDK callbacks.

## Ad flow (policy)

| Type | When | Never |
| --- | --- | --- |
| Midgame | After expedition claim, prestige confirm, major milestone | During active play; on nav/settings/shop open |
| Rewarded | Opt-in 2× loot, time-warp, cosmetic | Forced; reward on error |
| Banner | Optional on Ledger if open ≥5s avg | Over gameplay |

Pacing: first midgame after ~3–5 min **or** first real expedition claim. Mute/pause only in `adStarted`; always resume on `adFinished` / `adError`. Adblock: fully playable; notice only on blocked reward features. When ads disabled (Basic Launch): no freeze, no dead reward buttons.

## Platform

CrazyGames HTML5 SDK v3: loading start/stop, gameplay start/stop, midgame/rewarded, Data module + LocalStorage fallback. No custom fullscreen. Block iframe scroll on Space / arrows.

## Content depth (v1)

- ≥12 recipes across tools / gear / forge upgrades
- ≥4 expedition destinations with scaling timers & loot
- 3 stations + prestige cosmetics
- Audio bed + craft / claim / prestige SFX at consistent levels

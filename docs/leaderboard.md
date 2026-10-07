# Embervein — CrazyGames Leaderboard

Weekly ranks for **most ore mined**. Scores submit from the client; the leaderboard UI lives on the CrazyGames game page (drawer / widget), not as a fetched in-game list.

## Metric

| Field | Value |
| --- | --- |
| Score | Ore mined this CrazyGames week (`seasonOre`) |
| Season | Monday 09:00 UTC → next Monday 09:00 UTC |
| Sorting | Higher is better (`DESC`) |
| Incremental | `true` (idle totals grow during the week) |
| Guide (≤50 chars) | `Mine the most ore this week` |

All-time ore (`allTimeOre`) is tracked in the Ledger for the player but is **not** the board score — weekly seasons reset on the portal.

## Portal configuration (required)

CrazyGames leaderboards are **invite-only**. Ask your CrazyGames contact (or enable in the Developer Portal when available) with:

```json
{
  "encryptionKey": "PdDXstLKxiBgC6uSparNEyaKsSGs+HItmMa/+MsHma4=",
  "scoreLabel": "POINTS",
  "scoreSorting": "DESC",
  "minValue": 0.0,
  "maxValue": 1000000000000.0,
  "cooldownSeconds": 60,
  "isIncremental": true
}
```

Leaderboard guide text: `Mine the most ore this week`

Override the key locally with `VITE_CG_LEADERBOARD_KEY` if needed — it must match the portal.

## In-game behaviour

1. Every ore gain (tap, dwarf, stations, expedition loot, achievement packs) credits `seasonOre` + `allTimeOre`.
2. On save (~every 5s), if season score rose and local cooldown (≥60s) elapsed, encrypt + `SDK.user.submitScore`.
3. Ledger → **Miners' ranks** shows this week / all-time / time until season end.
4. Outside the CrazyGames iframe, submit is a safe no-op.

## Testing

1. Developer Portal → Preview → Logs tab.
2. Mine ore, wait for a save cycle (or ~60s after a prior submit).
3. Confirm a `submitScore` log line. Preview scores are not stored on the live board.

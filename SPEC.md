# Solo Mining Odds — App Spec

Standalone native mobile app replicating `/calculator` from basedmining.xyz.
Single screen. No auth, no wallet, no in-app purchases.

**Canonical math/UI source:** the website's
`v0-optimus-the-ai-platform-to-bu/app/calculator/CalculatorClient.tsx`.
This app's `src/lib/odds.ts` is a verbatim port — keep them in sync.

---

## Screen layout (top → bottom)

1. **Header** — "BasedMining" eyebrow, "Solo Mining Odds Calculator" title, animated Live dot.
2. **Input card**
   - BTC address text field (optional; only gates the Live Miners card).
   - "or" divider.
   - Hashrate number field + unit toggle (`MH/s … EH/s`).
   - Logarithmic slider (1 MH/s → 10 PH/s), shows current hashrate in the middle.
   - "Calculate Odds" button.
3. **Result card** (after Calculate) — big auto-scaling "1 in N" per-block odds,
   plus per-day odds and time estimate sub-boxes.
4. **Jackpot Meter** — progress bar toward expected next win.
5. **Live Miners** (only if a BTC address is entered) — worker/miner count + heat-map grid.
6. **Win Simulator** — "Simulate 30 Days" runs a Monte Carlo sim; shows blocks found,
   total earnings (BTC + USD), best/worst losing streaks, and a 30-day bar chart.
7. **Network + Based Pool stats** — two stat cards from live data.
8. **Share** — native share sheet, Post to X, Copy Link.

## Formulas (see `src/lib/odds.ts`)

- `p_you = userHashrate / networkHashrate`  (all in H/s)
- `soloOdds = 1 / p_you`
- per-day odds = `soloOdds / 144`  (144 blocks/day)
- `soloExpectedDays = 1 / (p_you * 144)`
- `blockReward = 50 / 2^floor(height / 210000)`
- `jackpotPct = min(0.35, 1 / (soloExpectedDays * 0.001))`
- 30-day sim: 4320 blocks, per-block Bernoulli trial against `p_you`, finder reward = block reward.

## Live data

| Source                                            | Fields used                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `api.basedmining.xyz/api/pool/status`             | hashrate_1m, user_count, worker_count, block_count, accepted/rejected_shares |
| `api.basedmining.xyz/api/bitcoin/status`          | height, network_difficulty, network_hashrate                                |
| `mempool.space/api/v1/prices`                     | USD (BTC price)                                                             |

Polled every 30s. All optional — UI shows "—" placeholders until loaded.

## Theme

- Light: bg `#f5f5f0`, card `#fff`, accent `#0000FF` (blue), fg black.
- Dark: bg `#000`, card `#0a0a0a`, accent `#FF6A00` (orange), fg white.
- Monospace body; sans-serif for the big numbers. 120px grid background.

## Deferred / follow-ups

- Port the canvas "Download odds card" PNG (needs `@capacitor/filesystem` + gallery perms).
- Deep-link state seeding (`?hash=&unit=`) to mirror the web share URLs.
- Bundle the BaseSans / BaseSansMono fonts (currently system mono/sans fallback).
- App icons + splash screen before store submission.

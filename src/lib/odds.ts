// ─── Solo-mining math + formatters ────────────────────────────────────────────
// Ported verbatim from basedmining.xyz: app/calculator/CalculatorClient.tsx and
// lib/utils/hashrate.ts. This file is the canonical math source for the app —
// keep it in sync with the website if the formulas ever change.

export type Unit = 'MH/s' | 'GH/s' | 'TH/s' | 'PH/s' | 'EH/s';

export const UNIT_MULTIPLIERS: Record<Unit, number> = {
  'MH/s': 1e6,
  'GH/s': 1e9,
  'TH/s': 1e12,
  'PH/s': 1e15,
  'EH/s': 1e18,
};

export const UNITS: Unit[] = ['MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
export const BLOCKS_PER_DAY = 144;

export function toHashrate(value: number, unit: Unit): number {
  return value * UNIT_MULTIPLIERS[unit];
}

export function getBlockReward(height: number): number {
  const halvings = Math.floor(height / 210000);
  return 50 / Math.pow(2, halvings);
}

// ─── Display formatters ────────────────────────────────────────────────────────
export function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e18) return `${(hashrate / 1e18).toFixed(2)} EH/s`;
  if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  return `${hashrate.toFixed(2)} H/s`;
}

export function formatOdds(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '∞';
  return Math.round(n).toLocaleString();
}

export function formatDays(days: number): string {
  if (!isFinite(days) || days > 1e9) return '∞';
  if (days < 1) return `${(days * 24).toFixed(1)}h`;
  if (days < 365) return `${days.toFixed(1)} days`;
  const years = days / 365;
  if (years >= 1000) return `${(years / 1000).toFixed(1)}k years`;
  return `${years.toFixed(1)} years`;
}

export function formatBtc(btc: number): string {
  if (btc < 0.0001) return btc.toExponential(4) + ' BTC';
  return btc.toFixed(6) + ' BTC';
}

// ─── 30-day Monte Carlo win simulation ─────────────────────────────────────────
export interface SimResult {
  wins: number;
  totalEarnings: number;
  dailyEarnings: number[];
  bestStreak: number; // shortest losing streak
  worstStreak: number; // longest losing streak
}

export function runSimulation(
  p_you: number,
  p_pool: number,
  onFinder: number,
  onPool: number,
): SimResult {
  const totalBlocks = 30 * BLOCKS_PER_DAY;
  const dailyEarnings: number[] = Array(30).fill(0);
  let wins = 0;
  let currentStreak = 0;
  const streaks: number[] = [];

  for (let b = 0; b < totalBlocks; b++) {
    const day = Math.floor(b / BLOCKS_PER_DAY);
    const rand = Math.random();
    let earned = 0;

    if (rand < p_you) {
      // You personally found the block
      earned = onFinder;
      wins++;
    } else if (rand < p_pool) {
      // Pool found the block, but not you — you still get shared portion
      earned = onPool;
      if (onPool > 0) wins++;
    }

    if (earned > 0) {
      dailyEarnings[day] += earned;
      if (currentStreak > 0) streaks.push(currentStreak);
      currentStreak = 0;
    } else {
      currentStreak++;
    }
  }
  if (currentStreak > 0) streaks.push(currentStreak);

  const bestStreak = streaks.length > 0 ? Math.min(...streaks) : totalBlocks;
  const worstStreak = streaks.length > 0 ? Math.max(...streaks) : totalBlocks;

  return {
    wins,
    totalEarnings: dailyEarnings.reduce((a, b) => a + b, 0),
    dailyEarnings,
    bestStreak,
    worstStreak,
  };
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import {
  BLOCKS_PER_DAY,
  formatBtc,
  formatDays,
  formatHashrate,
  formatOdds,
  getBlockReward,
  runSimulation,
  toHashrate,
  UNITS,
  type SimResult,
  type Unit,
} from './lib/odds';
import { fetchLiveData, type LiveData } from './lib/api';

// Slider: log scale from 1 MH/s (1e6) to 10 PH/s (1e16) → log10 6 .. 16
const SLIDER_MIN = 6;
const SLIDER_MAX = 16;

export default function Calculator() {
  const [hashrate, setHashrate] = useState<number>(1);
  const [unit, setUnit] = useState<Unit>('EH/s');
  const [btcAddress, setBtcAddress] = useState('');
  const [calculated, setCalculated] = useState(false);

  const [liveData, setLiveData] = useState<LiveData>({
    pool: null,
    bitcoin: null,
    btcPrice: null,
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Theme — defaults to dark; user can switch to light (persisted).
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return 'dark';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Auto-scaling odds number
  const [oddsFontSize, setOddsFontSize] = useState(96);
  const oddsRowRef = useRef<HTMLDivElement>(null);
  const oddsNumRef = useRef<HTMLSpanElement>(null);

  const sliderValue = Math.log10(toHashrate(hashrate, unit));
  const clampedSlider = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, sliderValue));

  // ── Fetch live data ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const data = await fetchLiveData();
      setLiveData(data);
      setDataLoaded(data.pool !== null && data.bitcoin !== null);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // ── Derived values (all hashrates in H/s) ──────────────────────────────────
  const userHashrateHs = toHashrate(hashrate, unit);
  const networkHashrateHs = liveData.bitcoin?.network_hashrate ?? 0;
  const poolHashrateHs = liveData.pool?.hashrate_1m ?? 0;
  const height = liveData.bitcoin?.height ?? 944530;
  const blockReward = getBlockReward(height);
  const btcPrice = liveData.btcPrice ?? 83000;
  const networkDifficulty = liveData.bitcoin?.network_difficulty ?? 0;

  const p_you = networkHashrateHs > 0 ? userHashrateHs / networkHashrateHs : 0;
  const soloOdds = p_you > 0 ? 1 / p_you : Infinity;
  const soloExpectedDays = p_you > 0 ? 1 / (p_you * BLOCKS_PER_DAY) : Infinity;
  const jackpotPct = Math.min(0.35, p_you > 0 ? 1 / (soloExpectedDays * 0.001) : 0);

  // ── Auto-scale the big odds number to fit the card ──────────────────────────
  const [winWidth, setWinWidth] = useState<number>(
    typeof window === 'undefined' ? 0 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const num = oddsNumRef.current;
    const row = oddsRowRef.current;
    if (!num || !row) return;

    const measure = () => {
      const n = oddsNumRef.current;
      const r = oddsRowRef.current;
      if (!n || !r) return;
      const rowWidth = r.offsetWidth;
      if (rowWidth <= 0) return;

      const computed = parseFloat(getComputedStyle(n).fontSize);
      const scroll = n.scrollWidth;
      if (!computed || !scroll) return;
      const unitPx = scroll / computed;

      const label = r.firstElementChild as HTMLElement | null;
      const labelWidth = label ? label.offsetWidth : 50;
      const gap = 8;
      const safety = 8;
      const available = rowWidth - labelWidth - gap - safety;
      if (available <= 0) return;

      const target = Math.max(10, Math.min(96, Math.floor(available / unitPx)));
      setOddsFontSize((prev) => (prev === target ? prev : target));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(row);
    ro.observe(num);
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [soloOdds, winWidth, calculated]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hs = Math.pow(10, parseFloat(e.target.value));
    if (hs >= 1e18) {
      setHashrate(hs / 1e18);
      setUnit('EH/s');
    } else if (hs >= 1e15) {
      setHashrate(hs / 1e15);
      setUnit('PH/s');
    } else if (hs >= 1e12) {
      setHashrate(hs / 1e12);
      setUnit('TH/s');
    } else if (hs >= 1e9) {
      setHashrate(hs / 1e9);
      setUnit('GH/s');
    } else {
      setHashrate(hs / 1e6);
      setUnit('MH/s');
    }
  }

  function handleCalculate() {
    setCalculated(true);
    setSimResult(null);
  }

  function handleSimulate() {
    setSimRunning(true);
    setTimeout(() => {
      setSimResult(runSimulation(p_you, p_you, blockReward, 0));
      setSimRunning(false);
    }, 600);
  }

  const shareUrl = `https://basedmining.xyz/calculator?hash=${hashrate}&unit=${encodeURIComponent(
    unit,
  )}`;
  const dailyOdds = soloOdds === Infinity ? Infinity : soloOdds / BLOCKS_PER_DAY;
  const shareMessage = `My Solo Mining Odds:\n1 in ${
    dailyOdds === Infinity ? '∞' : formatOdds(dailyOdds)
  } Per Day\n\nHashrate: ${hashrate} ${unit}\n\nCheck yours:\n${shareUrl}`;

  async function handleShare() {
    try {
      await Share.share({
        title: 'My Solo Mining Odds',
        text: shareMessage,
        url: shareUrl,
        dialogTitle: 'Share your odds',
      });
    } catch {
      /* user cancelled / unsupported */
    }
  }

  async function handleCopyLink() {
    try {
      await Clipboard.write({ string: shareUrl });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function handleShareX() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`,
      '_blank',
    );
  }

  // ── Pool display values ─────────────────────────────────────────────────────
  const activeMiners = liveData.pool?.user_count ?? '—';
  const poolHashrateDisplay = formatHashrate(poolHashrateHs);
  const shareAcceptance = liveData.pool
    ? (
        (liveData.pool.accepted_shares /
          (liveData.pool.accepted_shares + liveData.pool.rejected_shares + 1)) *
        100
      ).toFixed(1)
    : '—';

  return (
    <main className="app">
      <div className="grid-bg" />
      <div className="container">
        {/* ── Header ── */}
        <div className="header">
          <div className="brand">
            <img className="logo" src="logo.png" alt="BasedMining" />
            <div>
              <p className="eyebrow mb-8">BasedMining</p>
              <h1>Solo Mining Odds Calculator</h1>
            </div>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                // sun → tap for light
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                // moon → tap for dark
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <div className="live">
              <span className="dot" />
              <span>Live</span>
            </div>
          </div>
        </div>

        {/* ── Input card ── */}
        <div className="card">
          <label className="label">BTC Address</label>
          <input
            className="text-input"
            type="text"
            value={btcAddress}
            onChange={(e) => setBtcAddress(e.target.value)}
            placeholder="bc1q..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          <div className="or-divider">
            <div className="rule" />
            <span>or</span>
            <div className="rule" />
          </div>

          <label className="label">Hashrate</label>
          <div className="hash-row">
            <input
              className="num"
              type="number"
              inputMode="decimal"
              value={hashrate}
              min={0.001}
              onChange={(e) => setHashrate(parseFloat(e.target.value) || 0)}
            />
            {UNITS.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`unit-btn${unit === u ? ' active' : ''}`}
              >
                {u}
              </button>
            ))}
          </div>

          <div className="slider-wrap">
            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={0.01}
              value={clampedSlider}
              onChange={handleSliderChange}
            />
            <div className="slider-legend">
              <span>1 MH/s</span>
              <span className="mid">{formatHashrate(userHashrateHs)}</span>
              <span>10 PH/s</span>
            </div>
          </div>

          <button className="btn-primary" onClick={handleCalculate}>
            Calculate Odds
          </button>
        </div>

        {/* ── Results ── */}
        {calculated && (
          <>
            {/* Main result */}
            <div className="card" style={{ isolation: 'isolate' }}>
              <p className="eyebrow mb-8">Your Solo Odds</p>
              <p className="label-sm mb-12">Chance Per Block</p>

              <div className="odds-row" ref={oddsRowRef}>
                <span className="in">1 in</span>
                <span
                  className="num"
                  ref={oddsNumRef}
                  style={{ fontSize: `${oddsFontSize}px` }}
                >
                  {soloOdds === Infinity ? '∞' : formatOdds(soloOdds)}
                </span>
              </div>

              <div className="subbox-grid">
                <div className="subbox divider">
                  <p className="label-sm">Chance Per Day</p>
                  <p className="big tnum">
                    1 in {soloOdds === Infinity ? '∞' : formatOdds(soloOdds / BLOCKS_PER_DAY)}
                  </p>
                </div>
                <div className="subbox">
                  <p className="label-sm">Time Estimate</p>
                  <p className="big tnum">{formatDays(soloExpectedDays)}</p>
                </div>
              </div>
            </div>

            {/* Jackpot meter */}
            <div className="card">
              <p className="label">Jackpot Meter</p>
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{ width: `${Math.max(2, jackpotPct * 100)}%` }}
                />
                <div
                  className="meter-marker"
                  style={{ left: `${Math.max(2, jackpotPct * 100)}%` }}
                />
              </div>
              <div className="meter-legend">
                <span>0 days</span>
                <span>{formatDays(soloExpectedDays)}</span>
              </div>
              <p className="meter-note">
                Next expected win:{' '}
                <span className="accent">{formatDays(soloExpectedDays)}</span>
              </p>
            </div>

            {/* Live miners — only when BTC address entered */}
            {btcAddress.trim() && (
              <div className="card">
                <div className="miners-line">
                  <span className="dot" style={{ background: 'var(--accent)' }} />
                  <span className="sans">
                    <strong>{liveData.pool?.worker_count ?? '—'}</strong> workers currently
                    hashing
                  </span>
                  <span className="muted">({liveData.pool?.user_count ?? '—'} miners)</span>
                </div>
                <div className="heat-grid">
                  {Array.from({
                    length: Math.max(8, (liveData.pool?.worker_count ?? 4) * 2),
                  }).map((_, i) => (
                    <div
                      key={i}
                      className="heat-cell"
                      style={{
                        backgroundColor:
                          i < (liveData.pool?.worker_count ?? 4)
                            ? `rgba(var(--accent-rgb),${0.3 + ((i * 37) % 50) / 100})`
                            : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Win simulator */}
            <div className="card">
              <p className="label">Win Simulator</p>
              <button
                className="btn-outline"
                onClick={handleSimulate}
                disabled={simRunning}
              >
                {simRunning ? 'Simulating…' : '▷  Simulate 30 Days'}
              </button>

              {simResult && (
                <div className="mt-16" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="stat-grid cols-3">
                    <div className="stat-cell">
                      <p className="label-sm">Blocks Found</p>
                      <p className="val" style={{ fontSize: 20 }}>
                        {simResult.wins}
                      </p>
                    </div>
                    <div className="stat-cell">
                      <p className="label-sm">Total Earnings</p>
                      <p className="val">
                        {simResult.totalEarnings === 0
                          ? '0.000 BTC'
                          : formatBtc(simResult.totalEarnings)}
                      </p>
                      <p className="sub">
                        $
                        {(simResult.totalEarnings * btcPrice).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div className="stat-cell">
                      <p className="label-sm">Best Streak</p>
                      <p className="val">{simResult.bestStreak.toLocaleString()} blocks</p>
                      <p className="sub">without a win</p>
                    </div>
                  </div>

                  <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="stat-cell" style={{ borderRight: 'none' }}>
                      <p className="label-sm">Worst Streak</p>
                      <p className="val">{simResult.worstStreak.toLocaleString()} blocks</p>
                      <p className="sub">without a win</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-sm">30-Day Overview</p>
                    <div className="sim-chart">
                      {simResult.dailyEarnings.map((earn, i) => {
                        const maxEarn = Math.max(...simResult.dailyEarnings, 0.000001);
                        const heightPct = earn > 0 ? Math.max(8, (earn / maxEarn) * 100) : 0;
                        return (
                          <div
                            key={i}
                            className="sim-bar"
                            title={`Day ${i + 1}: ${earn > 0 ? formatBtc(earn) : '0 BTC'}`}
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: earn > 0 ? 'var(--accent)' : 'var(--fg-05)',
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="chart-legend">
                      <span>Day 1</span>
                      <span>Day 30</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Network + pool stats */}
            <div className="two-col">
              {/* Network */}
              <div className="card">
                <div className="section-head">
                  <span className="sq green" />
                  <p>Network</p>
                </div>
                <div className="stat-grid cols-3">
                  <div className="stat-cell">
                    <p className="label-sm">Hashrate</p>
                    <p className="val">{dataLoaded ? formatHashrate(networkHashrateHs) : '—'}</p>
                  </div>
                  <div className="stat-cell">
                    <p className="label-sm">Difficulty</p>
                    <p className="val">
                      {dataLoaded ? `${(networkDifficulty / 1e12).toFixed(2)}T` : '—'}
                    </p>
                  </div>
                  <div className="stat-cell">
                    <p className="label-sm">Block Height</p>
                    <p className="val">{dataLoaded ? `#${height.toLocaleString()}` : '—'}</p>
                  </div>
                </div>
                <div className="stat-grid cols-3 no-top">
                  <div className="stat-cell">
                    <p className="label-sm">Block Reward</p>
                    <p className="val">{blockReward} BTC</p>
                  </div>
                  <div className="stat-cell">
                    <p className="label-sm">BTC Price</p>
                    <p className="val">
                      {dataLoaded && btcPrice ? `$${btcPrice.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div className="stat-cell">
                    <p className="label-sm">Diff. Adjust</p>
                    <p className="val">—</p>
                  </div>
                </div>
              </div>

              {/* Based Pool */}
              <div className="card">
                <div className="section-head">
                  <span className="sq accent" />
                  <p>Based Pool</p>
                </div>
                <div className="stat-grid cols-2">
                  <div className="stat-cell">
                    <p className="label-sm">Pool Hashrate</p>
                    <p className="val">{dataLoaded ? poolHashrateDisplay : '—'}</p>
                  </div>
                  <div className="stat-cell">
                    <p className="label-sm">Active Miners</p>
                    <p className="val">{dataLoaded ? String(activeMiners) : '—'}</p>
                  </div>
                </div>
                <div className="stat-grid cols-2 no-top">
                  <div className="stat-cell">
                    <p className="label-sm">Pool Luck</p>
                    <p className="val">{dataLoaded ? `${shareAcceptance}%` : '—'}</p>
                  </div>
                  <div className="stat-cell">
                    <p className="label-sm">Last Block</p>
                    <p className="val">
                      {dataLoaded ? ((liveData.pool?.block_count ?? 0) > 0 ? 'Found' : '—') : '—'}
                    </p>
                  </div>
                </div>
                <div className="pool-link-wrap">
                  <a
                    className="pool-link"
                    href="https://basedmining.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    The next gen solo pool! →
                  </a>
                </div>
              </div>
            </div>

            {/* Share */}
            <div className="card">
              <p className="label">Share Your Odds</p>
              <div className="share-grid">
                <button className="share-btn" onClick={handleShare}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
                    <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                  </svg>
                  <span>Share</span>
                </button>
                <button className="share-btn" onClick={handleShareX}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Post to X</span>
                </button>
                <button className="share-btn" onClick={handleCopyLink}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                    <rect x="9" y="9" width="13" height="13" rx="0" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

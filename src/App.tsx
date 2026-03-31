import { useState, useMemo, useCallback } from 'react';
import {
  computeTripletRate,
  sweepParameter,
  emissionSpectrum,
  wavelengthToColor,
  LANTHANIDES,
  BETA_DEFAULT,
  K_S_DEFAULT,
  type PhysicsParams,
  type LanthanideData,
} from './physics';
import './App.css';

type SweepParam = 'hso' | 'deltaEST' | 'distance';

const SWEEP_LABELS: Record<SweepParam, string> = {
  hso: 'H_SO (cm⁻¹)',
  deltaEST: 'ΔE_ST (cm⁻¹)',
  distance: 'r (Å)',
};

const SWEEP_RANGES: Record<SweepParam, [number, number]> = {
  hso: [100, 5000],
  deltaEST: [100, 10000],
  distance: [1, 15],
};

function App() {
  const [lanthanide, setLanthanide] = useState<string>('Ir');
  const [hsoManual, setHsoManual] = useState<number | null>(null);
  const [deltaEST, setDeltaEST] = useState(3000);
  const [distance, setDistance] = useState(2.0);
  const [sweepParam, setSweepParam] = useState<SweepParam>('hso');

  const lantData: LanthanideData = LANTHANIDES[lanthanide];
  const hso = hsoManual ?? lantData.hso0;

  const params: PhysicsParams = useMemo(
    () => ({ hso, deltaEST, distance, beta: BETA_DEFAULT, kS: K_S_DEFAULT }),
    [hso, deltaEST, distance]
  );

  const result = useMemo(() => computeTripletRate(params), [params]);

  const sweepData = useMemo(
    () => sweepParameter(params, sweepParam, SWEEP_RANGES[sweepParam][0], SWEEP_RANGES[sweepParam][1]),
    [params, sweepParam]
  );

  const spectrum = useMemo(
    () => emissionSpectrum(lantData.emissionPeak, result.kT, params.kS, deltaEST),
    [lantData.emissionPeak, result.kT, params.kS, deltaEST]
  );

  const handleLanthanide = useCallback((key: string) => {
    setLanthanide(key);
    setHsoManual(null);
  }, []);

  return (
    <div className="app">
      {/* Status bar */}
      <div className="status-bar">
        <span className="status-item">
          <span className="status-dot active" />
          LIVE
        </span>
        <span className="status-item">MODEL: 1ST-ORDER PERTURBATION</span>
        <span className="status-item">
          SPECIES: {lantData.name.toUpperCase()} ({lantData.symbol}, Z={lantData.Z})
        </span>
        <span className="status-item status-right">
          k_T = <span className="status-value">{result.kT.toExponential(2)}</span> s⁻¹
        </span>
      </div>

      <header className="header">
        <div className="header-left">
          <h1>Triplet-State Brightening</h1>
          <p className="header-sub">
            Spin-orbit coupling perturbation theory
          </p>
        </div>
        <div className="header-equation">
          k<sub>T</sub> &thinsp;=&thinsp; (⟨S₁|H<sub>SO</sub>|T₁⟩ / ΔE<sub>ST</sub>)² &middot; k<sub>S</sub>
          &emsp;|&emsp;
          H<sub>SO</sub>(r) = H<sub>SO</sub><sup>0</sup> &middot; e<sup>−βr</sup>
        </div>
      </header>

      <div className="main-grid">
        {/* LEFT COL: Controls + Results */}
        <div className="left-col">
          <section className="inst-panel">
            <div className="inst-header">
              <span className="inst-title">Input Parameters</span>
            </div>

            <div className="inst-body">
              <div className="param-section">
                <div className="param-section-label">Heavy Atom Selection</div>
                <div className="lanthanide-grid">
                  {Object.entries(LANTHANIDES).map(([key, data]) => (
                    <button
                      key={key}
                      className={`ln-btn ${lanthanide === key ? 'selected' : ''}`}
                      onClick={() => handleLanthanide(key)}
                    >
                      <span className="ln-sym">{data.symbol}</span>
                      <span className="ln-meta">{data.Z}</span>
                    </button>
                  ))}
                </div>
              </div>

              <SliderControl
                label="H_SO"
                desc="spin-orbit coupling"
                value={hso}
                min={50}
                max={6000}
                step={10}
                unit="cm⁻¹"
                onChange={(v) => setHsoManual(v)}
              />

              <SliderControl
                label="ΔE_ST"
                desc="singlet-triplet gap"
                value={deltaEST}
                min={100}
                max={10000}
                step={50}
                unit="cm⁻¹"
                onChange={setDeltaEST}
              />

              <SliderControl
                label="r"
                desc="donor-acceptor distance"
                value={distance}
                min={1}
                max={15}
                step={0.1}
                unit="Å"
                onChange={setDistance}
              />
            </div>
          </section>

          <section className="inst-panel">
            <div className="inst-header">
              <span className="inst-title">Computed Output</span>
              <span className="inst-badge">REAL-TIME</span>
            </div>
            <div className="inst-body">
              <table className="readout-table">
                <tbody>
                  <ReadoutRow label="H_SO(eff)" value={result.hsoEffective.toFixed(1)} unit="cm⁻¹" />
                  <ReadoutRow label="⟨mix⟩²" value={result.mixingCoeff2.toExponential(2)} />
                  <ReadoutRow label="k_T" value={result.kT.toExponential(2)} unit="s⁻¹" highlight />
                  <ReadoutRow label="τ_T" value={formatTime(result.tauT)} highlight />
                  <ReadoutRow label="Φ_phos" value={(result.phosYield * 100).toFixed(1)} unit="%" highlight />
                  <ReadoutRow label="k_T/k_S" value={result.enhancement.toExponential(2)} />
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* CENTER: Jablonski + Spectrum */}
        <div className="center-col">
          <section className="inst-panel jablonski-section">
            <div className="inst-header">
              <span className="inst-title">Energy Level Diagram</span>
              <span className="inst-meta">Jablonski representation</span>
            </div>
            <div className="inst-body">
              <JablonskiDiagram params={params} result={result} lantData={lantData} />
            </div>
          </section>

          <section className="inst-panel">
            <div className="inst-header">
              <span className="inst-title">Emission Spectrum</span>
              <span className="inst-meta">Gaussian lineshape model</span>
            </div>
            <div className="inst-body">
              <SpectrumPlot spectrum={spectrum} lantData={lantData} />
            </div>
          </section>
        </div>

        {/* RIGHT: Rate plot */}
        <div className="right-col">
          <section className="inst-panel">
            <div className="inst-header">
              <span className="inst-title">Parameter Sweep</span>
            </div>
            <div className="inst-body">
              <div className="sweep-tabs">
                {(['hso', 'deltaEST', 'distance'] as SweepParam[]).map((p) => (
                  <button
                    key={p}
                    className={`sweep-tab ${sweepParam === p ? 'active' : ''}`}
                    onClick={() => setSweepParam(p)}
                  >
                    {SWEEP_LABELS[p]}
                  </button>
                ))}
              </div>
              <RatePlot
                data={sweepData}
                xLabel={SWEEP_LABELS[sweepParam]}
                currentX={params[sweepParam]}
              />
              <div className="sweep-note">
                Log₁₀ scale &middot; other parameters held fixed
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Sub-components                                       */
/* ────────────────────────────────────────────────────── */

function SliderControl({
  label, desc, value, min, max, step, unit, onChange,
}: {
  label: string; desc: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-desc">{desc}</span>
        <span className="slider-readout">{value}<span className="slider-unit">{unit}</span></span>
      </div>
      <div className="slider-track-wrap">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider"
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
        />
        <div className="slider-range">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}

function ReadoutRow({ label, value, unit, highlight }: {
  label: string; value: string; unit?: string; highlight?: boolean;
}) {
  return (
    <tr className={`readout-row ${highlight ? 'highlight' : ''}`}>
      <td className="readout-label">{label}</td>
      <td className="readout-value">
        {value}
        {unit && <span className="readout-unit">{unit}</span>}
      </td>
    </tr>
  );
}

function formatTime(seconds: number): string {
  if (seconds >= 1) return `${seconds.toFixed(2)} s`;
  if (seconds >= 1e-3) return `${(seconds * 1e3).toFixed(2)} ms`;
  if (seconds >= 1e-6) return `${(seconds * 1e6).toFixed(2)} μs`;
  if (seconds >= 1e-9) return `${(seconds * 1e9).toFixed(2)} ns`;
  return `${(seconds * 1e12).toFixed(2)} ps`;
}

/* ────────────────────────────────────────────────────── */
/*  Jablonski Diagram                                    */
/* ────────────────────────────────────────────────────── */

function JablonskiDiagram({
  params, result, lantData,
}: {
  params: PhysicsParams; result: ReturnType<typeof computeTripletRate>; lantData: LanthanideData;
}) {
  const w = 520, h = 320;
  const mixing = Math.min(result.mixingCoeff2 * 1e4, 1);
  const tripletBrightness = Math.min(result.kT / 1e6, 1);

  const groundY = h - 35;
  const s1Y = 55;
  const t1Y = s1Y + (params.deltaEST / 10000) * (groundY - s1Y - 50) + 25;

  const sX = w * 0.32;
  const tX = w * 0.68;
  const lw = 80;

  const traceColor = '#5b8def';
  const tripletColor = lantData.color;
  const dimColor = '#3a4555';
  const textColor = '#6b7a8d';
  const iscColor = '#d4a537';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="diagram-svg">
      <defs>
        <marker id="ah-s" viewBox="0 0 8 8" refX="4" refY="4"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={traceColor} />
        </marker>
        <marker id="ah-t" viewBox="0 0 8 8" refX="4" refY="4"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={tripletColor} />
        </marker>
        <marker id="ah-isc" viewBox="0 0 8 8" refX="4" refY="4"
          markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={iscColor} />
        </marker>
      </defs>

      {/* Column labels */}
      <text x={sX} y={18} textAnchor="middle" className="col-label">SINGLET</text>
      <text x={tX} y={18} textAnchor="middle" className="col-label">TRIPLET</text>

      {/* Ground state S0 */}
      <line x1={sX - lw/2} y1={groundY} x2={sX + lw/2} y2={groundY}
        stroke={dimColor} strokeWidth="2" />
      <line x1={tX - lw/2} y1={groundY} x2={tX + lw/2} y2={groundY}
        stroke={dimColor} strokeWidth="2" />
      <text x={(sX + tX) / 2} y={groundY + 16} textAnchor="middle"
        className="level-text">S₀</text>

      {/* S1 */}
      <line x1={sX - lw/2} y1={s1Y} x2={sX + lw/2} y2={s1Y}
        stroke={traceColor} strokeWidth="2" />
      <text x={sX - lw/2 - 8} y={s1Y + 4} textAnchor="end"
        className="level-text" fill={traceColor}>S₁</text>

      {/* T1 — opacity reflects mixing */}
      <line x1={tX - lw/2} y1={t1Y} x2={tX + lw/2} y2={t1Y}
        stroke={tripletColor} strokeWidth="2"
        opacity={0.35 + mixing * 0.65} />
      <text x={tX + lw/2 + 8} y={t1Y + 4} textAnchor="start"
        className="level-text" fill={tripletColor}
        opacity={0.5 + mixing * 0.5}>T₁</text>

      {/* Absorption: S0 → S1 (solid upward) */}
      <line x1={sX - 12} y1={groundY - 6} x2={sX - 12} y2={s1Y + 6}
        stroke={traceColor} strokeWidth="1.5" markerEnd="url(#ah-s)" />
      <text x={sX - 24} y={(groundY + s1Y) / 2 + 3} textAnchor="end"
        className="trans-label" fill={traceColor}>abs</text>

      {/* Fluorescence: S1 → S0 (dashed downward) */}
      <line x1={sX + 12} y1={s1Y + 6} x2={sX + 12} y2={groundY - 6}
        stroke={traceColor} strokeWidth="1.5" markerEnd="url(#ah-s)"
        strokeDasharray="4 3" opacity="0.7" />
      <text x={sX + 24} y={(groundY + s1Y) / 2 + 3} textAnchor="start"
        className="trans-label" fill={traceColor} opacity="0.7">fluor</text>

      {/* ISC: S1 → T1 (curved dashed) */}
      <path
        d={`M ${sX + lw/2 + 4} ${s1Y}
            C ${(sX + tX) / 2} ${s1Y - 15},
              ${(sX + tX) / 2} ${t1Y + 15},
              ${tX - lw/2 - 4} ${t1Y}`}
        stroke={iscColor} strokeWidth={1 + mixing * 1.5}
        fill="none" strokeDasharray="3 4"
        markerEnd="url(#ah-isc)"
        opacity={0.2 + mixing * 0.7}
      />
      <text x={(sX + tX) / 2} y={Math.min(s1Y, t1Y) - 6}
        textAnchor="middle" className="trans-label" fill={iscColor}
        opacity={0.3 + mixing * 0.6}>ISC</text>

      {/* Phosphorescence: T1 → S0 */}
      <line x1={tX + 12} y1={t1Y + 6} x2={tX + 12} y2={groundY - 6}
        stroke={tripletColor}
        strokeWidth={1 + tripletBrightness * 2}
        markerEnd="url(#ah-t)"
        opacity={0.15 + tripletBrightness * 0.75}
        strokeDasharray="5 3" />
      <text x={tX + 24} y={(groundY + t1Y) / 2 + 3} textAnchor="start"
        className="trans-label" fill={tripletColor}
        opacity={0.2 + tripletBrightness * 0.7}>phos</text>

      {/* SOC mixing line */}
      {mixing > 0.005 && (
        <g opacity={0.15 + mixing * 0.6}>
          <line x1={sX + lw/2 + 6} y1={s1Y}
            x2={tX - lw/2 - 6} y2={t1Y}
            stroke={iscColor} strokeWidth={0.8 + mixing * 1.2}
            strokeDasharray="2 5" />
          <text x={(sX + tX) / 2 + 8} y={(s1Y + t1Y) / 2 + 14}
            textAnchor="middle" className="mixing-label" fill={iscColor}>
            H_SO
          </text>
        </g>
      )}

      {/* ΔE_ST dimension line */}
      <line x1={tX + lw/2 + 22} y1={s1Y} x2={tX + lw/2 + 22} y2={t1Y}
        stroke={dimColor} strokeWidth="0.75" />
      <line x1={tX + lw/2 + 18} y1={s1Y} x2={tX + lw/2 + 26} y2={s1Y}
        stroke={dimColor} strokeWidth="0.75" />
      <line x1={tX + lw/2 + 18} y1={t1Y} x2={tX + lw/2 + 26} y2={t1Y}
        stroke={dimColor} strokeWidth="0.75" />
      <text x={tX + lw/2 + 30} y={(s1Y + t1Y) / 2 + 3}
        className="dim-label" fill={textColor}>ΔE_ST</text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Rate Sweep Plot                                      */
/* ────────────────────────────────────────────────────── */

function RatePlot({
  data, xLabel, currentX,
}: {
  data: { x: number; y: number }[];
  xLabel: string;
  currentX: number;
}) {
  const w = 320, h = 300;
  const pad = { top: 24, right: 16, bottom: 36, left: 52 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const xMin = data[0]?.x ?? 0;
  const xMax = data[data.length - 1]?.x ?? 1;
  const yVals = data.map((d) => d.y).filter((v) => v > 0);
  const yMin = Math.min(...yVals) || 1;
  const yMax = Math.max(...yVals) || 1e8;

  const logMin = Math.log10(Math.max(yMin, 1));
  const logMax = Math.log10(yMax);

  const scaleX = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * pw;
  const scaleY = (y: number) => {
    const log = Math.log10(Math.max(y, 1));
    return pad.top + ph - ((log - logMin) / (logMax - logMin || 1)) * ph;
  };

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.x).toFixed(1)} ${scaleY(d.y).toFixed(1)}`)
    .join(' ');

  const cursorPoint = data.reduce((best, d) =>
    Math.abs(d.x - currentX) < Math.abs(best.x - currentX) ? d : best, data[0]);
  const cx = scaleX(cursorPoint.x);
  const cy = scaleY(cursorPoint.y);

  const yTicks: number[] = [];
  for (let e = Math.floor(logMin); e <= Math.ceil(logMax); e++) {
    yTicks.push(e);
  }

  const traceColor = '#5b8def';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="plot-svg">
      {/* Plot area border */}
      <rect x={pad.left} y={pad.top} width={pw} height={ph}
        fill="none" stroke="#1e2a38" strokeWidth="1" />

      {/* Grid + tick labels */}
      {yTicks.map((e) => {
        const y = scaleY(10 ** e);
        return (
          <g key={e}>
            <line x1={pad.left} y1={y} x2={pad.left + pw} y2={y}
              stroke="#141e2a" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end"
              className="plot-tick">10<tspan dy="-4" fontSize="7">{e}</tspan></text>
          </g>
        );
      })}

      {/* Trace */}
      <path d={pathD} fill="none" stroke={traceColor} strokeWidth="1.5" />

      {/* Cursor crosshair */}
      <line x1={cx} y1={pad.top} x2={cx} y2={pad.top + ph}
        stroke="#d4a537" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.6" />
      <line x1={pad.left} y1={cy} x2={pad.left + pw} y2={cy}
        stroke="#d4a537" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.6" />
      <circle cx={cx} cy={cy} r="3" fill="none" stroke="#d4a537" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="1" fill="#d4a537" />

      {/* Axes labels */}
      <text x={pad.left + pw / 2} y={h - 4} textAnchor="middle" className="plot-axis">
        {xLabel}
      </text>
      <text x={8} y={pad.top - 8} className="plot-axis">
        k_T (s⁻¹)
      </text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Emission Spectrum                                    */
/* ────────────────────────────────────────────────────── */

function SpectrumPlot({
  spectrum, lantData,
}: {
  spectrum: { wavelength: number; singlet: number; triplet: number }[];
  lantData: LanthanideData;
}) {
  const w = 520, h = 190;
  const pad = { top: 16, right: 16, bottom: 48, left: 36 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const xMin = 350, xMax = 800;
  const scaleX = (wl: number) => pad.left + ((wl - xMin) / (xMax - xMin)) * pw;
  const scaleY = (v: number) => pad.top + ph - v * ph;

  const singletPath = spectrum
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.wavelength).toFixed(1)} ${scaleY(d.singlet).toFixed(1)}`)
    .join(' ');

  const tripletPath = spectrum
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.wavelength).toFixed(1)} ${scaleY(d.triplet).toFixed(1)}`)
    .join(' ');

  const rainbowStops = [];
  for (let nm = 380; nm <= 780; nm += 15) {
    const pct = ((nm - xMin) / (xMax - xMin)) * 100;
    rainbowStops.push(
      <stop key={nm} offset={`${pct}%`} stopColor={wavelengthToColor(nm)} stopOpacity="0.45" />
    );
  }

  const traceBlue = '#5b8def';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="plot-svg">
      <defs>
        <linearGradient id="vis-spectrum" x1="0" y1="0" x2="1" y2="0">
          {rainbowStops}
        </linearGradient>
      </defs>

      {/* Plot border */}
      <rect x={pad.left} y={pad.top} width={pw} height={ph}
        fill="none" stroke="#1e2a38" strokeWidth="1" />

      {/* Singlet trace */}
      <path d={singletPath} fill="none" stroke={traceBlue} strokeWidth="1.5" opacity="0.8" />

      {/* Triplet fill + trace */}
      <path d={`${tripletPath} L ${scaleX(800)} ${scaleY(0)} L ${scaleX(350)} ${scaleY(0)} Z`}
        fill={lantData.color} opacity="0.1" />
      <path d={tripletPath} fill="none" stroke={lantData.color} strokeWidth="1.5" />

      {/* Legend */}
      <line x1={pad.left + 8} y1={pad.top + 10} x2={pad.left + 22} y2={pad.top + 10}
        stroke={traceBlue} strokeWidth="1.5" />
      <text x={pad.left + 26} y={pad.top + 13} className="legend-text" fill={traceBlue}>
        S₁→S₀
      </text>

      <line x1={pad.left + 72} y1={pad.top + 10} x2={pad.left + 86} y2={pad.top + 10}
        stroke={lantData.color} strokeWidth="1.5" />
      <text x={pad.left + 90} y={pad.top + 13} className="legend-text" fill={lantData.color}>
        T₁→S₀
      </text>

      {/* Visible spectrum bar */}
      <rect x={pad.left} y={pad.top + ph + 3} width={pw} height={5}
        fill="url(#vis-spectrum)" />

      {/* Wavelength ticks */}
      {[400, 450, 500, 550, 600, 650, 700, 750].map((nm) => (
        <g key={nm}>
          <line x1={scaleX(nm)} y1={pad.top + ph} x2={scaleX(nm)} y2={pad.top + ph + 10}
            stroke="#2a3545" strokeWidth="0.75" />
          <text x={scaleX(nm)} y={pad.top + ph + 22} textAnchor="middle" className="plot-tick">
            {nm}
          </text>
        </g>
      ))}
      <text x={pad.left + pw / 2} y={h - 4} textAnchor="middle" className="plot-axis">
        λ (nm)
      </text>
    </svg>
  );
}

export default App;

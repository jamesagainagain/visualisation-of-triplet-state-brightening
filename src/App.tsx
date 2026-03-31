import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  distance: 'Distance (Å)',
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
      <header className="header">
        <h1>
          <span className="header-glow">Triplet-State Brightening</span>
        </h1>
        <p className="subtitle">
          Spin-orbit coupling perturbation theory — interactive visualisation
        </p>
      </header>

      <div className="main-grid">
        {/* LEFT: Controls */}
        <aside className="controls-panel">
          <div className="panel-label">Parameters</div>

          <div className="control-group">
            <label className="control-label">Lanthanide / Heavy Atom</label>
            <div className="lanthanide-grid">
              {Object.entries(LANTHANIDES).map(([key, data]) => (
                <button
                  key={key}
                  className={`lanthanide-btn ${lanthanide === key ? 'active' : ''}`}
                  style={{ '--accent': data.color } as React.CSSProperties}
                  onClick={() => handleLanthanide(key)}
                >
                  <span className="ln-symbol">{data.symbol}</span>
                  <span className="ln-z">Z={data.Z}</span>
                </button>
              ))}
            </div>
          </div>

          <SliderControl
            label="H_SO (spin-orbit coupling)"
            value={hso}
            min={50}
            max={6000}
            step={10}
            unit="cm⁻¹"
            onChange={(v) => setHsoManual(v)}
            color={lantData.color}
          />

          <SliderControl
            label="ΔE_ST (singlet-triplet gap)"
            value={deltaEST}
            min={100}
            max={10000}
            step={50}
            unit="cm⁻¹"
            onChange={setDeltaEST}
            color="#fbbf24"
          />

          <SliderControl
            label="r (donor-acceptor distance)"
            value={distance}
            min={1}
            max={15}
            step={0.1}
            unit="Å"
            onChange={setDistance}
            color="#67e8f9"
          />

          <div className="results-box">
            <div className="panel-label">Computed Values</div>
            <ResultRow label="H_SO(eff)" value={result.hsoEffective.toFixed(1)} unit="cm⁻¹" />
            <ResultRow label="Mixing coeff²" value={result.mixingCoeff2.toExponential(2)} />
            <ResultRow label="k_T" value={result.kT.toExponential(2)} unit="s⁻¹" />
            <ResultRow label="τ_T" value={formatTime(result.tauT)} />
            <ResultRow label="Φ_phos" value={(result.phosYield * 100).toFixed(1)} unit="%" />
          </div>
        </aside>

        {/* CENTER: Jablonski Diagram + Spectrum */}
        <div className="center-panels">
          <div className="panel jablonski-panel">
            <div className="panel-label">Jablonski Diagram</div>
            <JablonskiDiagram
              params={params}
              result={result}
              lantData={lantData}
            />
          </div>

          <div className="panel spectrum-panel">
            <div className="panel-label">Emission Spectrum</div>
            <SpectrumPlot spectrum={spectrum} lantData={lantData} />
          </div>
        </div>

        {/* RIGHT: Rate sweep plot */}
        <div className="panel sweep-panel">
          <div className="panel-label">Rate Dependence</div>
          <div className="sweep-selector">
            {(['hso', 'deltaEST', 'distance'] as SweepParam[]).map((p) => (
              <button
                key={p}
                className={`sweep-btn ${sweepParam === p ? 'active' : ''}`}
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
            color={lantData.color}
          />
          <div className="equation-box">
            <span className="eq">
              k<sub>T</sub> ∝ (⟨S₁|H<sub>SO</sub>|T₁⟩ / ΔE<sub>ST</sub>)² × k<sub>S</sub>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function SliderControl({
  label, value, min, max, step, unit, onChange, color,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="control-group">
      <label className="control-label">
        {label}
        <span className="control-value" style={{ color }}>{value} {unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
        style={{
          '--fill': color,
          '--pct': `${pct}%`,
        } as React.CSSProperties}
      />
    </div>
  );
}

function ResultRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="result-row">
      <span className="result-label">{label}</span>
      <span className="result-value">
        {value}{unit && <span className="result-unit"> {unit}</span>}
      </span>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds >= 1) return `${seconds.toFixed(2)} s`;
  if (seconds >= 1e-3) return `${(seconds * 1e3).toFixed(2)} ms`;
  if (seconds >= 1e-6) return `${(seconds * 1e6).toFixed(2)} μs`;
  if (seconds >= 1e-9) return `${(seconds * 1e9).toFixed(2)} ns`;
  return `${(seconds * 1e12).toFixed(2)} ps`;
}

// ── Jablonski Diagram (SVG) ─────────────────────────────────

function JablonskiDiagram({
  params, result, lantData,
}: {
  params: PhysicsParams; result: ReturnType<typeof computeTripletRate>; lantData: LanthanideData;
}) {
  const w = 560, h = 340;
  const mixing = Math.min(result.mixingCoeff2 * 1e4, 1);
  const tripletBrightness = Math.min(result.kT / 1e6, 1);

  const groundY = h - 40;
  const s1Y = 60;
  const t1Y = s1Y + (params.deltaEST / 10000) * (groundY - s1Y - 60) + 30;

  const singletsX = w * 0.35;
  const tripletsX = w * 0.7;
  const levelW = 100;

  const arrowOpacitySinglet = 0.9;
  const arrowOpacityTriplet = 0.1 + tripletBrightness * 0.8;
  const mixingLineOpacity = 0.15 + mixing * 0.7;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="jablonski-svg">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-strong">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="arrowS" viewBox="0 0 10 10" refX="5" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
        <marker id="arrowT" viewBox="0 0 10 10" refX="5" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={lantData.color} />
        </marker>
        <marker id="arrowISC" viewBox="0 0 10 10" refX="5" refY="5"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
        </marker>
      </defs>

      {/* Ground state */}
      <line x1={singletsX - levelW/2} y1={groundY} x2={singletsX + levelW/2} y2={groundY}
        stroke="#4b5563" strokeWidth="3" />
      <line x1={tripletsX - levelW/2} y1={groundY} x2={tripletsX + levelW/2} y2={groundY}
        stroke="#4b5563" strokeWidth="3" />
      <text x={w/2} y={groundY + 20} textAnchor="middle" className="level-label">S₀ (Ground)</text>

      {/* S1 level */}
      <line x1={singletsX - levelW/2} y1={s1Y} x2={singletsX + levelW/2} y2={s1Y}
        stroke="#60a5fa" strokeWidth="3" filter="url(#glow)" />
      <text x={singletsX} y={s1Y - 12} textAnchor="middle" className="level-label singlet">S₁</text>

      {/* T1 level */}
      <line x1={tripletsX - levelW/2} y1={t1Y} x2={tripletsX + levelW/2} y2={t1Y}
        stroke={lantData.color} strokeWidth="3"
        filter={mixing > 0.3 ? "url(#glow-strong)" : "url(#glow)"}
        opacity={0.4 + mixing * 0.6} />
      <text x={tripletsX} y={t1Y - 12} textAnchor="middle" className="level-label triplet"
        style={{ fill: lantData.color }}>T₁</text>

      {/* Absorption (S0 → S1) */}
      <line x1={singletsX - 15} y1={groundY - 8} x2={singletsX - 15} y2={s1Y + 8}
        stroke="#60a5fa" strokeWidth="2.5" markerEnd="url(#arrowS)"
        opacity={arrowOpacitySinglet} />
      <text x={singletsX - 30} y={(groundY + s1Y) / 2} textAnchor="end"
        className="arrow-label" fill="#60a5fa">Abs</text>

      {/* Fluorescence (S1 → S0) */}
      <line x1={singletsX + 15} y1={s1Y + 8} x2={singletsX + 15} y2={groundY - 8}
        stroke="#60a5fa" strokeWidth="2.5" markerEnd="url(#arrowS)"
        opacity={arrowOpacitySinglet} strokeDasharray="6 3" />
      <text x={singletsX + 30} y={(groundY + s1Y) / 2} textAnchor="start"
        className="arrow-label" fill="#60a5fa">Fluor</text>

      {/* ISC (S1 → T1) */}
      <path
        d={`M ${singletsX + levelW/2 + 5} ${s1Y}
            C ${(singletsX + tripletsX) / 2} ${s1Y - 20},
              ${(singletsX + tripletsX) / 2} ${t1Y + 20},
              ${tripletsX - levelW/2 - 5} ${t1Y}`}
        stroke="#fbbf24" strokeWidth={1.5 + mixing * 2}
        fill="none" strokeDasharray="5 4"
        markerEnd="url(#arrowISC)"
        opacity={mixingLineOpacity}
        filter="url(#glow)"
      />
      <text x={(singletsX + tripletsX) / 2} y={Math.min(s1Y, t1Y) - 5}
        textAnchor="middle" className="arrow-label" fill="#fbbf24">ISC</text>

      {/* Phosphorescence (T1 → S0) */}
      <line x1={tripletsX + 15} y1={t1Y + 8} x2={tripletsX + 15} y2={groundY - 8}
        stroke={lantData.color} strokeWidth={1.5 + tripletBrightness * 3}
        markerEnd="url(#arrowT)"
        opacity={arrowOpacityTriplet}
        filter={tripletBrightness > 0.3 ? "url(#glow-strong)" : "url(#glow)"}
        strokeDasharray="8 4" />
      <text x={tripletsX + 30} y={(groundY + t1Y) / 2} textAnchor="start"
        className="arrow-label" style={{ fill: lantData.color }}>
        Phos
      </text>

      {/* SOC mixing line */}
      <AnimatePresence>
        {mixing > 0.01 && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: mixingLineOpacity }}
            exit={{ opacity: 0 }}
          >
            <line x1={singletsX + levelW/2 + 10} y1={s1Y}
              x2={tripletsX - levelW/2 - 10} y2={t1Y}
              stroke="#f97316" strokeWidth={1 + mixing * 2}
              strokeDasharray="3 6" filter="url(#glow)" />
            <text x={(singletsX + tripletsX) / 2 + 10} y={(s1Y + t1Y) / 2 + 18}
              textAnchor="middle" className="arrow-label" fill="#f97316" fontSize="10">
              H_SO mixing
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* ΔE_ST bracket */}
      <line x1={tripletsX + levelW/2 + 25} y1={s1Y} x2={tripletsX + levelW/2 + 25} y2={t1Y}
        stroke="#6b7280" strokeWidth="1" />
      <line x1={tripletsX + levelW/2 + 20} y1={s1Y} x2={tripletsX + levelW/2 + 30} y2={s1Y}
        stroke="#6b7280" strokeWidth="1" />
      <line x1={tripletsX + levelW/2 + 20} y1={t1Y} x2={tripletsX + levelW/2 + 30} y2={t1Y}
        stroke="#6b7280" strokeWidth="1" />
      <text x={tripletsX + levelW/2 + 35} y={(s1Y + t1Y) / 2 + 4}
        className="arrow-label dim" fontSize="10">ΔE_ST</text>
    </svg>
  );
}

// ── Rate Sweep Plot ──────────────────────────────────────────

function RatePlot({
  data, xLabel, currentX, color,
}: {
  data: { x: number; y: number }[];
  xLabel: string;
  currentX: number;
  color: string;
}) {
  const w = 320, h = 280;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
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
  const cursorX = scaleX(cursorPoint.x);
  const cursorY = scaleY(cursorPoint.y);

  const yTicks: number[] = [];
  for (let e = Math.floor(logMin); e <= Math.ceil(logMax); e++) {
    yTicks.push(e);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="rate-svg">
      <defs>
        <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((e) => (
        <g key={e}>
          <line x1={pad.left} y1={scaleY(10 ** e)} x2={w - pad.right} y2={scaleY(10 ** e)}
            stroke="#1f2937" strokeWidth="1" />
          <text x={pad.left - 8} y={scaleY(10 ** e) + 4} textAnchor="end"
            className="tick-label">10<tspan dy="-4" fontSize="8">{e}</tspan></text>
        </g>
      ))}

      <path
        d={`${pathD} L ${scaleX(xMax)} ${pad.top + ph} L ${scaleX(xMin)} ${pad.top + ph} Z`}
        fill="url(#rateGrad)"
      />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />

      <line x1={cursorX} y1={pad.top} x2={cursorX} y2={pad.top + ph}
        stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
      <circle cx={cursorX} cy={cursorY} r="5" fill={color} filter="url(#glow)" />

      <text x={pad.left + pw / 2} y={h - 5} textAnchor="middle" className="axis-label">
        {xLabel}
      </text>
      <text x={5} y={pad.top - 5} className="axis-label">k_T (s⁻¹)</text>
    </svg>
  );
}

// ── Emission Spectrum ────────────────────────────────────────

function SpectrumPlot({
  spectrum, lantData,
}: {
  spectrum: { wavelength: number; singlet: number; triplet: number }[];
  lantData: LanthanideData;
}) {
  const w = 560, h = 200;
  const pad = { top: 15, right: 20, bottom: 55, left: 40 };
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
  for (let nm = 380; nm <= 780; nm += 20) {
    const pct = ((nm - xMin) / (xMax - xMin)) * 100;
    rainbowStops.push(
      <stop key={nm} offset={`${pct}%`} stopColor={wavelengthToColor(nm)} stopOpacity="0.6" />
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spectrum-svg">
      <defs>
        <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="0">
          {rainbowStops}
        </linearGradient>
      </defs>

      <rect x={pad.left} y={pad.top + ph + 2} width={pw} height={8}
        fill="url(#rainbow)" rx="2" />

      {/* Singlet fill */}
      <path d={`${singletPath} L ${scaleX(800)} ${scaleY(0)} L ${scaleX(350)} ${scaleY(0)} Z`}
        fill="#60a5fa" opacity="0.08" />
      <path d={singletPath} fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.8" />

      {/* Triplet fill + line */}
      <path d={`${tripletPath} L ${scaleX(800)} ${scaleY(0)} L ${scaleX(350)} ${scaleY(0)} Z`}
        fill={lantData.color} opacity="0.15" />
      <path d={tripletPath} fill="none" stroke={lantData.color} strokeWidth="2.5"
        filter="url(#glow)" />

      <text x={pad.left + 10} y={pad.top + 15} className="spectrum-label" fill="#60a5fa">
        Singlet (S₁→S₀)
      </text>
      <text x={pad.left + 10} y={pad.top + 30} className="spectrum-label" fill={lantData.color}>
        Triplet (T₁→S₀)
      </text>

      {[400, 450, 500, 550, 600, 650, 700, 750].map((nm) => (
        <text key={nm} x={scaleX(nm)} y={pad.top + ph + 24} textAnchor="middle" className="tick-label">
          {nm}
        </text>
      ))}
      <text x={pad.left + pw / 2} y={pad.top + ph + 42} textAnchor="middle" className="axis-label">
        Wavelength (nm)
      </text>
    </svg>
  );
}

export default App;

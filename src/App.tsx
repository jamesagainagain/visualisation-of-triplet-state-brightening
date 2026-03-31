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
  type ValidityLevel,
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
    () => emissionSpectrum(lantData.emissionPeak, result.exact.kT, params.kS, deltaEST),
    [lantData.emissionPeak, result.exact.kT, params.kS, deltaEST]
  );

  const handleLanthanide = useCallback((key: string) => {
    setLanthanide(key);
    setHsoManual(null);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>Triplet-State Brightening</h1>
          <div className="header-eq">
            k<sub>T</sub> = (⟨S₁|H<sub>SO</sub>|T₁⟩ / ΔE<sub>ST</sub>)² · k<sub>S</sub>
          </div>
        </div>
        <p className="header-desc">
          Interactive visualisation of spin-orbit mediated singlet-triplet mixing.
          Compares first-order perturbation theory with exact two-state diagonalization.
        </p>
      </header>

      {/* Validity banner */}
      <ValidityBanner result={result} />

      <div className="main-grid">
        {/* LEFT: Controls + Readout */}
        <div className="col-left">
          <section className="panel">
            <div className="panel-header">Input Parameters</div>
            <div className="panel-body">
              <div className="section-label">Heavy atom</div>
              <div className="ln-grid">
                {Object.entries(LANTHANIDES).map(([key, data]) => (
                  <button
                    key={key}
                    className={`ln-btn ${lanthanide === key ? 'active' : ''}`}
                    onClick={() => handleLanthanide(key)}
                  >
                    <span className="ln-sym">{data.symbol}</span>
                    <span className="ln-z">{data.Z}</span>
                  </button>
                ))}
              </div>

              <Slider label="H_SO" desc="spin-orbit coupling" value={hso}
                min={50} max={6000} step={10} unit="cm⁻¹"
                onChange={(v) => setHsoManual(v)} />
              <Slider label="ΔE_ST" desc="singlet-triplet gap" value={deltaEST}
                min={100} max={10000} step={50} unit="cm⁻¹"
                onChange={setDeltaEST} />
              <Slider label="r" desc="donor-acceptor distance" value={distance}
                min={1} max={15} step={0.1} unit="Å"
                onChange={setDistance} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              Computed Output
              <ValidityDot validity={result.validity} />
            </div>
            <div className="panel-body">
              <div className="readout-sub">Perturbation parameter</div>
              <table className="readout">
                <tbody>
                  <Row label="H_SO(eff)" val={result.hsoEffective.toFixed(1)} unit="cm⁻¹" />
                  <Row label="|V/ΔE|" val={result.perturbParam.toFixed(3)}
                    warn={result.validity !== 'valid'} />
                  <Row label="Error (PT vs exact)" val={`${(result.fractionalError * 100).toFixed(1)}%`}
                    warn={result.fractionalError > 0.1} />
                </tbody>
              </table>

              <div className="readout-sub" style={{ marginTop: 10 }}>
                Exact (2-state diag.)
              </div>
              <table className="readout">
                <tbody>
                  <Row label="sin²θ" val={result.exact.sin2theta.toExponential(3)} />
                  <Row label="k_T" val={result.exact.kT.toExponential(2)} unit="s⁻¹" accent />
                  <Row label="τ_T" val={fmtTime(result.exact.tauT)} accent />
                  <Row label="Φ_phos" val={`${(result.exact.phosYield * 100).toFixed(1)}`} unit="%" accent />
                </tbody>
              </table>

              <div className="readout-sub" style={{ marginTop: 10 }}>
                First-order PT
                {result.validity !== 'valid' && (
                  <span className="readout-flag">UNRELIABLE</span>
                )}
              </div>
              <table className="readout">
                <tbody>
                  <Row label="⟨mix⟩²" val={result.pt.mixingCoeff2.toExponential(3)}
                    dim={result.validity !== 'valid'} />
                  <Row label="k_T" val={result.pt.kT.toExponential(2)} unit="s⁻¹"
                    dim={result.validity !== 'valid'} />
                  <Row label="τ_T" val={fmtTime(result.pt.tauT)}
                    dim={result.validity !== 'valid'} />
                  <Row label="Φ_phos" val={`${(result.pt.phosYield * 100).toFixed(1)}`} unit="%"
                    dim={result.validity !== 'valid'} />
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* CENTER: Diagrams */}
        <div className="col-center">
          <section className="panel panel-diagram">
            <div className="panel-header">
              Energy Level Diagram
              <span className="panel-meta">Jablonski representation</span>
            </div>
            <div className="panel-body">
              <JablonskiDiagram params={params} result={result} lantData={lantData} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              Emission Spectrum
              <span className="panel-meta">Gaussian lineshape</span>
            </div>
            <div className="panel-body">
              <SpectrumPlot spectrum={spectrum} lantData={lantData} />
            </div>
          </section>
        </div>

        {/* RIGHT: Sweep */}
        <div className="col-right">
          <section className="panel">
            <div className="panel-header">Parameter Sweep</div>
            <div className="panel-body">
              <div className="sweep-tabs">
                {(['hso', 'deltaEST', 'distance'] as SweepParam[]).map((p) => (
                  <button key={p}
                    className={`sweep-tab ${sweepParam === p ? 'active' : ''}`}
                    onClick={() => setSweepParam(p)}>
                    {SWEEP_LABELS[p]}
                  </button>
                ))}
              </div>
              <RatePlot data={sweepData} xLabel={SWEEP_LABELS[sweepParam]}
                currentX={params[sweepParam]} />
              <div className="sweep-legend">
                <span className="sweep-leg-item">
                  <span className="leg-line exact" /> Exact
                </span>
                <span className="sweep-leg-item">
                  <span className="leg-line pt" /> Perturbation
                </span>
              </div>
              <div className="sweep-note">
                Log₁₀ scale · other parameters held constant
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Validity Banner ──────────────────────────────── */

function ValidityBanner({ result }: { result: ReturnType<typeof computeTripletRate> }) {
  if (result.validity === 'valid') return null;

  const isCaution = result.validity === 'caution';
  const ratio = result.perturbParam.toFixed(2);
  const error = (result.fractionalError * 100).toFixed(0);

  return (
    <div className={`validity-banner ${result.validity}`}>
      <span className="validity-icon">{isCaution ? '⚠' : '✕'}</span>
      <div className="validity-text">
        <strong>
          {isCaution
            ? 'Perturbation theory approximation degrading'
            : 'Perturbation theory invalid'}
        </strong>
        <span className="validity-detail">
          |⟨S₁|H_SO|T₁⟩| / ΔE_ST = {ratio}
          {isCaution ? ' ≥ 0.3' : ' ≥ 1.0'}.
          {' '}First-order result deviates from exact solution by {error}%.
          {!isCaution && ' Mixing saturates — diagonalize the coupled 2-state Hamiltonian instead.'}
          {' '}The exact (two-state) values shown below remain correct.
        </span>
      </div>
    </div>
  );
}

function ValidityDot({ validity }: { validity: ValidityLevel }) {
  return <span className={`v-dot ${validity}`} />;
}

/* ── Generic sub-components ───────────────────────── */

function Slider({ label, desc, value, min, max, step, unit, onChange }: {
  label: string; desc: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-group">
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-desc">{desc}</span>
        <span className="slider-val">{value}<span className="slider-unit">{unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider" style={{ '--pct': `${pct}%` } as React.CSSProperties} />
      <div className="slider-minmax"><span>{min}</span><span>{max}</span></div>
    </div>
  );
}

function Row({ label, val, unit, accent, warn, dim }: {
  label: string; val: string; unit?: string; accent?: boolean; warn?: boolean; dim?: boolean;
}) {
  const cls = [accent && 'accent', warn && 'warn', dim && 'dim'].filter(Boolean).join(' ');
  return (
    <tr className={`row ${cls}`}>
      <td className="row-label">{label}</td>
      <td className="row-val">{val}{unit && <span className="row-unit">{unit}</span>}</td>
    </tr>
  );
}

function fmtTime(s: number): string {
  if (s >= 1) return `${s.toFixed(2)} s`;
  if (s >= 1e-3) return `${(s * 1e3).toFixed(2)} ms`;
  if (s >= 1e-6) return `${(s * 1e6).toFixed(2)} μs`;
  if (s >= 1e-9) return `${(s * 1e9).toFixed(2)} ns`;
  return `${(s * 1e12).toFixed(2)} ps`;
}

/* ── Jablonski Diagram ────────────────────────────── */

function JablonskiDiagram({ params, result, lantData }: {
  params: PhysicsParams; result: ReturnType<typeof computeTripletRate>; lantData: LanthanideData;
}) {
  const w = 520, h = 320;
  const mixing = Math.min(result.exact.sin2theta * 10, 1);
  const brightness = Math.min(result.exact.kT / 1e6, 1);

  const gY = h - 35;
  const s1Y = 55;
  const t1Y = s1Y + (params.deltaEST / 10000) * (gY - s1Y - 50) + 25;

  const sX = w * 0.32, tX = w * 0.68, lw = 80;

  const sColor = '#4A72B0';
  const tColor = lantData.color;
  const iscColor = '#C47A2A';
  const dim = '#B0A898';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="svg-diagram">
      <defs>
        <marker id="as" viewBox="0 0 8 8" refX="4" refY="4"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={sColor} />
        </marker>
        <marker id="at" viewBox="0 0 8 8" refX="4" refY="4"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={tColor} />
        </marker>
        <marker id="ai" viewBox="0 0 8 8" refX="4" refY="4"
          markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={iscColor} />
        </marker>
      </defs>

      {/* Column headings */}
      <text x={sX} y={18} textAnchor="middle" className="svg-colhead">SINGLET</text>
      <text x={tX} y={18} textAnchor="middle" className="svg-colhead">TRIPLET</text>

      {/* S0 ground */}
      <line x1={sX-lw/2} y1={gY} x2={sX+lw/2} y2={gY} stroke={dim} strokeWidth="2" />
      <line x1={tX-lw/2} y1={gY} x2={tX+lw/2} y2={gY} stroke={dim} strokeWidth="2" />
      <text x={(sX+tX)/2} y={gY+16} textAnchor="middle" className="svg-level">S₀</text>

      {/* S1 */}
      <line x1={sX-lw/2} y1={s1Y} x2={sX+lw/2} y2={s1Y} stroke={sColor} strokeWidth="2" />
      <text x={sX-lw/2-8} y={s1Y+4} textAnchor="end" className="svg-level" fill={sColor}>S₁</text>

      {/* T1 */}
      <line x1={tX-lw/2} y1={t1Y} x2={tX+lw/2} y2={t1Y}
        stroke={tColor} strokeWidth="2" opacity={0.35 + mixing * 0.65} />
      <text x={tX+lw/2+8} y={t1Y+4} textAnchor="start" className="svg-level"
        fill={tColor} opacity={0.5 + mixing * 0.5}>T₁</text>

      {/* Absorption */}
      <line x1={sX-12} y1={gY-6} x2={sX-12} y2={s1Y+6}
        stroke={sColor} strokeWidth="1.5" markerEnd="url(#as)" />
      <text x={sX-24} y={(gY+s1Y)/2+3} textAnchor="end"
        className="svg-trans" fill={sColor}>abs</text>

      {/* Fluorescence */}
      <line x1={sX+12} y1={s1Y+6} x2={sX+12} y2={gY-6}
        stroke={sColor} strokeWidth="1.5" markerEnd="url(#as)"
        strokeDasharray="4 3" opacity="0.6" />
      <text x={sX+24} y={(gY+s1Y)/2+3} textAnchor="start"
        className="svg-trans" fill={sColor} opacity="0.6">fluor</text>

      {/* ISC */}
      <path
        d={`M ${sX+lw/2+4} ${s1Y} C ${(sX+tX)/2} ${s1Y-15}, ${(sX+tX)/2} ${t1Y+15}, ${tX-lw/2-4} ${t1Y}`}
        stroke={iscColor} strokeWidth={1 + mixing * 1.5}
        fill="none" strokeDasharray="3 4" markerEnd="url(#ai)"
        opacity={0.2 + mixing * 0.7} />
      <text x={(sX+tX)/2} y={Math.min(s1Y,t1Y)-6} textAnchor="middle"
        className="svg-trans" fill={iscColor} opacity={0.3 + mixing * 0.6}>ISC</text>

      {/* Phosphorescence */}
      <line x1={tX+12} y1={t1Y+6} x2={tX+12} y2={gY-6}
        stroke={tColor} strokeWidth={1 + brightness * 2} markerEnd="url(#at)"
        opacity={0.15 + brightness * 0.75} strokeDasharray="5 3" />
      <text x={tX+24} y={(gY+t1Y)/2+3} textAnchor="start"
        className="svg-trans" fill={tColor} opacity={0.2 + brightness * 0.7}>phos</text>

      {/* SOC mixing */}
      {mixing > 0.005 && (
        <g opacity={0.15 + mixing * 0.6}>
          <line x1={sX+lw/2+6} y1={s1Y} x2={tX-lw/2-6} y2={t1Y}
            stroke={iscColor} strokeWidth={0.8 + mixing * 1.2} strokeDasharray="2 5" />
          <text x={(sX+tX)/2+8} y={(s1Y+t1Y)/2+14} textAnchor="middle"
            className="svg-mixing" fill={iscColor}>H_SO</text>
        </g>
      )}

      {/* ΔE_ST dimension */}
      <line x1={tX+lw/2+22} y1={s1Y} x2={tX+lw/2+22} y2={t1Y}
        stroke={dim} strokeWidth="0.75" />
      <line x1={tX+lw/2+18} y1={s1Y} x2={tX+lw/2+26} y2={s1Y}
        stroke={dim} strokeWidth="0.75" />
      <line x1={tX+lw/2+18} y1={t1Y} x2={tX+lw/2+26} y2={t1Y}
        stroke={dim} strokeWidth="0.75" />
      <text x={tX+lw/2+30} y={(s1Y+t1Y)/2+3} className="svg-dim" fill={dim}>ΔE_ST</text>
    </svg>
  );
}

/* ── Rate Sweep Plot ──────────────────────────────── */

function RatePlot({ data, xLabel, currentX }: {
  data: { x: number; ptY: number; exactY: number; validity: ValidityLevel }[];
  xLabel: string; currentX: number;
}) {
  const w = 320, h = 300;
  const pad = { top: 24, right: 16, bottom: 36, left: 52 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const xMin = data[0]?.x ?? 0;
  const xMax = data[data.length - 1]?.x ?? 1;
  const allY = data.flatMap(d => [d.ptY, d.exactY]).filter(v => v > 0);
  const yMin = Math.min(...allY) || 1;
  const yMax = Math.max(...allY) || 1e8;

  const logMin = Math.log10(Math.max(yMin, 1));
  const logMax = Math.log10(yMax);

  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * pw;
  const sy = (y: number) => {
    const log = Math.log10(Math.max(y, 1));
    return pad.top + ph - ((log - logMin) / (logMax - logMin || 1)) * ph;
  };

  const exactPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.x).toFixed(1)} ${sy(d.exactY).toFixed(1)}`)
    .join(' ');
  const ptPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.x).toFixed(1)} ${sy(d.ptY).toFixed(1)}`)
    .join(' ');

  // Find first caution/invalid point for shading
  const cautionStart = data.findIndex(d => d.validity === 'caution');
  const invalidStart = data.findIndex(d => d.validity === 'invalid');

  const cur = data.reduce((b, d) => Math.abs(d.x - currentX) < Math.abs(b.x - currentX) ? d : b, data[0]);
  const cx = sx(cur.x), cyExact = sy(cur.exactY);

  const yTicks: number[] = [];
  for (let e = Math.floor(logMin); e <= Math.ceil(logMax); e++) yTicks.push(e);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="svg-plot">
      <rect x={pad.left} y={pad.top} width={pw} height={ph}
        fill="none" stroke="var(--border)" strokeWidth="1" />

      {/* Caution/invalid regions */}
      {cautionStart >= 0 && (
        <rect
          x={sx(data[cautionStart].x)} y={pad.top}
          width={invalidStart >= 0
            ? sx(data[invalidStart].x) - sx(data[cautionStart].x)
            : pad.left + pw - sx(data[cautionStart].x)}
          height={ph}
          fill="var(--warn)" opacity="0.06" />
      )}
      {invalidStart >= 0 && (
        <rect
          x={sx(data[invalidStart].x)} y={pad.top}
          width={pad.left + pw - sx(data[invalidStart].x)}
          height={ph}
          fill="var(--error)" opacity="0.06" />
      )}

      {yTicks.map(e => (
        <g key={e}>
          <line x1={pad.left} y1={sy(10**e)} x2={pad.left+pw} y2={sy(10**e)}
            stroke="var(--grid)" strokeWidth="1" />
          <text x={pad.left-6} y={sy(10**e)+3} textAnchor="end" className="svg-tick">
            10<tspan dy="-4" fontSize="7">{e}</tspan>
          </text>
        </g>
      ))}

      {/* PT trace (dashed, dimmer) */}
      <path d={ptPath} fill="none" stroke="var(--text-tertiary)" strokeWidth="1"
        strokeDasharray="4 3" opacity="0.7" />

      {/* Exact trace */}
      <path d={exactPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />

      {/* Cursor */}
      <line x1={cx} y1={pad.top} x2={cx} y2={pad.top+ph}
        stroke="var(--text-secondary)" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.5" />
      <circle cx={cx} cy={cyExact} r="3" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx={cx} cy={cyExact} r="1" fill="var(--accent)" />

      <text x={pad.left+pw/2} y={h-4} textAnchor="middle" className="svg-axis">{xLabel}</text>
      <text x={8} y={pad.top-8} className="svg-axis">k_T (s⁻¹)</text>
    </svg>
  );
}

/* ── Emission Spectrum ────────────────────────────── */

function SpectrumPlot({ spectrum, lantData }: {
  spectrum: { wavelength: number; singlet: number; triplet: number }[];
  lantData: LanthanideData;
}) {
  const w = 520, h = 190;
  const pad = { top: 16, right: 16, bottom: 48, left: 36 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const xMin = 350, xMax = 800;
  const sx = (wl: number) => pad.left + ((wl - xMin) / (xMax - xMin)) * pw;
  const sy = (v: number) => pad.top + ph - v * ph;

  const sPath = spectrum
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.wavelength).toFixed(1)} ${sy(d.singlet).toFixed(1)}`)
    .join(' ');
  const tPath = spectrum
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.wavelength).toFixed(1)} ${sy(d.triplet).toFixed(1)}`)
    .join(' ');

  const stops = [];
  for (let nm = 380; nm <= 780; nm += 15) {
    const pct = ((nm - xMin) / (xMax - xMin)) * 100;
    stops.push(<stop key={nm} offset={`${pct}%`} stopColor={wavelengthToColor(nm)} stopOpacity="0.45" />);
  }

  const sColor = '#4A72B0';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="svg-plot">
      <defs>
        <linearGradient id="vis" x1="0" y1="0" x2="1" y2="0">{stops}</linearGradient>
      </defs>

      <rect x={pad.left} y={pad.top} width={pw} height={ph}
        fill="none" stroke="var(--border)" strokeWidth="1" />

      <path d={sPath} fill="none" stroke={sColor} strokeWidth="1.5" opacity="0.75" />
      <path d={`${tPath} L ${sx(800)} ${sy(0)} L ${sx(350)} ${sy(0)} Z`}
        fill={lantData.color} opacity="0.08" />
      <path d={tPath} fill="none" stroke={lantData.color} strokeWidth="1.5" />

      {/* Legend */}
      <line x1={pad.left+8} y1={pad.top+10} x2={pad.left+22} y2={pad.top+10}
        stroke={sColor} strokeWidth="1.5" />
      <text x={pad.left+26} y={pad.top+13} className="svg-legend" fill={sColor}>S₁→S₀</text>
      <line x1={pad.left+72} y1={pad.top+10} x2={pad.left+86} y2={pad.top+10}
        stroke={lantData.color} strokeWidth="1.5" />
      <text x={pad.left+90} y={pad.top+13} className="svg-legend" fill={lantData.color}>T₁→S₀</text>

      <rect x={pad.left} y={pad.top+ph+3} width={pw} height={5} fill="url(#vis)" />
      {[400,450,500,550,600,650,700,750].map(nm => (
        <g key={nm}>
          <line x1={sx(nm)} y1={pad.top+ph} x2={sx(nm)} y2={pad.top+ph+10}
            stroke="var(--border)" strokeWidth="0.75" />
          <text x={sx(nm)} y={pad.top+ph+22} textAnchor="middle" className="svg-tick">{nm}</text>
        </g>
      ))}
      <text x={pad.left+pw/2} y={h-4} textAnchor="middle" className="svg-axis">λ (nm)</text>
    </svg>
  );
}

export default App;

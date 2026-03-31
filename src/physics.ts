// Triplet-state brightening via spin-orbit coupling
//
// First-order perturbation theory:
//   k_T ∝ (⟨S₁|H_SO|T₁⟩ / ΔE_ST)² × k_S
//
// Exact two-state diagonalization:
//   sin²θ = ½(1 − ΔE/√(ΔE² + 4V²))
//   k_T = sin²θ × k_S
//
// H_SO coupling decays with distance: H_SO(r) = H_SO_0 × e^(-β×r)

export interface LanthanideData {
  name: string;
  symbol: string;
  Z: number;
  hso0: number;
  emissionPeak: number;
  color: string;
}

export const LANTHANIDES: Record<string, LanthanideData> = {
  Gd: { name: 'Gadolinium', symbol: 'Gd', Z: 64, hso0: 950, emissionPeak: 312, color: '#7B6BA8' },
  Tb: { name: 'Terbium', symbol: 'Tb', Z: 65, hso0: 1050, emissionPeak: 545, color: '#4A8A5C' },
  Dy: { name: 'Dysprosium', symbol: 'Dy', Z: 66, hso0: 1170, emissionPeak: 573, color: '#B08A2E' },
  Eu: { name: 'Europium', symbol: 'Eu', Z: 63, hso0: 870, emissionPeak: 614, color: '#B04E4E' },
  Er: { name: 'Erbium', symbol: 'Er', Z: 68, hso0: 1400, emissionPeak: 550, color: '#3D8E72' },
  Yb: { name: 'Ytterbium', symbol: 'Yb', Z: 70, hso0: 1700, emissionPeak: 980, color: '#7A5EA8' },
  Ir: { name: 'Iridium', symbol: 'Ir', Z: 77, hso0: 3800, emissionPeak: 520, color: '#4A72B0' },
  Pt: { name: 'Platinum', symbol: 'Pt', Z: 78, hso0: 4200, emissionPeak: 490, color: '#4A8DA8' },
};

export const BETA_DEFAULT = 1.0;
export const K_S_DEFAULT = 1e8;

// Perturbation parameter threshold: above this, first-order is unreliable
export const PERTURBATION_WARN_THRESHOLD = 0.3;
export const PERTURBATION_INVALID_THRESHOLD = 1.0;

export type ValidityLevel = 'valid' | 'caution' | 'invalid';

export interface PhysicsParams {
  hso: number;
  deltaEST: number;
  distance: number;
  beta: number;
  kS: number;
}

export interface PhysicsResult {
  hsoEffective: number;

  // Perturbation parameter: |V| / ΔE_ST
  perturbParam: number;
  validity: ValidityLevel;

  // First-order perturbation theory results
  pt: {
    mixingCoeff2: number;
    kT: number;
    tauT: number;
    phosYield: number;
  };

  // Exact two-state diagonalization results
  exact: {
    sin2theta: number;
    kT: number;
    tauT: number;
    phosYield: number;
  };

  // Fractional error: |PT - exact| / exact
  fractionalError: number;

  enhancement: number;
}

export function computeTripletRate(params: PhysicsParams): PhysicsResult {
  const { hso, deltaEST, distance, beta, kS } = params;

  const hsoEffective = hso * Math.exp(-beta * distance);
  const gap = Math.max(deltaEST, 1);
  const kNR = 1e5;

  // Perturbation parameter: |V/ΔE|
  const perturbParam = hsoEffective / gap;

  let validity: ValidityLevel = 'valid';
  if (perturbParam >= PERTURBATION_INVALID_THRESHOLD) validity = 'invalid';
  else if (perturbParam >= PERTURBATION_WARN_THRESHOLD) validity = 'caution';

  // First-order perturbation theory: sin²θ ≈ (V/ΔE)²
  const ptMixing = perturbParam ** 2;
  const ptKT = ptMixing * kS;
  const ptTauT = 1 / (ptKT + kNR);
  const ptPhosYield = ptKT / (ptKT + kNR);

  // Exact two-state diagonalization
  // H = [[E_S, V], [V, E_T]]
  // sin²θ = ½(1 − ΔE / √(ΔE² + 4V²))
  const V = hsoEffective;
  const discriminant = Math.sqrt(gap ** 2 + 4 * V ** 2);
  const sin2theta = 0.5 * (1 - gap / discriminant);
  const exactKT = sin2theta * kS;
  const exactTauT = 1 / (exactKT + kNR);
  const exactPhosYield = exactKT / (exactKT + kNR);

  const fractionalError = exactKT > 0
    ? Math.abs(ptKT - exactKT) / exactKT
    : 0;

  return {
    hsoEffective,
    perturbParam,
    validity,
    pt: { mixingCoeff2: ptMixing, kT: ptKT, tauT: ptTauT, phosYield: ptPhosYield },
    exact: { sin2theta, kT: exactKT, tauT: exactTauT, phosYield: exactPhosYield },
    fractionalError,
    enhancement: exactKT / kS,
  };
}

export function sweepParameter(
  baseParams: PhysicsParams,
  paramKey: keyof PhysicsParams,
  min: number,
  max: number,
  steps: number = 200
): { x: number; ptY: number; exactY: number; validity: ValidityLevel }[] {
  const points: { x: number; ptY: number; exactY: number; validity: ValidityLevel }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = min + (max - min) * (i / steps);
    const params = { ...baseParams, [paramKey]: x };
    const result = computeTripletRate(params);
    points.push({ x, ptY: result.pt.kT, exactY: result.exact.kT, validity: result.validity });
  }
  return points;
}

export function emissionSpectrum(
  centerNm: number,
  kT: number,
  kS: number,
  deltaEST: number
): { wavelength: number; singlet: number; triplet: number }[] {
  const points: { wavelength: number; singlet: number; triplet: number }[] = [];
  const tripletShift = (centerNm ** 2 / 1e7) * deltaEST;
  const tripletCenter = centerNm + tripletShift;

  const fwhmS = 30;
  const fwhmT = 40;

  for (let wl = 350; wl <= 800; wl += 1) {
    const singlet = Math.exp(-0.5 * ((wl - centerNm) / (fwhmS / 2.355)) ** 2);
    const tripletRaw = Math.exp(-0.5 * ((wl - tripletCenter) / (fwhmT / 2.355)) ** 2);
    const triplet = tripletRaw * Math.min(kT / kS, 1);
    points.push({ wavelength: wl, singlet, triplet });
  }
  return points;
}

export function wavelengthToColor(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380); b = 1;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / (490 - 440); b = 1;
  } else if (nm >= 490 && nm < 510) {
    g = 1; b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510); g = 1;
  } else if (nm >= 580 && nm < 645) {
    r = 1; g = -(nm - 645) / (645 - 580);
  } else if (nm >= 645 && nm <= 780) {
    r = 1;
  }
  let factor = 1;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
  else if (nm > 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);
  else if (nm < 380 || nm > 780) factor = 0;

  return `rgb(${Math.round(r * factor * 255)}, ${Math.round(g * factor * 255)}, ${Math.round(b * factor * 255)})`;
}

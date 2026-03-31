// Triplet-state brightening via spin-orbit coupling
// k_T ∝ (⟨S₁|H_SO|T₁⟩ / ΔE_ST)² × k_S
// H_SO coupling decays with distance: H_SO(r) = H_SO_0 × e^(-β×r)

export interface LanthanideData {
  name: string;
  symbol: string;
  Z: number;
  // Intrinsic SOC strength in cm⁻¹ (scales ~Z⁴ for heavy atoms)
  hso0: number;
  // Characteristic emission color (nm)
  emissionPeak: number;
  color: string;
}

export const LANTHANIDES: Record<string, LanthanideData> = {
  Gd: { name: 'Gadolinium', symbol: 'Gd', Z: 64, hso0: 950, emissionPeak: 312, color: '#b8a9ff' },
  Tb: { name: 'Terbium', symbol: 'Tb', Z: 65, hso0: 1050, emissionPeak: 545, color: '#4ade80' },
  Dy: { name: 'Dysprosium', symbol: 'Dy', Z: 66, hso0: 1170, emissionPeak: 573, color: '#fbbf24' },
  Eu: { name: 'Europium', symbol: 'Eu', Z: 63, hso0: 870, emissionPeak: 614, color: '#f87171' },
  Er: { name: 'Erbium', symbol: 'Er', Z: 68, hso0: 1400, emissionPeak: 550, color: '#34d399' },
  Yb: { name: 'Ytterbium', symbol: 'Yb', Z: 70, hso0: 1700, emissionPeak: 980, color: '#c084fc' },
  Ir: { name: 'Iridium', symbol: 'Ir', Z: 77, hso0: 3800, emissionPeak: 520, color: '#22d3ee' },
  Pt: { name: 'Platinum', symbol: 'Pt', Z: 78, hso0: 4200, emissionPeak: 490, color: '#67e8f9' },
};

// Dexter exchange decay constant (Å⁻¹)
export const BETA_DEFAULT = 1.0;

// Singlet radiative rate (s⁻¹) — typical fluorescence
export const K_S_DEFAULT = 1e8;

export interface PhysicsParams {
  hso: number;       // SOC matrix element (cm⁻¹)
  deltaEST: number;  // Singlet-triplet gap (cm⁻¹)
  distance: number;  // Donor-acceptor distance (Å)
  beta: number;      // Dexter decay constant (Å⁻¹)
  kS: number;        // Singlet radiative rate (s⁻¹)
}

export interface PhysicsResult {
  // Effective SOC after distance decay
  hsoEffective: number;
  // Mixing coefficient squared
  mixingCoeff2: number;
  // Triplet radiative rate (s⁻¹)
  kT: number;
  // Enhancement factor (kT/kS)
  enhancement: number;
  // Triplet lifetime (s)
  tauT: number;
  // Phosphorescence quantum yield estimate (simplified)
  phosYield: number;
}

export function computeTripletRate(params: PhysicsParams): PhysicsResult {
  const { hso, deltaEST, distance, beta, kS } = params;

  // Distance-dependent SOC: H_SO(r) = H_SO_0 × exp(-β×r)
  const hsoEffective = hso * Math.exp(-beta * distance);

  // Mixing coefficient: (H_SO / ΔE_ST)²
  // Clamp to prevent singularities
  const gap = Math.max(deltaEST, 1);
  const mixingCoeff2 = (hsoEffective / gap) ** 2;

  // Triplet radiative rate
  const kT = mixingCoeff2 * kS;

  // Non-radiative rate estimate (simplified) — ~1e5 s⁻¹ typical
  const kNR = 1e5;

  const enhancement = kT / kS;
  const tauT = 1 / (kT + kNR);
  const phosYield = kT / (kT + kNR);

  return { hsoEffective, mixingCoeff2, kT, enhancement, tauT, phosYield };
}

// Generate rate vs parameter sweep
export function sweepParameter(
  baseParams: PhysicsParams,
  paramKey: keyof PhysicsParams,
  min: number,
  max: number,
  steps: number = 200
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = min + (max - min) * (i / steps);
    const params = { ...baseParams, [paramKey]: x };
    const result = computeTripletRate(params);
    points.push({ x, y: result.kT });
  }
  return points;
}

// Emission spectrum (Gaussian lineshape)
export function emissionSpectrum(
  centerNm: number,
  kT: number,
  kS: number,
  deltaEST: number
): { wavelength: number; singlet: number; triplet: number }[] {
  const points: { wavelength: number; singlet: number; triplet: number }[] = [];
  // Triplet emission is red-shifted by ΔE_ST
  // Convert cm⁻¹ to nm shift: Δλ ≈ λ²/(1e7) × ΔE
  const tripletShift = (centerNm ** 2 / 1e7) * deltaEST;
  const tripletCenter = centerNm + tripletShift;

  const fwhmS = 30; // nm
  const fwhmT = 40; // nm — broader vibronic

  for (let wl = 350; wl <= 800; wl += 1) {
    const singlet = Math.exp(-0.5 * ((wl - centerNm) / (fwhmS / 2.355)) ** 2);
    const tripletRaw = Math.exp(-0.5 * ((wl - tripletCenter) / (fwhmT / 2.355)) ** 2);
    // Scale triplet by rate ratio
    const triplet = tripletRaw * Math.min(kT / kS, 1);
    points.push({ wavelength: wl, singlet, triplet });
  }
  return points;
}

// Convert wavelength to visible color (approximate)
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
  // Intensity falloff at edges
  let factor = 1;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
  else if (nm > 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);
  else if (nm < 380 || nm > 780) factor = 0;

  return `rgb(${Math.round(r * factor * 255)}, ${Math.round(g * factor * 255)}, ${Math.round(b * factor * 255)})`;
}

# Triplet-State Brightening

Interactive visualisation of how nominally dark triplet transitions can be brightened through spin-orbit mixing with nearby heavy atoms. Compares first-order perturbation theory against exact two-state diagonalisation in real time.

## Background

When molecules absorb light, excited electrons can occupy either **singlet** (spin-paired) or **triplet** (spin-aligned) states. Quantum selection rules forbid triplet states from emitting light directly — making ~75% of excited states "dark" and wasted.

**Spin-orbit coupling** from heavy atoms (iridium, platinum, lanthanides) mixes singlet character into the triplet state, enabling radiative decay — this is **triplet brightening**. The effect is governed by:

```
k_T = (⟨S₁|H_SO|T₁⟩ / ΔE_ST)² × k_S       (perturbation theory)
sin²θ = ½(1 − ΔE / √(ΔE² + 4V²))           (exact diagonalisation)
```

The coupling decays exponentially with donor–acceptor distance: `H_SO(r) = H_SO₀ × e^(−β×r)`.

## Features

- **Heavy atom selector** — choose from Gd, Tb, Dy, Eu, Er, Yb, Ir, Pt with real spin-orbit coupling constants
- **Interactive sliders** — adjust H_SO coupling strength, singlet-triplet gap (ΔE_ST), and donor–acceptor distance in real time
- **Jablonski energy level diagram** — animated SVG showing absorption, fluorescence, intersystem crossing (ISC), and phosphorescence pathways
- **Emission spectrum** — Gaussian lineshape plot comparing singlet and triplet emission bands
- **Parameter sweep** — log-scale plot sweeping any parameter while holding others fixed, with shaded regions indicating where perturbation theory breaks down
- **Validity tracking** — automatic warnings when the perturbation parameter |V/ΔE| exceeds safe thresholds, with fractional error between the two methods displayed

## Setup

**Prerequisites:** Node.js 18+ and npm (or bun).

```bash
# Clone and enter the project
cd triplet-brightening

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Other commands

```bash
npm run build      # Type-check and build for production
npm run preview    # Preview the production build locally
npm run lint       # Run ESLint
```

## Tech Stack

- React 19 + TypeScript 5.9
- Vite 8
- Framer Motion
- Custom SVG rendering (no charting library)

## Project Structure

```
src/
├── physics.ts    # Core physics engine — perturbation theory, exact
│                   diagonalisation, parameter sweeps, emission spectra
├── App.tsx       # UI — controls, Jablonski diagram, spectrum plot,
│                   rate sweep plot, validity banners
├── App.css       # Styling
└── main.tsx      # Entry point
```

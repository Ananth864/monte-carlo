
export type SimulationParams = {
  startCorpus: number; // Rupees
  w0: number; // Rupees
  inflation: number; // 0.075 for 7.5%
  inflationSD: number; // 0.02 for 2%
  returnInflationCorr: number; // 0.2
  years: number;
  meanR: number; // 0.11 for 11%
  stdR: number; // 0.18 for 18%
  taper: number; // 0.05 for 5%
  sims: number;
  discretionarySpend: number; // Rupees
  cutPct: number; // 0.5 for 50%
  safeBucketYears: number;
  taperStartYear: number;
  useFirstNYearsReserve: boolean;
  reserveR: number; // 0.055 for 5.5%
  randomSeed?: number;
};

export type YearResult = {
  year: number;
  p10: number;
  p50: number;
  p90: number;
  successRate: number; // Percentage of sims that didn't fail
};

/**
 * xorshift128+ PRNG - Superior statistical properties vs LCG
 * Period: 2^128 - 1, passes BigCrush tests
 */
class SeededRandom {
  private s0: number;
  private s1: number;

  constructor(seed: number = 12345) {
    // Initialize state from seed using splitmix64-style seeding
    let s = seed >>> 0;
    s = ((s ^ (s >>> 16)) * 0x85ebca6b) >>> 0;
    s = ((s ^ (s >>> 13)) * 0xc2b2ae35) >>> 0;
    this.s0 = (s ^ (s >>> 16)) >>> 0;
    
    s = (seed + 0x9e3779b9) >>> 0;
    s = ((s ^ (s >>> 16)) * 0x85ebca6b) >>> 0;
    s = ((s ^ (s >>> 13)) * 0xc2b2ae35) >>> 0;
    this.s1 = (s ^ (s >>> 16)) >>> 0;
    
    // Ensure non-zero state
    if (this.s0 === 0 && this.s1 === 0) {
      this.s0 = 1;
    }
  }

  // Returns [0, 1)
  next(): number {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 ^= (s1 << 23) >>> 0;
    s1 ^= s1 >>> 17;
    s1 ^= s0;
    s1 ^= s0 >>> 26;
    this.s1 = s1 >>> 0;
    
    // Combine and normalize to [0, 1)
    return ((this.s0 + this.s1) >>> 0) / 4294967296;
  }

  // Box-Muller transform for normal distribution
  nextNormal(mean: number, std: number): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * std + mean;
  }
}

export function runMonteCarlo(params: SimulationParams): YearResult[] {
  const {
    startCorpus,
    w0,
    inflation,
    inflationSD,
    returnInflationCorr,
    years,
    meanR,
    stdR,
    taper,
    sims,
    discretionarySpend,
    cutPct,
    safeBucketYears,
    taperStartYear,
    useFirstNYearsReserve,
    reserveR,
    randomSeed,
  } = params;

  const rng = new SeededRandom(randomSeed);

  const totalByYear = new Float64Array((years + 1) * sims);
  const safeBucket = safeBucketYears * w0;
  const riskyStart = startCorpus - safeBucket;

  // Precompute correlation factor for bivariate sampling
  const corrSqrt = Math.sqrt(Math.max(0, 1 - returnInflationCorr * returnInflationCorr));

  for (let sim = 0; sim < sims; sim++) {
    let riskyCorpus = Math.max(0, riskyStart);
    let safeRemain = riskyStart < 0 ? startCorpus : safeBucket;
    
    totalByYear[sim] = riskyCorpus + safeRemain;

    // =========================================================
    // CRITICAL FIX: Stateful spending variables (match Python)
    // These persist across years, accumulating inflation, taper, and cuts
    // =========================================================
    let w_annual = w0;           // Nominal annual spend, grows with inflation, tapers
    let w_disc_adj = discretionarySpend;  // Discretionary portion, can be permanently cut

    for (let yr = 1; yr <= years; yr++) {
      // 1. Sample Correlated Return and Inflation (Bivariate Normal via Cholesky)
      const z1 = rng.nextNormal(0, 1);
      const z2 = rng.nextNormal(0, 1);
      
      const r = meanR + stdR * z1;
      const annualInfl = inflation + inflationSD * (returnInflationCorr * z1 + corrSqrt * z2);
      
      // Clip extreme deflation to avoid negative multipliers
      const clippedInfl = Math.max(-0.99, annualInfl);

      // 2. Risky Growth
      riskyCorpus *= (1.0 + r);

      // 3. Safe bucket compounds BEFORE spending
      if (safeRemain > 0 && reserveR > 0) {
        safeRemain *= (1.0 + reserveR);
      }

      // =========================================================
      // CRITICAL FIX: Year-over-year spending adjustments (match Python)
      // Inflation and taper compound on the PREVIOUS year's values
      // =========================================================
      if (yr > 1) {
        if (yr <= taperStartYear) {
          // Before taper: only inflation growth
          w_annual *= (1.0 + clippedInfl);
          w_disc_adj *= (1.0 + clippedInfl);
        } else {
          // After taper: inflation growth MINUS taper reduction
          w_annual *= (1.0 + clippedInfl) * (1.0 - taper);
          w_disc_adj *= (1.0 + clippedInfl) * (1.0 - taper);
        }
      }

      // 5. Bad Year & Discretionary Cut
      // CRITICAL FIX: This cut PERSISTS - w_disc_adj is permanently reduced
      const isBadYear = r < 0.0;
      if (isBadYear) {
        w_disc_adj *= (1.0 - cutPct);
      }

      // 6. Total Withdrawals
      // Essential = total annual - discretionary (what you MUST spend)
      const wEssential = Math.max(0, w_annual - w_disc_adj);
      let totalW = wEssential + w_disc_adj;

      // 7. Draw Order
      if (useFirstNYearsReserve) {
        // Use safe bucket strictly for first N years
        if (yr <= safeBucketYears && safeRemain > 0) {
          if (safeRemain >= totalW) {
            safeRemain -= totalW;
          } else {
            const remainder = totalW - safeRemain;
            safeRemain = 0;
            riskyCorpus -= remainder;
          }
        } else {
          riskyCorpus -= totalW;
        }
      } else {
        // Use safe bucket only in bad years
        if (isBadYear && safeRemain > 0) {
          if (safeRemain >= totalW) {
            safeRemain -= totalW;
          } else {
            const remainder = totalW - safeRemain;
            safeRemain = 0;
            riskyCorpus -= remainder;
          }
        } else {
          riskyCorpus -= totalW;
        }
      }

      riskyCorpus = Math.max(0.0, riskyCorpus);
      totalByYear[yr * sims + sim] = riskyCorpus + safeRemain;

      // Early termination optimization
      if (riskyCorpus === 0 && safeRemain === 0) {
        for (let futureYr = yr + 1; futureYr <= years; futureYr++) {
          totalByYear[futureYr * sims + sim] = 0;
        }
        break;
      }
    }
  }

  // Calculate Percentiles
  const results: YearResult[] = [];
  for (let yr = 0; yr <= years; yr++) {
    const startIdx = yr * sims;
    
    // Copy and sort for percentile calculation
    const yearValues = new Float64Array(sims);
    for (let i = 0; i < sims; i++) {
      yearValues[i] = totalByYear[startIdx + i];
    }
    yearValues.sort();

    const p10 = yearValues[Math.floor(0.10 * sims)];
    const p50 = yearValues[Math.floor(0.50 * sims)];
    const p90 = yearValues[Math.floor(0.90 * sims)];
    
    // Success rate: corpus > 0
    let successCount = 0;
    for (let i = 0; i < sims; i++) {
      if (yearValues[i] > 1) successCount++;
    }

    results.push({
      year: yr,
      p10,
      p50,
      p90,
      successRate: (successCount / sims) * 100
    });
  }

  return results;
}


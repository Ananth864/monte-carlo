import React, { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus, Calculator, RefreshCw } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

type RuleOutcome = "Inflation+Increase" | "InflationOnly" | "DecreaseRequired";

type GKParams = {
  startPortfolio: number;
  currentPortfolio: number;
  priorWithdrawal: number;
  inflation: number;
  increaseThreshold: number;
  decreaseThreshold: number;
  increaseAmount: number;
  decreaseAmount: number;
};

type GKResult = {
  allowedWithdrawal: number;
  rule: RuleOutcome;
  portfolioChange: number;
  note: string;
  inflationAdjAllowed: boolean;
};

type ProjectionRow = {
  year: number;
  startPortfolio: number;
  nominalReturn: number;
  inflation: number;
  priorWithdrawal: number;
  inflationProposal: number;
  rule: RuleOutcome;
  finalWithdrawal: number;
  endPortfolio: number;
  note: string;
};

// ════════════════════════════════════════════════════════════════════════════
// G-K RULE LOGIC
// ════════════════════════════════════════════════════════════════════════════

function calculateGKRule(params: GKParams): GKResult {
  const {
    startPortfolio,
    currentPortfolio,
    priorWithdrawal,
    inflation,
    increaseThreshold,
    decreaseThreshold,
    increaseAmount,
    decreaseAmount,
  } = params;

  const portfolioChange = (currentPortfolio - startPortfolio) / startPortfolio;
  const inflationAdjusted = priorWithdrawal * (1 + inflation);

  let rule: RuleOutcome;
  let allowedWithdrawal: number;
  let note: string;
  let inflationAdjAllowed: boolean;

  if (portfolioChange > increaseThreshold) {
    // Portfolio grew above threshold → inflation + increase
    rule = "Inflation+Increase";
    allowedWithdrawal = inflationAdjusted * (1 + increaseAmount);
    note = `Portfolio up ${(portfolioChange * 100).toFixed(1)}%; applied inflation + ${(increaseAmount * 100).toFixed(0)}% bonus`;
    inflationAdjAllowed = true;
  } else if (portfolioChange < -decreaseThreshold) {
    // Portfolio dropped below threshold → cut, no inflation
    rule = "DecreaseRequired";
    allowedWithdrawal = priorWithdrawal * (1 - decreaseAmount);
    note = `Portfolio down ${(Math.abs(portfolioChange) * 100).toFixed(1)}%; applied ${(decreaseAmount * 100).toFixed(0)}% cut, no inflation`;
    inflationAdjAllowed = false;
  } else {
    // Within threshold → inflation only
    rule = "InflationOnly";
    allowedWithdrawal = inflationAdjusted;
    note = `Portfolio within ±${(Math.max(increaseThreshold, decreaseThreshold) * 100).toFixed(0)}% threshold; applied inflation only`;
    inflationAdjAllowed = true;
  }

  return {
    allowedWithdrawal,
    rule,
    portfolioChange,
    note,
    inflationAdjAllowed,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PROJECTION TABLE GENERATOR
// ════════════════════════════════════════════════════════════════════════════

function generateProjections(
  params: GKParams,
  years: number,
  meanReturn: number,
  returnStdDev: number,
  inflationStdDev: number
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  let portfolio = params.startPortfolio;
  let priorWithdrawal = params.priorWithdrawal;

  // Box-Muller transform for normal distribution
  const normalRandom = (mean: number, std: number): number => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  };

  for (let year = 1; year <= years; year++) {
    const startOfYear = portfolio;
    
    // Simulate return (clamped to -50% to +50%)
    const nominalReturn = Math.max(-0.5, Math.min(0.5, normalRandom(meanReturn, returnStdDev)));
    
    // Simulate inflation (clamped to 2% to 20%)
    const yearInflation = Math.max(0.02, Math.min(0.20, normalRandom(params.inflation, inflationStdDev)));
    
    // End of year portfolio before withdrawal
    const portfolioAfterReturn = startOfYear * (1 + nominalReturn);
    
    // Calculate G-K rule
    const gkResult = calculateGKRule({
      ...params,
      startPortfolio: startOfYear,
      currentPortfolio: portfolioAfterReturn,
      priorWithdrawal,
      inflation: yearInflation,
    });

    const inflationProposal = priorWithdrawal * (1 + yearInflation);
    const finalWithdrawal = gkResult.allowedWithdrawal;
    const endPortfolio = portfolioAfterReturn - finalWithdrawal;

    rows.push({
      year,
      startPortfolio: startOfYear,
      nominalReturn,
      inflation: yearInflation,
      priorWithdrawal,
      inflationProposal,
      rule: gkResult.rule,
      finalWithdrawal,
      endPortfolio: Math.max(0, endPortfolio),
      note: gkResult.note,
    });

    // Update for next year
    portfolio = Math.max(0, endPortfolio);
    priorWithdrawal = finalWithdrawal;

    // Stop if portfolio depleted
    if (portfolio <= 0) break;
  }

  return rows;
}

// ════════════════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ════════════════════════════════════════════════════════════════════════════

const formatCurrency = (value: number): string => {
  if (value >= 1e7) {
    return `₹${(value / 1e7).toFixed(2)} Cr`;
  } else if (value >= 1e5) {
    return `₹${(value / 1e5).toFixed(2)} L`;
  }
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

// ════════════════════════════════════════════════════════════════════════════
// RULE BADGE COMPONENT
// ════════════════════════════════════════════════════════════════════════════

const RuleBadge: React.FC<{ rule: RuleOutcome }> = ({ rule }) => {
  const config = {
    "Inflation+Increase": {
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: TrendingUp,
    },
    InflationOnly: {
      bg: "bg-amber-100 dark:bg-amber-900/40",
      text: "text-amber-700 dark:text-amber-300",
      icon: Minus,
    },
    DecreaseRequired: {
      bg: "bg-rose-100 dark:bg-rose-900/40",
      text: "text-rose-700 dark:text-rose-300",
      icon: TrendingDown,
    },
  };

  const { bg, text, icon: Icon } = config[rule];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {rule}
    </span>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export function GKWithdrawalCalculator() {
  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [params, setParams] = useState<GKParams>({
    startPortfolio: 10_00_00_000, // 10 Cr
    currentPortfolio: 10_50_00_000, // 10.5 Cr
    priorWithdrawal: 40_00_000, // 40 Lakh
    inflation: 0.07,
    increaseThreshold: 0.05,
    decreaseThreshold: 0.05,
    increaseAmount: 0.05,
    decreaseAmount: 0.10,
  });

  const [projectionYears, setProjectionYears] = useState(20);
  const [meanReturn, setMeanReturn] = useState(0.11);
  const [returnStdDev, setReturnStdDev] = useState(0.15);
  const [inflationStdDev, setInflationStdDev] = useState(0.03);
  const [projectionKey, setProjectionKey] = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────
  const result = useMemo(() => calculateGKRule(params), [params]);

  const projections = useMemo(
    () => generateProjections(params, projectionYears, meanReturn, returnStdDev, inflationStdDev),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, projectionYears, meanReturn, returnStdDev, inflationStdDev, projectionKey]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleChange = <K extends keyof GKParams>(field: K, value: GKParams[K]) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  const regenerateProjections = () => setProjectionKey((k) => k + 1);

  // Display converters
  const startCr = params.startPortfolio / 1e7;
  const currentCr = params.currentPortfolio / 1e7;
  const withdrawalLakh = params.priorWithdrawal / 1e5;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Guyton-Klinger Withdrawal Calculator
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Determine your safe withdrawal amount based on portfolio performance and the G-K guardrails.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─────────────────────────────────────────────────────────────────
              LEFT: INPUT CONTROLS
          ───────────────────────────────────────────────────────────────── */}
          <Card className="p-6 space-y-6 lg:col-span-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold">Inputs</h2>
            </div>

            {/* Portfolio Values */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Portfolio
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Start of Year (₹ Cr)</Label>
                  <span className="text-xs font-mono text-slate-500">
                    {formatCurrency(params.startPortfolio)}
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  value={startCr}
                  onChange={(e) =>
                    handleChange("startPortfolio", parseFloat(e.target.value || "0") * 1e7)
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Current Portfolio (₹ Cr)</Label>
                  <span className="text-xs font-mono text-slate-500">
                    {formatCurrency(params.currentPortfolio)}
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  value={currentCr}
                  onChange={(e) =>
                    handleChange("currentPortfolio", parseFloat(e.target.value || "0") * 1e7)
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Prior Year Withdrawal (₹ Lakh)</Label>
                  <span className="text-xs font-mono text-slate-500">
                    {formatCurrency(params.priorWithdrawal)}
                  </span>
                </div>
                <Input
                  type="number"
                  step="1"
                  value={withdrawalLakh}
                  onChange={(e) =>
                    handleChange("priorWithdrawal", parseFloat(e.target.value || "0") * 1e5)
                  }
                  className="font-mono"
                />
              </div>
            </section>

            {/* Market Params */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Market
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Inflation (%)</Label>
                  <span className="text-xs font-mono">{formatPercent(params.inflation)}</span>
                </div>
                <Slider
                  min={0}
                  max={20}
                  step={0.5}
                  value={[params.inflation * 100]}
                  onValueChange={(vals) => handleChange("inflation", vals[0] / 100)}
                />
              </div>
            </section>

            {/* G-K Thresholds */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                G-K Thresholds
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        <strong>Increase Threshold:</strong> Portfolio must grow by this % to trigger
                        a spending increase.
                      </p>
                      <p className="mt-1">
                        <strong>Decrease Threshold:</strong> Portfolio must drop by this % to trigger
                        a spending cut.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Increase Threshold (%)</Label>
                  <span className="text-xs font-mono">
                    {formatPercent(params.increaseThreshold)}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={25}
                  step={1}
                  value={[params.increaseThreshold * 100]}
                  onValueChange={(vals) => handleChange("increaseThreshold", vals[0] / 100)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Decrease Threshold (%)</Label>
                  <span className="text-xs font-mono">
                    {formatPercent(params.decreaseThreshold)}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={25}
                  step={1}
                  value={[params.decreaseThreshold * 100]}
                  onValueChange={(vals) => handleChange("decreaseThreshold", vals[0] / 100)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Increase Amount (%)</Label>
                  <span className="text-xs font-mono">{formatPercent(params.increaseAmount)}</span>
                </div>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={[params.increaseAmount * 100]}
                  onValueChange={(vals) => handleChange("increaseAmount", vals[0] / 100)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Decrease Amount (%)</Label>
                  <span className="text-xs font-mono">{formatPercent(params.decreaseAmount)}</span>
                </div>
                <Slider
                  min={1}
                  max={30}
                  step={1}
                  value={[params.decreaseAmount * 100]}
                  onValueChange={(vals) => handleChange("decreaseAmount", vals[0] / 100)}
                />
              </div>
            </section>
          </Card>

          {/* ─────────────────────────────────────────────────────────────────
              RIGHT: RESULTS + PROJECTION
          ───────────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Result Card */}
            <Card className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold mb-4">This Year's Withdrawal</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Allowed Withdrawal */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Allowed Withdrawal</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(result.allowedWithdrawal)}
                  </p>
                </div>

                {/* Rule Applied */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Rule Applied</p>
                  <RuleBadge rule={result.rule} />
                </div>

                {/* Portfolio Change */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Portfolio Change</p>
                  <p
                    className={`text-xl font-semibold ${
                      result.portfolioChange >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {result.portfolioChange >= 0 ? "+" : ""}
                    {formatPercent(result.portfolioChange)}
                  </p>
                </div>
              </div>

              {/* Note */}
              <div className="mt-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-300">{result.note}</p>
              </div>
            </Card>

            {/* Projection Table */}
            <Card className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Multi-Year Projection</h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Years</Label>
                    <Input
                      type="number"
                      min={5}
                      max={50}
                      value={projectionYears}
                      onChange={(e) => setProjectionYears(parseInt(e.target.value) || 20)}
                      className="w-16 h-8 text-sm font-mono"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateProjections}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </div>
              </div>

              {/* Projection Params (collapsible) */}
              <details className="mb-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                  Simulation Parameters
                </summary>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">Mean Return (%)</Label>
                    <Slider
                      min={0}
                      max={20}
                      step={0.5}
                      value={[meanReturn * 100]}
                      onValueChange={(vals) => setMeanReturn(vals[0] / 100)}
                    />
                    <span className="text-xs font-mono">{formatPercent(meanReturn)}</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Return Volatility (%)</Label>
                    <Slider
                      min={5}
                      max={30}
                      step={1}
                      value={[returnStdDev * 100]}
                      onValueChange={(vals) => setReturnStdDev(vals[0] / 100)}
                    />
                    <span className="text-xs font-mono">{formatPercent(returnStdDev)}</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inflation Volatility (%)</Label>
                    <Slider
                      min={0}
                      max={10}
                      step={0.5}
                      value={[inflationStdDev * 100]}
                      onValueChange={(vals) => setInflationStdDev(vals[0] / 100)}
                    />
                    <span className="text-xs font-mono">{formatPercent(inflationStdDev)}</span>
                  </div>
                </div>
              </details>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        Yr
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                        Start
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                        Return
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                        Infl
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300">
                        Rule
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                        Withdrawal
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                        End
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {projections.map((row) => (
                      <tr
                        key={row.year}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                          {row.year}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatCurrency(row.startPortfolio)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono ${
                            row.nominalReturn >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {row.nominalReturn >= 0 ? "+" : ""}
                          {formatPercent(row.nominalReturn)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatPercent(row.inflation)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <RuleBadge rule={row.rule} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.finalWithdrawal)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatCurrency(row.endPortfolio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {projections.length > 0 && projections[projections.length - 1].endPortfolio <= 0 && (
                <div className="mt-4 p-3 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm">
                  ⚠️ Portfolio depleted at year {projections.length}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

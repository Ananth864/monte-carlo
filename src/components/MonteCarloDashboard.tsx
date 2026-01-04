
import React, { useState, useEffect, useRef } from "react";
import { InputControls } from "./InputControls";
import { MonteCarloChart } from "./MonteCarloChart";
import { runMonteCarlo, type SimulationParams, type YearResult } from "@/lib/monteCarlo";


// Initial defaults matching Python script
const DEFAULT_PARAMS: SimulationParams = {
  startCorpus: 15_000_000 * 10, // 15 Cr = 150000000
  w0: 6_000_000,               // 60 Lakh = 6000000
  discretionarySpend: 2_000_000, // 20 Lakh = 2000000
  inflation: 0.075,
  inflationSD: 0.02,
  returnInflationCorr: 0.2,
  years: 40,
  meanR: 0.11,
  stdR: 0.18,
  taper: 0.05,
  sims: 100000, // Always 100k as requested
  cutPct: 0.5,
  safeBucketYears: 5,
  taperStartYear: 20,
  useFirstNYearsReserve: true,
  reserveR: 0.055,
  randomSeed: 12345,
};

export const MonteCarloDashboard: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [data, setData] = useState<YearResult[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleParamChange = (newParams: SimulationParams) => {
    setParams(newParams);
  };

  useEffect(() => {
    // Debounce simulation - wait 300ms after last param change before running
    // This allows sliders to feel smooth while avoiding excessive computation
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    setIsSimulating(true);
    
    debounceRef.current = setTimeout(() => {
      const results = runMonteCarlo(params);
      setData(results);
      setIsSimulating(false);
    }, 300);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [params]);

  return (
    <div 
      className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 touch-scroll mobile-scroll-clean"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 pb-20 sm:pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
        
        {/* Left Sidebar: Inputs */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <InputControls 
            params={params} 
            onChange={handleParamChange} 
          />
        </aside>

        {/* Main Content: Chart & Stats */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className={`transition-opacity duration-200 ${isSimulating ? 'opacity-60' : 'opacity-100'}`}>
            <MonteCarloChart data={data} startCorpus={params.startCorpus} />
          </div>
          
          {/* Key Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <StatCard 
                label={`Median End Corpus (Yr ${params.years})`}
                value={`₹${(data[data.length-1]?.p50 / 1e7 || 0).toFixed(1)} Cr`} 
             />
             <StatCard 
                label={`Worst Case (10th %ile) (Yr ${params.years})`}
                value={`₹${(data[data.length-1]?.p10 / 1e7 || 0).toFixed(1)} Cr`} 
                highlight={data[data.length-1]?.p10 < 0}
             />
             <StatCard 
                label="Success Probability" 
                value={`${(data[data.length-1]?.successRate || 0).toFixed(1)}%`}
                subtext="Simulations with >0 corpus"
             />
          </div>
        </div>

      </main>
    </div>
  );
};

const StatCard = ({ label, value, subtext, highlight = false }: { label: string, value: string, subtext?: string, highlight?: boolean }) => (
    <div className={`p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-xl border ${highlight ? 'border-red-500/50 bg-red-50/10' : 'border-slate-200 dark:border-slate-800'} shadow-sm`}>
        <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">{label}</p>
        <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${highlight ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1 sm:mt-2">{subtext}</p>}
    </div>
);

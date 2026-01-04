
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { SimulationParams } from "@/lib/monteCarlo";

// Helper for formatted money input (display only) could be complex
// For now, we will just use simple number inputs with labels indicating units
// Or allow entering Crores/Lakhs directly

type InputControlsProps = {
  params: SimulationParams;
  onChange: (newParams: SimulationParams) => void;
};

export const InputControls: React.FC<InputControlsProps> = ({
  params,
  onChange,
}) => {
  const handleChange = (field: keyof SimulationParams, value: number | boolean) => {
    onChange({ ...params, [field]: value });
  };

  // -------------------------------------------
  // Converters for Display (Crores / Lakhs)
  // -------------------------------------------
  const corpusCr = params.startCorpus / 1e7;
  const w0Lakh = params.w0 / 1e5;
  const discLakh = params.discretionarySpend / 1e5;

  return (
    <div className="space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Parameters
        </h2>
      </div>

      {/* SECTION 1: CORPUS & SPENDING */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          Corpus & Spending
        </h3>
        
        {/* Start Corpus */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Starting Corpus (₹ Cr)</Label>
            <span className="text-xs font-mono text-slate-500">₹{params.startCorpus.toLocaleString()}</span>
          </div>
          <Input
            type="number"
            step="0.1"
            value={corpusCr}
            onChange={(e) => handleChange("startCorpus", parseFloat(e.target.value) * 1e7)}
            className="font-mono"
          />
        </div>

        {/* Annual Spend */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Annual Spend (₹ Lakh)</Label>
             <span className="text-xs font-mono text-slate-500">₹{params.w0.toLocaleString()}</span>
          </div>
          <Input
            type="number"
            step="1"
            value={w0Lakh}
            onChange={(e) => handleChange("w0", parseFloat(e.target.value) * 1e5)}
             className="font-mono"
          />
        </div>

          {/* Discretionary Spend */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="flex items-center gap-2">
                Discretionary (₹ Lakh)
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger><Info className="h-4 w-4 text-slate-400" /></TooltipTrigger>
                        <TooltipContent>Portion of spend that can be cut in bad years.</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </Label>
             <span className="text-xs font-mono text-slate-500">₹{params.discretionarySpend.toLocaleString()}</span>
          </div>
          <Input
            type="number"
            step="1"
            value={discLakh}
            onChange={(e) => handleChange("discretionarySpend", parseFloat(e.target.value) * 1e5)}
             className="font-mono"
          />
        </div>
      </section>

      {/* SECTION 2: MARKET ASSUMPTIONS */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          Market Assumptions
        </h3>

        {/* Mean Return */}
         <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Mean Return (%)</Label>
            <span className="text-xs font-mono">{(params.meanR * 100).toFixed(1)}%</span>
          </div>
          <Slider
            min={0}
            max={20}
            step={0.1}
            value={[params.meanR * 100]}
            onValueChange={(vals) => handleChange("meanR", vals[0] / 100)}
          />
        </div>

        {/* Std Dev */}
         <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Volatility (StdDev %)</Label>
            <span className="text-xs font-mono">{(params.stdR * 100).toFixed(1)}%</span>
          </div>
          <Slider
            min={0}
            max={30}
            step={0.1}
            value={[params.stdR * 100]}
            onValueChange={(vals) => handleChange("stdR", vals[0] / 100)}
          />
        </div>

        {/* Inflation */}
         <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Inflation (%)</Label>
            <span className="text-xs font-mono">{(params.inflation * 100).toFixed(1)}%</span>
          </div>
          <Slider
            min={0}
            max={15}
            step={0.1}
            value={[params.inflation * 100]}
            onValueChange={(vals) => handleChange("inflation", vals[0] / 100)}
          />
        </div>

        {/* Inflation SD */}
         <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="flex items-center gap-2">
                Inflation Volatility (%)
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger><Info className="h-4 w-4 text-slate-400" /></TooltipTrigger>
                        <TooltipContent>Standard deviation of annual inflation.</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </Label>
            <span className="text-xs font-mono">{(params.inflationSD * 100).toFixed(1)}%</span>
          </div>
          <Slider
            min={0}
            max={10}
            step={0.1}
            value={[params.inflationSD * 100]}
            onValueChange={(vals) => handleChange("inflationSD", vals[0] / 100)}
          />
        </div>

        {/* Inflation Correlation */}
         <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="flex items-center gap-2">
                Return/Infl Correlation
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger><Info className="h-4 w-4 text-slate-400" /></TooltipTrigger>
                        <TooltipContent>Correlation between market returns and inflation rates.</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </Label>
            <span className="text-xs font-mono">{params.returnInflationCorr.toFixed(2)}</span>
          </div>
          <Slider
            min={-1}
            max={1}
            step={0.05}
            value={[params.returnInflationCorr]}
            onValueChange={(vals) => handleChange("returnInflationCorr", vals[0])}
          />
        </div>
      </section>

      {/* SECTION 3: STRATEGY */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          Strategy
        </h3>

        <div className="flex items-center justify-between">
             <Label className="flex items-center gap-2">
                Use Safe Bucket First?
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger><Info className="h-4 w-4 text-slate-400" /></TooltipTrigger>
                        <TooltipContent>Consume from safe bucket (debt) for the first N years strictly.</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
             </Label>
             <Switch 
                checked={params.useFirstNYearsReserve}
                onCheckedChange={(c) => handleChange("useFirstNYearsReserve", c)}
             />
        </div>

         <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Safe Bucket Years</Label>
            <span className="text-xs font-mono">{params.safeBucketYears} yr</span>
          </div>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[params.safeBucketYears]}
            onValueChange={(vals) => handleChange("safeBucketYears", vals[0])}
          />
        </div>
        
         <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Safe Bucket Yield (%)</Label>
            <span className="text-xs font-mono">{(params.reserveR * 100).toFixed(1)}%</span>
          </div>
          <Slider
             min={0}
            max={10}
            step={0.1}
            value={[params.reserveR * 100]}
            onValueChange={(vals) => handleChange("reserveR", vals[0] / 100)}
          />
        </div>
      </section>
      
       {/* SECTION 4: TAPER & FLEX */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          Flexibility
        </h3>

         <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Discretionary Cut (%)</Label>
            <span className="text-xs font-mono">{(params.cutPct * 100).toFixed(0)}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[params.cutPct * 100]}
            onValueChange={(vals) => handleChange("cutPct", vals[0] / 100)}
          />
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Taper Rate (%)</Label>
            <span className="text-xs font-mono">{(params.taper * 100).toFixed(1)}%</span>
          </div>
          <Slider
            min={0}
            max={20}
            step={0.5}
            value={[params.taper * 100]}
            onValueChange={(vals) => handleChange("taper", vals[0] / 100)}
          />
        </div>

        {/* Taper Start Year - NEW */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="flex items-center gap-2">
              Taper Starts After Year
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="h-4 w-4 text-slate-400" /></TooltipTrigger>
                  <TooltipContent>Spending reduction begins after this year of retirement.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-xs font-mono">{params.taperStartYear} yr</span>
          </div>
          <Slider
            min={1}
            max={params.years - 1}
            step={1}
            value={[params.taperStartYear]}
            onValueChange={(vals) => handleChange("taperStartYear", vals[0])}
          />
        </div>
      </section>

      {/* SECTION 5: TIME HORIZON */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          Time Horizon
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="flex items-center gap-2">
              Retirement Years
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="h-4 w-4 text-slate-400" /></TooltipTrigger>
                  <TooltipContent>Total years to simulate (retirement horizon).</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-xs font-mono">{params.years} yr</span>
          </div>
          <Slider
            min={10}
            max={60}
            step={5}
            value={[params.years]}
            onValueChange={(vals) => handleChange("years", vals[0])}
          />
        </div>
      </section>
    </div>
  );
};

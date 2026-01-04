
import React from "react";
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
  Line,
  ComposedChart
} from "recharts";
import type { YearResult } from "@/lib/monteCarlo";

type MonteCarloChartProps = {
  data: YearResult[];
  startCorpus: number;
};

// Formatter for axis: Rupees to Crores
const toCr = (val: number) => {
  return `${(val / 1e7).toFixed(0)}Cr`;
};
const toCrDetail = (val: number) => {
    return `₹${(val / 1e7).toFixed(2)} Cr`;
}

export const MonteCarloChart: React.FC<MonteCarloChartProps> = ({
  data,
  startCorpus,
}) => {
  // Recharts Area needs consistent structure.
  // We want to fill between p10 and p90.
  // We can treat p10 as the "base" and (p90 - p10) as the stack?
  // Or simpler: use an Area for p10-p90 range using `dataKey` range?
  // Recharts `Area` with `type="monotone"` and two data keys `[min, max]` is supported in recent versions for `dataKey`?
  // Actually standard way for "Band" is:
  // 1. Area for p90, white/transparent below? No.
  // 2. We can use `Area` with `dataKey` as an array `[p10, p90]`.

  // Let's verify Recharts Area range support. Yes `dataKey` can be `[min, max]`.
  
  return (
    <div className="w-full h-[350px] sm:h-[420px] md:h-[500px] p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="mb-2 sm:mb-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold">Retirement Corpus Projection</h3>
        <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
          Showing 10th-90th percentile range and median trajectory.
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="92%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="year" 
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            tickFormatter={toCr} 
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9 }}
            width={50}
          />
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
          
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              
              // Find the data point from payload
              const dataPoint = payload[0]?.payload;
              if (!dataPoint) return null;
              
              return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                  <p className="font-semibold text-slate-900 dark:text-white mb-2">Year {label}</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Median:</span> {toCrDetail(dataPoint.p50)}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      <span className="font-medium">10th %ile:</span> {toCrDetail(dataPoint.p10)}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      <span className="font-medium">90th %ile:</span> {toCrDetail(dataPoint.p90)}
                    </p>
                  </div>
                </div>
              );
            }}
          />

          {/* range p10 to p90 */}
          {/* Note: dataKey can be a function or string. For range, commonly we use two Areas stacked (tricky) OR simple Area with `[min, max]` if supported.
              Recharts Area dataKey support for range is essentially `dataKey="value"` where value is `[min, max]`. 
              We need to transform data properly or just mapping.
              Actually simpler visual trick:
              Area 1: p90, fill="color"
              Area 2: p10, fill="backgroundColor" (mask) -> Only works for solid bg.
              Better: Use `Area` with dataKey `[p10, p90]` directly? Recharts might support `dataKey` taking an array?
              Documentation says dataKey is string | number | function.
              Let's try constructing a custom payload or just use two lines + fill.
              
              Standard approach in Recharts for Range Area:
              Use `Area` with `dataKey="range"` where `range` is `[p10, p90]`.
           */}
           
          <Area
            type="monotone"
            dataKey={(d) => [d.p10, d.p90]}
            stroke="none"
            fill="url(#colorRange)"
            name="10th-90th Percentile"
          />

          <Line
            type="monotone"
            dataKey="p50"
            stroke="#0f172a" // Slate-900
            strokeWidth={3}
            dot={false}
            name="Median"
            className="dark:stroke-white"
          />
          
          {/* Starting Dot */}
           <ReferenceDot
            x={0}
            y={startCorpus}
            r={6}
            fill="#ef4444"
            stroke="white"
            strokeWidth={2}
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type TooltipItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export const SCORE_BUCKETS = ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"] as const;

/**
 * Maps a percentage (0–100) to its 20-point distribution bucket index.
 * Bucket edges are inclusive on the lower bound (21–40, 41–60, …).
 */
export function scoreToBucketIndex(percentage: number): number {
  if (percentage <= 0) return 0;
  if (percentage >= 100) return 4;
  return Math.min(4, Math.max(0, Math.ceil(percentage / 20) - 1));
}

export interface ScoreDistributionChartProps {
  /** Count of students per bucket, ordered [0–20, 21–40, …, 81–100]. */
  distribution?: number[];
  className?: string;
}

/**
 * Class score-distribution histogram rendered with Chart.js.
 * Visualizes how the class performed across five 20-point buckets.
 */
export function ScoreDistributionChart({ distribution = [0, 0, 0, 0, 0], className = "" }: ScoreDistributionChartProps) {
  const data = {
    labels: [...SCORE_BUCKETS],
    datasets: [
      {
        label: "Students",
        data: distribution,
        backgroundColor: "rgba(79, 70, 229, 0.85)",
        hoverBackgroundColor: "rgba(67, 56, 202, 1)",
        borderColor: "rgba(67, 56, 202, 1)",
        borderWidth: 1,
        borderRadius: 6,
        maxBarThickness: 56,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<"bar">) => `${context.parsed.y} student${context.parsed.y === 1 ? "" : "s"}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 11 } },
        border: { color: "#e2e8f0" },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          precision: 0,
          stepSize: 1,
        },
        grid: { color: "#f1f5f9" },
        border: { display: false },
        title: {
          display: true,
          text: "Students",
          color: "#94a3b8",
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className={`w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Score Distribution</h3>
          <p className="mt-0.5 text-xs text-slate-500">Number of students per 20-point score band.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 rounded-sm bg-indigo-600/80" />
          Students
        </div>
      </div>
      <div className="h-64 w-full">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}

export default ScoreDistributionChart;

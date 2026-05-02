"use client";

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export interface PlotPoint {
  actual: number;
  predicted: number;
  residual: number;
}

interface Props {
  data: PlotPoint[];
  type: 'scatter' | 'residual' | 'error-dist' | 'qq';
}

const CHART_COLORS = {
  dot: '#4C6EF5',
  grid: '#2A2F38',
  axis: '#6B7280',
  refLine: '#6B7280',
  tooltipBg: '#1A1D23',
  tooltipBorder: '#2A2F38',
  text: '#E6E6E6',
  bar: '#4C6EF5',
};

/**
 * RegressionVisualization
 * 
 * Supports 4 chart types:
 *   scatter    — Actual vs Predicted with y=x reference line
 *   residual   — Residuals vs Predicted with y=0 reference
 *   error-dist — Histogram of residual distribution (binned)
 *   qq         — Sorted residuals for approximate Q-Q analysis
 */
export const RegressionVisualization = ({ data, type }: Props) => {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No plot data available.</p>;
  }

  const tooltipStyle = {
    contentStyle: { backgroundColor: CHART_COLORS.tooltipBg, borderColor: CHART_COLORS.tooltipBorder, color: CHART_COLORS.text, fontSize: '11px', fontFamily: 'monospace' },
  };

  // ---- SCATTER: Actual vs Predicted ----
  if (type === 'scatter') {
    const allVals = data.flatMap(d => [d.actual, d.predicted]);
    const min = Math.floor(Math.min(...allVals));
    const max = Math.ceil(Math.max(...allVals));
    const refLineData = [{ actual: min, predicted: min }, { actual: max, predicted: max }];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis type="number" dataKey="actual" domain={[min, max]} stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Actual', position: 'insideBottom', offset: -2, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <YAxis type="number" dataKey="predicted" domain={[min, max]} stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Predicted', angle: -90, position: 'insideLeft', offset: 20, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <Tooltip {...tooltipStyle} />
          <Scatter data={data} fill={CHART_COLORS.dot} opacity={0.7} r={3} />
          {/* Perfect prediction reference line (y=x) */}
          <Line data={refLineData} dataKey="predicted" stroke={CHART_COLORS.refLine} strokeDasharray="6 3" dot={false} activeDot={false} legendType="none" tooltipType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // ---- RESIDUAL: Residuals vs Predicted ----
  if (type === 'residual') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis type="number" dataKey="predicted" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Predicted', position: 'insideBottom', offset: -2, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <YAxis type="number" dataKey="residual" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Residual', angle: -90, position: 'insideLeft', offset: 20, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <Tooltip {...tooltipStyle} />
          <ReferenceLine y={0} stroke={CHART_COLORS.refLine} strokeDasharray="6 3" />
          <Scatter data={data} fill={CHART_COLORS.dot} opacity={0.7} r={3} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // ---- ERROR DISTRIBUTION: Histogram of residuals ----
  if (type === 'error-dist') {
    const residuals = data.map(d => d.residual);
    const minR = Math.min(...residuals);
    const maxR = Math.max(...residuals);
    const binCount = 15;
    const binWidth = (maxR - minR) / binCount || 1;
    const bins: { range: string; count: number; mid: number }[] = [];

    for (let i = 0; i < binCount; i++) {
      const lo = minR + i * binWidth;
      const hi = lo + binWidth;
      const count = residuals.filter(r => r >= lo && (i === binCount - 1 ? r <= hi : r < hi)).length;
      bins.push({ range: lo.toFixed(1), count, mid: (lo + hi) / 2 });
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="range" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 9 }} label={{ value: 'Residual', position: 'insideBottom', offset: -2, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <YAxis stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Frequency', angle: -90, position: 'insideLeft', offset: 20, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {bins.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS.bar} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ---- Q-Q STYLE: Sorted residuals (approximate normality check) ----
  if (type === 'qq') {
    const sorted = [...data].sort((a, b) => a.residual - b.residual).map((d, i) => ({
      theoretical: -2.5 + (5 * i) / (data.length - 1 || 1), // approximate standard normal quantiles
      observed: d.residual,
    }));

    const minVal = Math.min(sorted[0].theoretical, sorted[0].observed);
    const maxVal = Math.max(sorted[sorted.length - 1].theoretical, sorted[sorted.length - 1].observed);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis type="number" dataKey="theoretical" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Theoretical Quantiles', position: 'insideBottom', offset: -2, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <YAxis type="number" dataKey="observed" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} label={{ value: 'Sample Quantiles', angle: -90, position: 'insideLeft', offset: 20, fill: CHART_COLORS.axis, fontSize: 10 }} />
          <Tooltip {...tooltipStyle} />
          <Scatter data={sorted} fill={CHART_COLORS.dot} opacity={0.7} r={3} />
          <Line data={[{ theoretical: minVal, observed: minVal }, { theoretical: maxVal, observed: maxVal }]} dataKey="observed" stroke={CHART_COLORS.refLine} strokeDasharray="6 3" dot={false} activeDot={false} legendType="none" tooltipType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return null;
};

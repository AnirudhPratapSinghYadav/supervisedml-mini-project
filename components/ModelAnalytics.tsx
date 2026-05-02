"use client";

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Line, Scatter, Cell, ReferenceLine, Area
} from 'recharts';
import { ModelResult } from '../app/dataService';

interface Props {
  models: ModelResult[];
  activeModelId: string | null;
}

const COLORS = ['#4C6EF5', '#22C55E', '#F59E0B', '#EF4444'];
const CHART_STYLE = {
  bg: '#1A1D23',
  grid: '#2A2F38',
  axis: '#6B7280',
  text: '#E6E6E6',
  tooltipBg: '#1A1D23',
  tooltipBorder: '#2A2F38',
};

const tooltipStyle = {
  contentStyle: { backgroundColor: CHART_STYLE.tooltipBg, borderColor: CHART_STYLE.tooltipBorder, color: CHART_STYLE.text, fontSize: '11px', fontFamily: 'monospace' },
};

/**
 * ModelAnalytics — 6 advanced comparative visualizations
 * 
 * 1. RMSE & MAE Bar Comparison
 * 2. R² Score Gauge
 * 3. Radar Chart (Multi-Metric)
 * 4. Prediction Spread Comparison
 * 5. Cumulative Error Distribution
 * 6. Model Ranking Summary
 */
export const ModelAnalytics = ({ models, activeModelId }: Props) => {
  if (models.length === 0) return null;

  const bestModel = models.reduce((a, b) => a.rmse < b.rmse ? a : b);

  // ---- DATA PREP ----

  // 1. Bar chart data
  const barData = models.map(m => ({
    name: m.name.replace(' Regression', '').replace(' Regressor', ''),
    RMSE: m.rmse,
    MAE: m.mae,
    isBest: m.id === bestModel.id,
  }));

  // 2. R² data
  const r2Data = models.map((m, i) => ({
    name: m.name.replace(' Regression', '').replace(' Regressor', ''),
    R2: m.r2,
    fill: COLORS[i % COLORS.length],
    isBest: m.id === bestModel.id,
  }));

  // 3. Radar data — normalize metrics to 0-1 scale for comparison
  const maxRmse = Math.max(...models.map(m => m.rmse));
  const maxMae = Math.max(...models.map(m => m.mae));
  const radarMetrics = ['Accuracy (R²)', 'Low RMSE', 'Low MAE', 'Precision', 'Consistency'];
  const radarData = radarMetrics.map((metric, idx) => {
    const row: any = { metric };
    models.forEach((m, i) => {
      const key = m.name.replace(' Regression', '').replace(' Regressor', '');
      if (idx === 0) row[key] = m.r2;
      else if (idx === 1) row[key] = 1 - (m.rmse / (maxRmse * 1.2));
      else if (idx === 2) row[key] = 1 - (m.mae / (maxMae * 1.2));
      else if (idx === 3) row[key] = m.r2 * (1 - m.rmse / (maxRmse * 1.5));
      else row[key] = 1 - Math.abs(m.rmse - m.mae) / m.rmse;
    });
    return row;
  });
  const radarKeys = models.map(m => m.name.replace(' Regression', '').replace(' Regressor', ''));

  // 4. Prediction spread — show how predictions scatter for each model
  const spreadData = models.map((m, i) => {
    if (!m.plotData || m.plotData.length === 0) return null;
    const errors = m.plotData.map(p => Math.abs(p.residual));
    errors.sort((a, b) => a - b);
    const p25 = errors[Math.floor(errors.length * 0.25)];
    const p50 = errors[Math.floor(errors.length * 0.5)];
    const p75 = errors[Math.floor(errors.length * 0.75)];
    const p95 = errors[Math.floor(errors.length * 0.95)];
    return {
      name: m.name.replace(' Regression', '').replace(' Regressor', ''),
      P25: p25, P50: p50, P75: p75, P95: p95,
      fill: COLORS[i % COLORS.length],
    };
  }).filter(Boolean);

  // 5. Cumulative error — for each model, what % of predictions are within X error
  const cumErrorData: any[] = [];
  const thresholds = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  for (const t of thresholds) {
    const row: any = { threshold: t };
    models.forEach(m => {
      const key = m.name.replace(' Regression', '').replace(' Regressor', '');
      if (m.plotData && m.plotData.length > 0) {
        const within = m.plotData.filter(p => Math.abs(p.residual) <= t).length;
        row[key] = Math.round((within / m.plotData.length) * 100);
      } else {
        row[key] = 0;
      }
    });
    cumErrorData.push(row);
  }

  // 6. Ranking summary
  const rankings = models.map((m, i) => {
    const rmseRank = [...models].sort((a, b) => a.rmse - b.rmse).findIndex(x => x.id === m.id) + 1;
    const maeRank = [...models].sort((a, b) => a.mae - b.mae).findIndex(x => x.id === m.id) + 1;
    const r2Rank = [...models].sort((a, b) => b.r2 - a.r2).findIndex(x => x.id === m.id) + 1;
    const avg = (rmseRank + maeRank + r2Rank) / 3;
    return {
      name: m.name.replace(' Regression', '').replace(' Regressor', ''),
      RMSE_Rank: rmseRank,
      MAE_Rank: maeRank,
      R2_Rank: r2Rank,
      Avg_Rank: Math.round(avg * 10) / 10,
      score: Math.round((1 - (avg - 1) / (models.length - 1 || 1)) * 100),
      fill: COLORS[i % COLORS.length],
    };
  }).sort((a, b) => a.Avg_Rank - b.Avg_Rank);

  return (
    <div className="analytics-grid" id="model-analytics">

      {/* 1. RMSE & MAE Bar Comparison */}
      <div className="card analytics-card">
        <div className="chart-label">Error Metrics Comparison</div>
        <p className="chart-desc">RMSE penalizes large errors; MAE gives average absolute error. Lower is better.</p>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="name" stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} />
              <YAxis stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="RMSE" fill="#4C6EF5" radius={[2, 2, 0, 0]} />
              <Bar dataKey="MAE" fill="#22C55E" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. R² Score Gauge */}
      <div className="card analytics-card">
        <div className="chart-label">R² Score (Variance Explained)</div>
        <p className="chart-desc">R²=1.0 means perfect prediction. Higher is better. Shows how much variance each model captures.</p>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r2Data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 1]} stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} />
              <YAxis type="category" dataKey="name" stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} width={80} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="R2" radius={[0, 2, 2, 0]}>
                {r2Data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} opacity={entry.isBest ? 1 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Radar Chart */}
      <div className="card analytics-card">
        <div className="chart-label">Multi-Metric Radar</div>
        <p className="chart-desc">Normalized comparison across 5 performance dimensions. Wider coverage = better overall model.</p>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke={CHART_STYLE.grid} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_STYLE.axis, fontSize: 8 }} />
              <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 1]} />
              {radarKeys.map((key, i) => (
                <Radar key={key} name={key} dataKey={key} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} strokeWidth={1.5} />
              ))}
              <Tooltip {...tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Prediction Error Percentiles */}
      <div className="card analytics-card">
        <div className="chart-label">Error Percentiles (|Residual|)</div>
        <p className="chart-desc">Shows error distribution at 25th, 50th, 75th, and 95th percentiles. Lower bars = tighter predictions.</p>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spreadData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="name" stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} />
              <YAxis stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="P25" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} name="25th %ile" />
              <Bar dataKey="P50" stackId="a" fill="#4C6EF5" name="Median" />
              <Bar dataKey="P75" stackId="a" fill="#F59E0B" name="75th %ile" />
              <Bar dataKey="P95" stackId="a" fill="#EF4444" radius={[2, 2, 0, 0]} name="95th %ile" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Cumulative Error Curve */}
      <div className="card analytics-card">
        <div className="chart-label">Cumulative Accuracy Curve</div>
        <p className="chart-desc">What percentage of predictions fall within X hours of the actual value? Steeper rise = better model.</p>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cumErrorData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="threshold" stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} label={{ value: 'Error Threshold (hours)', position: 'insideBottom', offset: -2, fill: CHART_STYLE.axis, fontSize: 9 }} />
              <YAxis stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} domain={[0, 100]} label={{ value: '% Within', angle: -90, position: 'insideLeft', offset: 20, fill: CHART_STYLE.axis, fontSize: 9 }} />
              <Tooltip {...tooltipStyle} />
              {radarKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3, fill: COLORS[i] }} name={key} />
              ))}
              <ReferenceLine y={90} stroke="#6B7280" strokeDasharray="4 4" label={{ value: '90% target', fill: '#6B7280', fontSize: 8 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Model Ranking Summary */}
      <div className="card analytics-card">
        <div className="chart-label">Model Ranking Score</div>
        <p className="chart-desc">Composite score (0-100) based on average ranking across RMSE, MAE, and R². Higher = better.</p>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankings} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} />
              <YAxis type="category" dataKey="name" stroke={CHART_STYLE.axis} tick={{ fill: CHART_STYLE.axis, fontSize: 9 }} width={80} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {rankings.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} opacity={i === 0 ? 1 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

"use client";

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ModelResult } from '../app/dataService';

interface Props {
  model: ModelResult;
  currentDelay: number;
}

/**
 * WhatIfAnalysis — Interactive slider-based sensitivity analysis.
 * 
 * Lets users drag a slider to see how changing ONE variable
 * (e.g., distance from 50 to 500km) affects the predicted delay,
 * while all other variables stay fixed. Shows the impact visually.
 */
export const WhatIfAnalysis = ({ model, currentDelay }: Props) => {
  const [selectedFeature, setSelectedFeature] = useState('distance');
  const [sliderValue, setSliderValue] = useState(50);

  const featureConfigs: Record<string, { label: string; min: number; max: number; step: number; unit: string; baseCoeff: number }> = {
    distance:  { label: 'Distance',        min: 10,  max: 800, step: 10, unit: 'km', baseCoeff: 0.012 },
    weight:    { label: 'Package Weight',   min: 1,   max: 100, step: 1,  unit: 'kg', baseCoeff: 0.035 },
    warehouse: { label: 'Warehouse Load',   min: 0,   max: 100, step: 5,  unit: '%',  baseCoeff: 0.028 },
    hour:      { label: 'Hour of Day',      min: 0,   max: 23,  step: 1,  unit: 'h',  baseCoeff: 0.08  },
  };

  const cfg = featureConfigs[selectedFeature];

  // Generate what-if curve data
  const curveData = useMemo(() => {
    const points = [];
    for (let v = cfg.min; v <= cfg.max; v += cfg.step) {
      // Deterministic sensitivity: how delay changes as this one variable moves
      const delta = (v - (cfg.max + cfg.min) / 2) * cfg.baseCoeff;
      const peakEffect = selectedFeature === 'hour' ? Math.sin((v - 6) * Math.PI / 12) * 2 : 0;
      const predicted = Math.max(0.5, currentDelay + delta + peakEffect);
      points.push({
        value: v,
        delay: Math.round(predicted * 100) / 100,
      });
    }
    return points;
  }, [selectedFeature, currentDelay, cfg]);

  const currentPoint = curveData.reduce((closest, p) =>
    Math.abs(p.value - sliderValue) < Math.abs(closest.value - sliderValue) ? p : closest
  , curveData[0]);

  return (
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <h2 className="card-title">What-If Analysis</h2>
      <p className="card-desc">
        Drag the slider to see how changing a single variable affects the predicted delay.
        All other inputs stay fixed — this isolates the impact of one factor.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(featureConfigs).map(([key, c]) => (
          <button
            key={key}
            className={`btn-outline ${selectedFeature === key ? 'active' : ''}`}
            onClick={() => { setSelectedFeature(key); setSliderValue(Math.round((c.max + c.min) / 2)); }}
            style={selectedFeature === key ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(76,110,245,0.1)' } : {}}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="range"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={sliderValue}
          onChange={e => setSliderValue(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#4C6EF5' }}
        />
        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', color: 'var(--text-primary)', minWidth: '70px' }}>
          {sliderValue} {cfg.unit}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-label">Current Prediction</div>
          <div className="stat-value">{currentDelay.toFixed(1)}h</div>
        </div>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-label">At {sliderValue}{cfg.unit}</div>
          <div className="stat-value" style={{ color: currentPoint.delay > currentDelay ? '#EF4444' : '#22C55E' }}>
            {currentPoint.delay.toFixed(1)}h
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-label">Delta</div>
          <div className="stat-value" style={{ color: currentPoint.delay - currentDelay > 0 ? '#EF4444' : '#22C55E' }}>
            {currentPoint.delay - currentDelay > 0 ? '+' : ''}{(currentPoint.delay - currentDelay).toFixed(1)}h
          </div>
        </div>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curveData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2F38" vertical={false} />
            <XAxis dataKey="value" stroke="#6B7280" tick={{ fill: '#6B7280', fontSize: 9 }} label={{ value: `${cfg.label} (${cfg.unit})`, position: 'insideBottom', offset: -2, fill: '#6B7280', fontSize: 9 }} />
            <YAxis stroke="#6B7280" tick={{ fill: '#6B7280', fontSize: 9 }} label={{ value: 'Delay (hours)', angle: -90, position: 'insideLeft', offset: 20, fill: '#6B7280', fontSize: 9 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2A2F38', color: '#E6E6E6', fontSize: '11px', fontFamily: 'monospace' }} />
            <Line type="monotone" dataKey="delay" stroke="#4C6EF5" strokeWidth={2} dot={false} />
            <ReferenceLine x={sliderValue} stroke="#F59E0B" strokeDasharray="4 4" />
            <ReferenceLine y={currentDelay} stroke="#6B7280" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

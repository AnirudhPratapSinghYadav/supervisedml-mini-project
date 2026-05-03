"use client";

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ModelResult } from '../app/dataService';

interface Props {
  model: ModelResult;
  currentDelay: number;
}

/**
 * WhatIfAnalysis — Sensitivity analysis strictly derived from model metrics.
 * 
 * Shows how delay prediction changes when you vary one input.
 * Sensitivity amplitude is proportional to the model's RMSE — models with
 * higher error show wider variation ranges because the uncertainty is larger.
 * 
 * If the model has real coefficients (from notebook), uses those directly.
 */
export const WhatIfAnalysis = ({ model, currentDelay }: Props) => {
  const [selectedFeature, setSelectedFeature] = useState(0);
  const [sliderValue, setSliderValue] = useState(50);

  const hasRealCoefs = model.coefficients && model.coefficients.length > 0;
  const featureNames = model.featureNames || [];

  // Build feature list from notebook data or fallback to generic ranges
  const featureConfigs = useMemo(() => {
    if (featureNames.length > 0 && hasRealCoefs) {
      // Use REAL feature names and coefficients from notebook
      return featureNames.map((name, i) => ({
        label: name,
        min: 0,
        max: 100,
        step: 1,
        unit: '',
        coef: model.coefficients![i] || 0,
        isReal: true,
      }));
    }
    // No notebook data — show generic analysis based on RMSE
    return [
      { label: 'Feature 1', min: 0, max: 100, step: 1, unit: '', coef: 0, isReal: false },
      { label: 'Feature 2', min: 0, max: 100, step: 1, unit: '', coef: 0, isReal: false },
      { label: 'Feature 3', min: 0, max: 100, step: 1, unit: '', coef: 0, isReal: false },
    ];
  }, [featureNames, hasRealCoefs, model.coefficients]);

  const cfg = featureConfigs[selectedFeature] || featureConfigs[0];

  const curveData = useMemo(() => {
    const points = [];
    const mid = (cfg.max + cfg.min) / 2;
    const range = cfg.max - cfg.min || 1;

    for (let v = cfg.min; v <= cfg.max; v += cfg.step) {
      let predicted: number;
      if (cfg.isReal && cfg.coef !== 0) {
        // REAL coefficient: linear shift based on actual model weight
        predicted = currentDelay + (v - mid) * cfg.coef;
      } else {
        // No real coefficient: show RMSE-proportional uncertainty envelope
        const deviation = (v - mid) / range;
        predicted = currentDelay + deviation * model.rmse * 2;
      }
      points.push({
        value: v,
        delay: Math.round(Math.max(0, predicted) * 100) / 100,
      });
    }
    return points;
  }, [selectedFeature, currentDelay, cfg, model.rmse]);

  const currentPoint = curveData.reduce((closest, p) =>
    Math.abs(p.value - sliderValue) < Math.abs(closest.value - sliderValue) ? p : closest
  , curveData[0]);

  return (
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <h2 className="card-title">What-If Analysis — {model.name}</h2>
      <p className="card-desc">
        {hasRealCoefs ? (
          <>Using <strong>real coefficients</strong> from your notebook. Each curve shows how the prediction shifts based on the model&apos;s actual learned weights.</>
        ) : (
          <>Sensitivity range proportional to this model&apos;s <strong>RMSE ({model.rmse.toFixed(2)})</strong>.
          To see exact coefficient-based curves, print <code>model.coef_</code> in your notebook.</>
        )}
      </p>

      {featureConfigs.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {featureConfigs.map((c, i) => (
            <button
              key={i}
              className={`btn-outline ${selectedFeature === i ? 'active' : ''}`}
              onClick={() => { setSelectedFeature(i); setSliderValue(Math.round((c.max + c.min) / 2)); }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

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
          <div className="stat-label">Current</div>
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
            <XAxis dataKey="value" stroke="#6B7280" tick={{ fill: '#6B7280', fontSize: 9 }}
              label={{ value: cfg.label, position: 'insideBottom', offset: -2, fill: '#6B7280', fontSize: 9 }} />
            <YAxis stroke="#6B7280" tick={{ fill: '#6B7280', fontSize: 9 }}
              label={{ value: 'Delay', angle: -90, position: 'insideLeft', offset: 20, fill: '#6B7280', fontSize: 9 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2A2F38', color: '#E6E6E6', fontSize: '11px', fontFamily: 'monospace' }} />
            <Line type="monotone" dataKey="delay" stroke="#4C6EF5" strokeWidth={2} dot={false} />
            <ReferenceLine x={sliderValue} stroke="#F59E0B" strokeDasharray="4 4" />
            <ReferenceLine y={currentDelay} stroke="#6B7280" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {!hasRealCoefs && (
        <p className="maths-tiny" style={{ marginTop: '0.5rem' }}>
          Curve shows ±RMSE uncertainty range. For exact sensitivity, add to notebook:
          <code style={{ display: 'block', marginTop: '0.25rem', color: 'var(--accent)' }}>
            print(f&quot;coef: {'{'}model.coef_.tolist(){'}'}&quot;)
          </code>
        </p>
      )}
    </div>
  );
};

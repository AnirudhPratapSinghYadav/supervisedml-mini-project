"use client";

import React, { useState } from 'react';
import { ModelResult } from '../app/dataService';
import { InferenceData } from './InferenceForm';

interface Props {
  model: ModelResult;
  inputData: InferenceData;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MathsBehind — Full math breakdown. Always shows complete data.
 * Uses real notebook data when available, falls back to model-derived values.
 */
export const MathsBehind = ({ model, inputData, isOpen, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<'computation' | 'features' | 'residuals' | 'theory'>('computation');

  if (!isOpen) return null;

  const trafficMap: Record<string, number> = { 'Low': 0, 'Moderate': 1, 'High': 2 };
  const trafficVal = trafficMap[inputData.trafficLevel] ?? 1;

  const inputFeatures = [
    { name: 'Distance (km)',       value: Number(inputData.distance) },
    { name: 'Package Weight (kg)', value: Number(inputData.weight) },
    { name: 'Warehouse Load (%)',  value: Number(inputData.warehouseLoad) },
    { name: 'Traffic Level',       value: trafficVal },
    { name: 'Hour of Day',         value: Number(inputData.hour) },
    { name: 'Day of Week',         value: Number(inputData.day) },
  ];

  // Feature importance — use real data from model
  const importance = model.featureImportance || [];
  const maxImp = importance.length > 0 ? Math.max(...importance.map(f => f.importance)) : 1;

  // Coefficients — use real data from model
  const coefs = model.coefficients || [];
  const maxCoef = coefs.length > 0 ? Math.max(...coefs.map(Math.abs)) : 1;

  // Residual stats from plot data
  const residuals = model.plotData?.map(p => p.residual) || [];
  const hasResiduals = residuals.length > 0;
  const meanResidual = hasResiduals ? residuals.reduce((s, r) => s + r, 0) / residuals.length : 0;
  const stdResidual = hasResiduals ? Math.sqrt(residuals.reduce((s, r) => s + (r - meanResidual) ** 2, 0) / residuals.length) : 0;
  const within1std = residuals.filter(r => Math.abs(r - meanResidual) <= stdResidual).length;
  const pctWithin1 = hasResiduals ? Math.round((within1std / residuals.length) * 100) : 0;

  return (
    <div className="maths-overlay" onClick={onClose}>
      <div className="maths-modal" onClick={e => e.stopPropagation()}>

        <div className="maths-header">
          <div>
            <h2>Mathematics Behind the Prediction</h2>
            <p className="maths-subtitle">
              {model.name} — Predicted {model.predictedDelay.toFixed(1)} hours delay
              {model.source && <span> · Source: {model.source}</span>}
            </p>
          </div>
          <button className="maths-close" onClick={onClose}>✕</button>
        </div>

        <div className="maths-tabs">
          {([
            { id: 'computation' as const, label: 'Step-by-Step' },
            { id: 'features' as const,    label: 'Feature Impact' },
            { id: 'residuals' as const,   label: 'Error Analysis' },
            { id: 'theory' as const,      label: 'Deep Theory' },
          ]).map(tab => (
            <button key={tab.id} className={`maths-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          ))}
        </div>

        <div className="maths-content">

          {/* TAB 1: Step-by-Step */}
          {activeTab === 'computation' && (
            <div className="maths-section">
              <h3>1. Input Vector</h3>
              <p className="maths-explain">The exact values fed into the model.</p>
              <div className="maths-code">
                X = [{inputFeatures.map(f => f.value).join(', ')}]
              </div>
              <div className="maths-labels">
                {inputFeatures.map((f, i) => (
                  <span key={i} className="maths-feature-label">{f.name}: <strong>{f.value}</strong></span>
                ))}
              </div>

              {coefs.length > 0 && (
                <>
                  <h3>2. Model Coefficients</h3>
                  <p className="maths-explain">Learned weights from the trained model.</p>
                  <div className="maths-code">
                    β = [{coefs.map(c => c.toFixed(4)).join(', ')}]
                    {model.intercept !== undefined && `\nIntercept (β₀): ${model.intercept.toFixed(4)}`}
                  </div>
                  <h3>3. Computation</h3>
                  <div className="maths-code">
                    ŷ = {model.intercept?.toFixed(4) || '0'} + {coefs.map((c, i) => `(${c.toFixed(3)} × ${inputFeatures[i]?.value || '?'})`).join(' + ')}{'\n'}
                    ŷ = {model.predictedDelay.toFixed(4)} hours
                  </div>
                </>
              )}

              {coefs.length === 0 && (
                <>
                  <h3>2. Model Output</h3>
                  <p className="maths-explain">
                    {/random\s*forest/i.test(model.name) && 'Each decision tree independently processes the input through learned splits. The final prediction is the average of all tree outputs.'}
                    {/gradient\s*boost/i.test(model.name) && 'Starting from the training mean, each sequential tree adds a correction. The sum of all corrections produces the final prediction.'}
                    {/linear|ridge|lasso/i.test(model.name) && 'The model computes a weighted sum of the input features plus an intercept.'}
                    {!/random|gradient|linear|ridge|lasso/i.test(model.name) && `${model.name} processes the feature vector and outputs the prediction.`}
                  </p>
                  <div className="maths-code">ŷ = {model.predictedDelay.toFixed(4)} hours</div>
                </>
              )}

              <h3>{coefs.length > 0 ? '4' : '3'}. Model Quality</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">RMSE</div>
                  <div className="stat-value">{model.rmse.toFixed(3)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">MAE</div>
                  <div className="stat-value">{model.mae.toFixed(3)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">R²</div>
                  <div className="stat-value">{model.r2.toFixed(3)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Confidence</div>
                  <div className="stat-value">±{model.mae.toFixed(1)}h</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Feature Impact */}
          {activeTab === 'features' && (
            <div className="maths-section">
              <h3>Feature Importance — {model.name}</h3>

              {importance.length > 0 ? (
                <>
                  <p className="maths-explain">
                    Importance values from the trained model. Higher = more influence on prediction.
                  </p>
                  <div className="feature-bars">
                    {importance.sort((a, b) => b.importance - a.importance).map((f, i) => (
                      <div key={i} className="feature-row">
                        <div className="feature-name">{f.name}</div>
                        <div className="feature-value">{(f.importance * 100).toFixed(1)}%</div>
                        <div className="feature-bar-track">
                          <div className="feature-bar-fill"
                            style={{ width: `${(f.importance / maxImp) * 100}%`, backgroundColor: '#4C6EF5' }} />
                        </div>
                        <div className="feature-contrib">{f.importance.toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : coefs.length > 0 ? (
                <>
                  <p className="maths-explain">
                    Model coefficients — each shows how one unit change in the feature affects delay.
                  </p>
                  <div className="feature-bars">
                    {coefs.map((c, i) => {
                      const fname = model.featureNames?.[i] || inputFeatures[i]?.name || `Feature ${i + 1}`;
                      return (
                        <div key={i} className="feature-row">
                          <div className="feature-name">{fname}</div>
                          <div className="feature-value">{c >= 0 ? '+' : ''}{c.toFixed(4)}</div>
                          <div className="feature-bar-track">
                            <div className="feature-bar-fill"
                              style={{ width: `${(Math.abs(c) / maxCoef) * 100}%`, backgroundColor: c > 0 ? '#4C6EF5' : '#22C55E' }} />
                          </div>
                          <div className="feature-contrib">{c > 0 ? '+' : ''}{c.toFixed(4)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="maths-explain">
                  This model type doesn&apos;t expose linear coefficients. Use tree-based models
                  (Random Forest, Gradient Boosting) for feature importance or linear models for coefficients.
                </p>
              )}
            </div>
          )}

          {/* TAB 3: Error Analysis */}
          {activeTab === 'residuals' && (
            <div className="maths-section">
              <h3>Residual Analysis — {residuals.length} test samples</h3>
              <p className="maths-explain">
                Residual = actual − predicted. Computed from {residuals.length} test set predictions.
              </p>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Mean Residual</div>
                  <div className="stat-value">{meanResidual.toFixed(3)}</div>
                  <div className="stat-interpret">
                    {Math.abs(meanResidual) < 0.5 ? '✓ Unbiased' : '⚠ Systematic bias'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Std Dev</div>
                  <div className="stat-value">{stdResidual.toFixed(3)}</div>
                  <div className="stat-interpret">Error spread</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Within ±1σ</div>
                  <div className="stat-value">{pctWithin1}%</div>
                  <div className="stat-interpret">{pctWithin1 >= 65 ? '✓ Normal' : '⚠ Non-normal'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">RMSE</div>
                  <div className="stat-value">{model.rmse.toFixed(3)}</div>
                  <div className="stat-interpret">Root mean squared error</div>
                </div>
              </div>

              <h3 style={{ marginTop: '1.5rem' }}>Diagnostic Checklist</h3>
              <div className="residual-checklist">
                <div className="check-item">
                  <span className={Math.abs(meanResidual) < 0.5 ? 'check-pass' : 'check-fail'}>
                    {Math.abs(meanResidual) < 0.5 ? '✓' : '✗'}
                  </span>
                  <span>Mean residual near zero (no systematic bias)</span>
                </div>
                <div className="check-item">
                  <span className={pctWithin1 >= 60 ? 'check-pass' : 'check-fail'}>
                    {pctWithin1 >= 60 ? '✓' : '✗'}
                  </span>
                  <span>~68% within ±1σ (normally distributed errors)</span>
                </div>
                <div className="check-item">
                  <span className={model.r2 >= 0.8 ? 'check-pass' : 'check-fail'}>
                    {model.r2 >= 0.8 ? '✓' : '✗'}
                  </span>
                  <span>R² ≥ 0.80 ({(model.r2 * 100).toFixed(1)}% variance explained)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Deep Theory */}
          {activeTab === 'theory' && (
            <div className="maths-section">
              <h3>Mathematical Theory: {model.name}</h3>
              <p className="maths-explain">Standard mathematical definitions for this model type.</p>

              {/linear/i.test(model.name) && (
                <>
                  <div className="theory-block"><div className="theory-label">Equation</div>
                    <div className="maths-equation">ŷ = β₀ + β₁x₁ + β₂x₂ + ... + βₚxₚ</div></div>
                  <div className="theory-block"><div className="theory-label">Loss (MSE)</div>
                    <div className="maths-equation">J(β) = (1/n) Σᵢ (yᵢ − ŷᵢ)²</div></div>
                  <div className="theory-block"><div className="theory-label">Solution (Normal Equation)</div>
                    <div className="maths-equation">β = (XᵀX)⁻¹ Xᵀy</div>
                    <p>Closed-form — no iterations needed.</p></div>
                </>
              )}
              {/ridge/i.test(model.name) && (
                <>
                  <div className="theory-block"><div className="theory-label">Loss (MSE + L2 Penalty)</div>
                    <div className="maths-equation">J(β) = Σᵢ (yᵢ − ŷᵢ)² + λ Σⱼ βⱼ²</div></div>
                  <div className="theory-block"><div className="theory-label">Solution</div>
                    <div className="maths-equation">β = (XᵀX + λI)⁻¹ Xᵀy</div>
                    <p>λI stabilizes inversion when features are correlated.</p></div>
                </>
              )}
              {/random\s*forest/i.test(model.name) && (
                <>
                  <div className="theory-block"><div className="theory-label">Prediction</div>
                    <div className="maths-equation">ŷ = (1/B) Σᵦ₌₁ᴮ Tᵦ(x)</div>
                    <p>Average of B trees, each on bootstrap samples with √p random features.</p></div>
                  <div className="theory-block"><div className="theory-label">Split Criterion</div>
                    <div className="maths-equation">min MSE(left) + MSE(right)</div></div>
                </>
              )}
              {/gradient\s*boost/i.test(model.name) && (
                <>
                  <div className="theory-block"><div className="theory-label">Update Rule</div>
                    <div className="maths-equation">Fₘ(x) = Fₘ₋₁(x) + ν · hₘ(x)</div>
                    <p>Each tree hₘ fits residuals rₘ = y − Fₘ₋₁(x). ν is learning rate.</p></div>
                  <div className="theory-block"><div className="theory-label">Gradient</div>
                    <div className="maths-equation">rₘ = −∂L/∂F = y − Fₘ₋₁(x)</div></div>
                </>
              )}
              {!/linear|ridge|random\s*forest|gradient\s*boost/i.test(model.name) && (
                <div className="theory-block"><div className="theory-label">Model</div>
                  <p>{model.name} — Consult sklearn documentation for mathematical formulation.</p></div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

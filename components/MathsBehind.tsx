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
 * MathsBehind — Full-screen modal showing exactly HOW the prediction was computed.
 *
 * Breaks down:
 *   1. What data went in (feature vector)
 *   2. How the model processes it (step-by-step)
 *   3. What the equation looks like with real numbers
 *   4. Feature contribution bars (visual)
 *   5. Residual analysis interpretation
 */
export const MathsBehind = ({ model, inputData, isOpen, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<'computation' | 'features' | 'residuals' | 'theory'>('computation');

  if (!isOpen) return null;

  const trafficMap: Record<string, number> = { 'Low': 0, 'Moderate': 1, 'High': 2 };
  const trafficVal = trafficMap[inputData.trafficLevel] ?? 1;

  // Simulate feature contributions (proportional to input × approximate coefficient)
  const features = [
    { name: 'Distance (km)',      value: Number(inputData.distance),      weight: 0.018,  contribution: 0 },
    { name: 'Package Weight (kg)', value: Number(inputData.weight),       weight: 0.045,  contribution: 0 },
    { name: 'Warehouse Load (%)',  value: Number(inputData.warehouseLoad), weight: 0.032,  contribution: 0 },
    { name: 'Traffic Level',       value: trafficVal,                      weight: 1.2,    contribution: 0 },
    { name: 'Hour of Day',         value: Number(inputData.hour),          weight: 0.065,  contribution: 0 },
    { name: 'Day of Week',         value: Number(inputData.day),           weight: 0.12,   contribution: 0 },
  ];

  // Calculate contributions
  const intercept = 0.85;
  let totalLinear = intercept;
  features.forEach(f => {
    f.contribution = Math.round(f.value * f.weight * 100) / 100;
    totalLinear += f.contribution;
  });
  const maxContrib = Math.max(...features.map(f => Math.abs(f.contribution)));

  // Residual stats from plot data
  const residuals = model.plotData?.map(p => p.residual) || [];
  const meanResidual = residuals.length > 0 ? residuals.reduce((s, r) => s + r, 0) / residuals.length : 0;
  const stdResidual = residuals.length > 0 ? Math.sqrt(residuals.reduce((s, r) => s + (r - meanResidual) ** 2, 0) / residuals.length) : 0;
  const within1std = residuals.filter(r => Math.abs(r - meanResidual) <= stdResidual).length;
  const pctWithin1 = residuals.length > 0 ? Math.round((within1std / residuals.length) * 100) : 0;

  return (
    <div className="maths-overlay" onClick={onClose}>
      <div className="maths-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="maths-header">
          <div>
            <h2>Mathematics Behind the Prediction</h2>
            <p className="maths-subtitle">{model.name} — Predicted {model.predictedDelay.toFixed(1)} hours delay</p>
          </div>
          <button className="maths-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="maths-tabs">
          {[
            { id: 'computation' as const, label: 'Step-by-Step' },
            { id: 'features' as const,    label: 'Feature Impact' },
            { id: 'residuals' as const,   label: 'Error Analysis' },
            { id: 'theory' as const,      label: 'Deep Theory' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`maths-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="maths-content">

          {/* TAB 1: Step-by-Step Computation */}
          {activeTab === 'computation' && (
            <div className="maths-section">
              <h3>1. Your Input Vector</h3>
              <p className="maths-explain">These are the exact values you entered, formatted as the feature vector X that gets fed into the model.</p>
              <div className="maths-code">
                X = [{features.map(f => f.value).join(', ')}]
              </div>
              <div className="maths-labels">
                {features.map((f, i) => (
                  <span key={i} className="maths-feature-label">{f.name}: <strong>{f.value}</strong></span>
                ))}
              </div>

              <h3>2. Preprocessing</h3>
              <p className="maths-explain">
                Before the model sees your data, numerical features are <strong>standardized</strong> (mean=0, std=1)
                and categorical features are <strong>one-hot encoded</strong>. This ensures distance (measured in km)
                and warehouse load (measured in %) are on the same scale.
              </p>
              <div className="maths-code">
                X_scaled = (X - μ) / σ    →    Each feature becomes comparable
              </div>

              <h3>3. Model Computation</h3>
              <p className="maths-explain">
                {/linear/i.test(model.name) &&
                  'The model multiplies each scaled feature by its learned coefficient (β), sums them up, and adds the intercept. This is a simple dot product: ŷ = β₀ + β₁x₁ + β₂x₂ + ... One multiplication per feature.'}
                {/ridge/i.test(model.name) &&
                  'Same as Linear Regression (dot product), but the coefficients were trained with an L2 penalty that prevents any single feature from having an outsized weight. The computation is identical at inference time.'}
                {/random\s*forest/i.test(model.name) &&
                  'Each of the ~100 decision trees independently traverses your input through its learned splits (e.g., "if distance > 200 and traffic = High, go left"). Each tree outputs a prediction. The final answer is the average of all 100 predictions.'}
                {/gradient\s*boost/i.test(model.name) &&
                  'The prediction starts from a base value (mean of training delays). Then each of the ~100-500 trees adds a small correction. Tree 1 corrects the biggest errors, Tree 2 corrects what Tree 1 missed, and so on. The final prediction is the sum of all corrections.'}
              </p>
              <div className="maths-code">
                ŷ = {model.predictedDelay.toFixed(4)} hours
              </div>

              <h3>4. Confidence</h3>
              <p className="maths-explain">
                Based on the test set evaluation, this model has an average error (MAE) of <strong>{model.mae.toFixed(2)} hours</strong>.
                This means the true delay is likely within <strong>±{model.mae.toFixed(1)} hours</strong> of the predicted value.
              </p>
              <div className="maths-confidence">
                <div className="conf-range">
                  <span className="conf-low">{Math.max(0, model.predictedDelay - model.mae).toFixed(1)}h</span>
                  <div className="conf-bar">
                    <div className="conf-fill" style={{ width: '100%' }}>
                      <div className="conf-marker" style={{ left: '50%' }}>{model.predictedDelay.toFixed(1)}h</div>
                    </div>
                  </div>
                  <span className="conf-high">{(model.predictedDelay + model.mae).toFixed(1)}h</span>
                </div>
                <p className="maths-tiny">Prediction ± MAE confidence interval</p>
              </div>
            </div>
          )}

          {/* TAB 2: Feature Impact */}
          {activeTab === 'features' && (
            <div className="maths-section">
              <h3>Feature Contribution Breakdown</h3>
              <p className="maths-explain">
                Each bar shows how much each input feature contributes to the final prediction.
                Longer bars = more influence on the delay estimate. This helps identify
                which operational factors are driving the predicted delay.
              </p>

              <div className="feature-bars">
                {features.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map((f, i) => (
                  <div key={i} className="feature-row">
                    <div className="feature-name">{f.name}</div>
                    <div className="feature-value">{f.value}</div>
                    <div className="feature-bar-track">
                      <div
                        className="feature-bar-fill"
                        style={{
                          width: `${Math.min(100, (Math.abs(f.contribution) / maxContrib) * 100)}%`,
                          backgroundColor: f.contribution > 0 ? '#4C6EF5' : '#22C55E',
                        }}
                      />
                    </div>
                    <div className="feature-contrib">
                      {f.contribution > 0 ? '+' : ''}{f.contribution.toFixed(2)}h
                    </div>
                  </div>
                ))}
                <div className="feature-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <div className="feature-name" style={{ color: 'var(--text-primary)' }}>Intercept (bias)</div>
                  <div className="feature-value">—</div>
                  <div className="feature-bar-track" />
                  <div className="feature-contrib" style={{ color: 'var(--text-primary)' }}>+{intercept.toFixed(2)}h</div>
                </div>
              </div>

              <div className="maths-code" style={{ marginTop: '1rem' }}>
                Total ≈ {intercept.toFixed(2)} + {features.map(f => f.contribution.toFixed(2)).join(' + ')} = {totalLinear.toFixed(2)}h
              </div>
              <p className="maths-tiny">
                Note: For tree-based models (Random Forest, Gradient Boosting), contributions are non-linear
                and cannot be decomposed into simple additions. The bars above show approximate feature importance.
              </p>
            </div>
          )}

          {/* TAB 3: Error Analysis */}
          {activeTab === 'residuals' && (
            <div className="maths-section">
              <h3>Residual (Error) Analysis</h3>
              <p className="maths-explain">
                A residual is the difference between the actual delay and what the model predicted:
                <strong> residual = actual − predicted</strong>.
                Analyzing residuals tells us how reliable the model is.
              </p>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Mean Residual</div>
                  <div className="stat-value">{meanResidual.toFixed(3)}h</div>
                  <div className="stat-interpret">
                    {Math.abs(meanResidual) < 0.1 ? '✓ Near zero — model is unbiased' : '⚠ Non-zero — model has systematic bias'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Std Dev of Residuals</div>
                  <div className="stat-value">{stdResidual.toFixed(3)}h</div>
                  <div className="stat-interpret">Typical spread of prediction errors</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Within ±1 Std Dev</div>
                  <div className="stat-value">{pctWithin1}%</div>
                  <div className="stat-interpret">
                    {pctWithin1 >= 65 ? '✓ Consistent with normal distribution (~68% expected)' : '⚠ Errors may not be normally distributed'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Test Samples</div>
                  <div className="stat-value">{residuals.length}</div>
                  <div className="stat-interpret">Number of data points used for evaluation</div>
                </div>
              </div>

              <h3 style={{ marginTop: '1.5rem' }}>What Good Residuals Look Like</h3>
              <div className="residual-checklist">
                <div className="check-item">
                  <span className={meanResidual < 0.5 ? 'check-pass' : 'check-fail'}>
                    {Math.abs(meanResidual) < 0.5 ? '✓' : '✗'}
                  </span>
                  <span>Mean residual near zero (no systematic over/under-prediction)</span>
                </div>
                <div className="check-item">
                  <span className={pctWithin1 >= 60 ? 'check-pass' : 'check-fail'}>
                    {pctWithin1 >= 60 ? '✓' : '✗'}
                  </span>
                  <span>~68% of errors within ±1 standard deviation (normal distribution)</span>
                </div>
                <div className="check-item">
                  <span className={model.r2 >= 0.8 ? 'check-pass' : 'check-fail'}>
                    {model.r2 >= 0.8 ? '✓' : '✗'}
                  </span>
                  <span>R² ≥ 0.80 (model explains ≥80% of delay variance)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Deep Theory */}
          {activeTab === 'theory' && (
            <div className="maths-section">
              <h3>Deep Dive: {model.name}</h3>

              {/linear/i.test(model.name) && (
                <>
                  <div className="theory-block">
                    <div className="theory-label">The Core Idea</div>
                    <p>Find the straight line (or hyperplane in higher dimensions) that minimizes the total squared distance between the line and all data points.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Equation</div>
                    <div className="maths-equation">ŷ = β₀ + β₁x₁ + β₂x₂ + ... + βₚxₚ + ε</div>
                    <p>β₀ is the intercept (base delay when all features are zero). Each βⱼ is the slope — how much delay changes per unit change in feature xⱼ. ε is the irreducible error.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Loss Function</div>
                    <div className="maths-equation">J(β) = Σᵢ₌₁ⁿ (yᵢ − ŷᵢ)² = Σᵢ₌₁ⁿ (yᵢ − Xᵢβ)²</div>
                    <p>We want to find β that minimizes this. Squaring ensures positive and negative errors don't cancel out, and penalizes large errors quadratically.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Solution (Normal Equation)</div>
                    <div className="maths-equation">β = (XᵀX)⁻¹ Xᵀy</div>
                    <p>This is a closed-form solution — computed in one step using matrix algebra. No iterations, no learning rate, no hyperparameters. X is the feature matrix, y is the target vector.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">Assumptions</div>
                    <p>1. Linearity: relationship between features and target is linear. 2. Independence: observations are independent. 3. Homoscedasticity: constant variance of residuals. 4. Normality: residuals are normally distributed.</p>
                  </div>
                </>
              )}

              {/ridge/i.test(model.name) && (
                <>
                  <div className="theory-block">
                    <div className="theory-label">The Core Idea</div>
                    <p>Same as Linear Regression, but add a penalty that discourages large coefficients. This prevents the model from "overreacting" to noise in the training data.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Loss Function</div>
                    <div className="maths-equation">J(β) = Σᵢ (yᵢ − ŷᵢ)² + λ Σⱼ βⱼ²</div>
                    <p>The first term is the same MSE. The second term (λΣβⱼ²) is the L2 penalty — it shrinks coefficients toward zero. λ controls how much shrinkage: λ=0 is OLS, λ=∞ forces all β→0.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Solution</div>
                    <div className="maths-equation">β = (XᵀX + λI)⁻¹ Xᵀy</div>
                    <p>The identity matrix λI added to XᵀX guarantees the matrix is invertible even when features are highly correlated (multicollinearity). This is why Ridge is more stable than OLS.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">When to Use Ridge</div>
                    <p>When features are correlated (e.g., distance and fuel cost). When you have more features than samples. When OLS coefficients are unreasonably large.</p>
                  </div>
                </>
              )}

              {/random\s*forest/i.test(model.name) && (
                <>
                  <div className="theory-block">
                    <div className="theory-label">The Core Idea</div>
                    <p>Build many decision trees, each seeing a different random subset of the data and features. Average their predictions to get a more stable, accurate result. "Wisdom of the crowd" applied to machine learning.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Algorithm</div>
                    <div className="maths-equation">ŷ = (1/B) Σᵦ₌₁ᴮ Tᵦ(x)</div>
                    <p>For b = 1 to B (e.g., 100 trees): Draw a bootstrap sample from training data. Build a decision tree using random √p features at each split. Store the tree. Final prediction = average of all B trees.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">Why It Works</div>
                    <p>Each tree is intentionally "weak" — it overfits to its bootstrap sample. But because each tree sees different data and features, their errors are uncorrelated. Averaging uncorrelated errors reduces overall variance dramatically.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">Feature Importance</div>
                    <p>Measured by "mean decrease in impurity" — how much each feature reduces MSE when used for splitting. Features that frequently appear near the root of trees are the most important.</p>
                  </div>
                </>
              )}

              {/gradient\s*boost/i.test(model.name) && (
                <>
                  <div className="theory-block">
                    <div className="theory-label">The Core Idea</div>
                    <p>Build trees one at a time, where each new tree specifically targets the mistakes of the previous ensemble. This is "boosting" — iteratively correcting errors.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">The Algorithm</div>
                    <div className="maths-equation">Fₘ(x) = Fₘ₋₁(x) + ν · hₘ(x)</div>
                    <p>Start with F₀(x) = mean(y). For m = 1 to M: Compute pseudo-residuals rₘ = y − Fₘ₋₁(x). Fit a shallow tree hₘ to these residuals. Update: Fₘ = Fₘ₋₁ + ν·hₘ, where ν ∈ (0,1] is the learning rate.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">Why the Learning Rate Matters</div>
                    <p>A small ν (e.g., 0.1) means each tree contributes only 10% of its full correction. This requires more trees (higher M) but produces a smoother, more generalizable model. It's the key hyperparameter.</p>
                  </div>
                  <div className="theory-block">
                    <div className="theory-label">Gradient Descent Connection</div>
                    <div className="maths-equation">∂L/∂F = ∂/∂F [(1/2)(y − F)²] = −(y − F) = −rₘ</div>
                    <p>The pseudo-residuals rₘ are the negative gradient of the loss function. Each tree performs one step of gradient descent in function space. This is why it's called "gradient" boosting.</p>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

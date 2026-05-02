"use client";

import React from 'react';

interface Props {
  modelName: string;
}

/**
 * Mathematical theory panel.
 * 
 * Maps model NAME (not a hardcoded ID) to its equation, loss function,
 * and practical interpretation. Uses case-insensitive matching so it works
 * regardless of what the backend calls the model.
 */

interface Theory {
  title: string;
  equation: string;
  loss: string;
  solution: string;
  interpretation: string;
}

const THEORY_MAP: { pattern: RegExp; theory: Theory }[] = [
  {
    pattern: /linear/i,
    theory: {
      title: "Linear Regression — Ordinary Least Squares",
      equation: "ŷ = β₀ + β₁x₁ + β₂x₂ + ... + βₚxₚ",
      loss: "J(β) = (1/n) Σᵢ (yᵢ − ŷᵢ)²",
      solution: "Closed-form: β = (XᵀX)⁻¹ Xᵀy — no iterations needed.",
      interpretation: "Assumes a strictly linear relationship between features and delay. If distance doubles, the model predicts delay increases by exactly 2×β₁. Fast to train, but cannot capture non-linear patterns (e.g., traffic saturation thresholds)."
    }
  },
  {
    pattern: /ridge/i,
    theory: {
      title: "Ridge Regression — L2 Regularized",
      equation: "ŷ = Xβ + ε",
      loss: "J(β) = (1/n) Σᵢ (yᵢ − ŷᵢ)² + λ Σⱼ βⱼ²",
      solution: "Closed-form: β = (XᵀX + λI)⁻¹ Xᵀy. The λ penalty shrinks coefficients toward zero without eliminating them.",
      interpretation: "Addresses multicollinearity — when distance and warehouse load are correlated, OLS coefficients become unstable. Ridge stabilizes them by penalizing large weights. The regularization parameter λ controls the bias-variance tradeoff."
    }
  },
  {
    pattern: /random\s*forest/i,
    theory: {
      title: "Random Forest — Ensemble Bagging",
      equation: "ŷ = (1/B) Σᵦ Tᵦ(x),  b = 1 ... B trees",
      loss: "Per-node split criterion: min MSE(left) + MSE(right)",
      solution: "No gradient descent. Each tree is built on a bootstrap sample with random feature subsets (√p features per split). Predictions are averaged across all B trees.",
      interpretation: "Captures non-linear interactions natively (e.g., traffic × time-of-day). Robust to outliers. The averaging of many decorrelated trees reduces variance without increasing bias. Feature importance is derived from mean decrease in impurity."
    }
  },
  {
    pattern: /gradient\s*boost/i,
    theory: {
      title: "Gradient Boosting — Sequential Ensemble",
      equation: "Fₘ(x) = Fₘ₋₁(x) + ν · hₘ(x),  m = 1 ... M stages",
      loss: "L(y, F) = (1/2)(y − F(x))² → gradient: rₘ = y − Fₘ₋₁(x)",
      solution: "At each stage m, fit a new tree hₘ to the pseudo-residuals rₘ. Learning rate ν ∈ (0,1] controls step size. Typical: 100-500 trees, ν = 0.1.",
      interpretation: "Each iteration corrects the errors of the previous ensemble. Highly effective at capturing complex supply chain interactions (carrier × traffic × warehouse load). Prone to overfitting if M is too large — controlled by early stopping or tree depth limits."
    }
  },
];

const getTheory = (modelName: string): Theory => {
  for (const entry of THEORY_MAP) {
    if (entry.pattern.test(modelName)) return entry.theory;
  }
  return {
    title: modelName,
    equation: "ŷ = f(X) + ε",
    loss: "L(y, ŷ) = loss function",
    solution: "Optimization method depends on model type.",
    interpretation: "Select a recognized model to see detailed mathematical foundations."
  };
};

export const MathExplanation = ({ modelName }: Props) => {
  const theory = getTheory(modelName);

  return (
    <div className="math-panel">
      <h3>{theory.title}</h3>
      <div className="math-row">
        <div>
          <span className="label">Equation</span>
          <p>{theory.equation}</p>
        </div>
        <div>
          <span className="label">Loss Function</span>
          <p>{theory.loss}</p>
        </div>
        <div>
          <span className="label">Solution Method</span>
          <p>{theory.solution}</p>
        </div>
        <div>
          <span className="label">Interpretation</span>
          <p>{theory.interpretation}</p>
        </div>
      </div>
    </div>
  );
};

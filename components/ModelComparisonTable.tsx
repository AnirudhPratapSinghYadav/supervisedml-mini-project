"use client";

import React from 'react';

export interface ModelMetrics {
  id: string;
  name: string;
  rmse: number;
  mae: number;
  r2: number;
}

interface Props {
  models: ModelMetrics[];
  activeModelId: string | null;
  onSelectModel: (id: string) => void;
}

export const ModelComparisonTable = ({ models, activeModelId, onSelectModel }: Props) => {
  if (models.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No models loaded. Submit a prediction to see results.</p>;
  }

  // Dynamically determine the best model (lowest RMSE)
  const bestModelId = models.reduce((best, m) => m.rmse < best.rmse ? m : best, models[0]).id;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>RMSE</th>
          <th>MAE</th>
          <th>R²</th>
        </tr>
      </thead>
      <tbody>
        {models.map((model) => (
          <tr
            key={model.id}
            className={`${model.id === activeModelId ? 'active' : ''} ${model.id === bestModelId ? 'best' : ''}`}
            onClick={() => onSelectModel(model.id)}
          >
            <td>{model.name}</td>
            <td>{model.rmse.toFixed(3)}</td>
            <td>{model.mae.toFixed(3)}</td>
            <td>{model.r2.toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

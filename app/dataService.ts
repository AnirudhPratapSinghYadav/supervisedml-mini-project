import { InferenceData } from '../components/InferenceForm';

/* ===================================================================
   DATA SERVICE
   
   Connects to a FastAPI server running from your Google Colab notebook.
   Set NEXT_PUBLIC_API_URL in .env.local to your Colab ngrok URL.
   
   When the backend is unreachable, falls back to a deterministic
   demo mode using input-derived calculations — clearly labelled
   so viewers know it's simulated. When the backend IS connected,
   all data comes from real trained sklearn pipelines.
   =================================================================== */

export interface PlotPoint {
  actual: number;
  predicted: number;
  residual: number;
}

export interface FeatureImportance {
  name: string;
  importance: number;
}

export interface ModelResult {
  id: string;
  name: string;
  rmse: number;
  mae: number;
  r2: number;
  predictedDelay: number;
  plotData: PlotPoint[];
  isDemo?: boolean;
  featureNames?: string[];
  featureImportance?: FeatureImportance[];
  coefficients?: number[];
  intercept?: number;
  source?: 'notebook' | 'api' | 'sample';
}

export type BackendStatus = 'idle' | 'connected' | 'demo' | 'error';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

/**
 * Checks if the backend API is reachable.
 */
export const checkBackendHealth = async (): Promise<BackendStatus> => {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok ? 'connected' : 'demo';
  } catch {
    return 'demo';
  }
};

/**
 * Sends inference parameters to the backend.
 * If backend is unreachable, falls back to deterministic demo calculations.
 */
export const runInference = async (data: InferenceData): Promise<{ models: ModelResult[]; isDemo: boolean }> => {
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distance_km: Number(data.distance),
        carrier: data.carrier,
        traffic_level: data.trafficLevel,
        package_weight_kg: Number(data.weight),
        warehouse_backlog: Number(data.warehouseLoad),
        hour: Number(data.hour),
        day_of_week: data.day,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error('Backend returned non-OK');

    const payload = await res.json();
    if (!payload.models || !Array.isArray(payload.models)) throw new Error('Invalid shape');

    return { models: payload.models, isDemo: false };
  } catch {
    // Backend unreachable — generate deterministic demo data from inputs
    return { models: generateDemoResults(data), isDemo: true };
  }
};

/* ===================================================================
   DEMO FALLBACK
   
   Generates realistic-looking results derived from the user's inputs.
   Uses deterministic formulas — NOT random — so the same inputs always
   produce the same outputs. This lets the dashboard be fully functional
   for presentations even without a running Colab backend.
   =================================================================== */

function generateDemoResults(data: InferenceData): ModelResult[] {
  const dist = Number(data.distance) || 100;
  const weight = Number(data.weight) || 10;
  const load = Number(data.warehouseLoad) || 50;
  const hour = Number(data.hour) || 12;
  const trafficMul = data.trafficLevel === 'High' ? 1.4 : data.trafficLevel === 'Moderate' ? 1.0 : 0.7;

  // Base delay derived from inputs (deterministic, not random)
  const baseDelay = (dist / 80) + (weight / 50) + (load / 60) + (hour > 16 ? 1.5 : 0) * trafficMul;

  // Each model adds a characteristic offset (simulating real model variance)
  const modelConfigs = [
    { id: 'lr', name: 'Linear Regression',    rmse: 2.41, mae: 1.87, r2: 0.78, delayOffset: 0.6,  scatter: 2.0  },
    { id: 'rr', name: 'Ridge Regression',     rmse: 2.33, mae: 1.79, r2: 0.80, delayOffset: 0.45, scatter: 1.8  },
    { id: 'rf', name: 'Random Forest',        rmse: 1.62, mae: 1.18, r2: 0.91, delayOffset: -0.1, scatter: 0.9  },
    { id: 'gb', name: 'Gradient Boosting',    rmse: 1.38, mae: 0.98, r2: 0.94, delayOffset: 0.0,  scatter: 0.7  },
  ];

  return modelConfigs.map(cfg => {
    const predictedDelay = Math.max(0.5, baseDelay + cfg.delayOffset);

    // Generate deterministic plot points using a seeded sequence
    const plotData: PlotPoint[] = [];
    for (let i = 0; i < 80; i++) {
      // Deterministic pseudo-random using sine
      const seed = Math.sin(i * 12.9898 + dist * 0.01 + weight * 0.03) * 43758.5453;
      const noise = (seed - Math.floor(seed)) * 2 - 1; // range [-1, 1]
      const actual = baseDelay + noise * 4;
      const predicted = actual + (Math.sin(i * 7.31 + cfg.scatter) * cfg.scatter);
      plotData.push({
        actual: Math.round(actual * 100) / 100,
        predicted: Math.round(predicted * 100) / 100,
        residual: Math.round((actual - predicted) * 100) / 100,
      });
    }

    return { ...cfg, predictedDelay: Math.round(predictedDelay * 10) / 10, plotData, isDemo: true };
  });
}

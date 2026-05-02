"use client";

import React, { useState, useRef, useEffect } from 'react';
import { InferenceForm, InferenceData } from '../components/InferenceForm';
import { ModelComparisonTable } from '../components/ModelComparisonTable';
import { RegressionVisualization } from '../components/RegressionVisualization';
import { MathExplanation } from '../components/MathExplanation';
import { ModelAnalytics } from '../components/ModelAnalytics';
import { runInference, checkBackendHealth, ModelResult, BackendStatus } from './dataService';
import { generateReport } from '../lib/reportGenerator';

export default function Dashboard() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<ModelResult[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkBackendHealth().then(setBackendStatus);
  }, []);

  const handleEstimate = async (data: InferenceData) => {
    setIsLoading(true);
    setError(null);
    setAiSummary(null);
    try {
      const result = await runInference(data);
      setModels(result.models);
      setIsDemo(result.isDemo);
      setBackendStatus(result.isDemo ? 'demo' : 'connected');
      // Auto-select best model (lowest RMSE)
      if (result.models.length > 0) {
        const best = result.models.reduce((a, b) => a.rmse < b.rmse ? a : b);
        setActiveModelId(best.id);
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingPdf(true);
    try {
      const active = models.find(m => m.id === activeModelId);
      if (!active) return;

      // 1. Get Gemini summary
      let summary = '';
      try {
        const response = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeModel: active, allModels: models }),
        });
        const aiData = await response.json();
        summary = aiData.summary || aiData.error || 'Summary unavailable.';
      } catch {
        summary = 'AI summary unavailable — Gemini API did not respond.';
      }
      setAiSummary(summary);

      // 2. Wait for charts to render, then collect chart DOM elements
      await new Promise(resolve => setTimeout(resolve, 400));
      const chartEls = Array.from(document.querySelectorAll('.chart-wrapper')) as HTMLElement[];

      // 3. Generate structured PDF
      await generateReport(active, models, summary, chartEls);
    } catch (err: any) {
      console.error('Report error:', err);
      setAiSummary('[Report generation error. Charts and metrics are still valid.]');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const activeModel = models.find(m => m.id === activeModelId);

  return (
    <div className="page-container">

      {/* ===== STORY / LANDING ===== */}
      <section className="story-section">
        <div className="story-header">
          <h1>Supply Chain Delay Prediction</h1>
          <div className="subtitle">Supervised Regression Analysis — 4 Model Comparison</div>
        </div>

        <div className="story-grid">
          <div className="story-card">
            <img src="/story-warehouse.png" alt="Warehouse distribution center at night" />
            <div className="story-card-body">
              <div className="step-label">01 — The Problem</div>
              <h3>Operational Complexity</h3>
              <p>
                Every shipment passes through warehouses operating at variable capacity.
                High backlog means slower processing, missed windows, and compounding delays
                downstream.
              </p>
            </div>
          </div>

          <div className="story-card">
            <img src="/story-traffic.png" alt="Highway congestion with delivery trucks" />
            <div className="story-card-body">
              <div className="step-label">02 — The Variables</div>
              <h3>Route &amp; Traffic Conditions</h3>
              <p>
                Distance, carrier selection, time of day, and traffic severity
                are measurable factors that repeat across routes. Delays are systemic,
                not random.
              </p>
            </div>
          </div>

          <div className="story-card">
            <img src="/story-data.png" alt="Regression scatter plot analysis" />
            <div className="story-card-body">
              <div className="step-label">03 — The Approach</div>
              <h3>Structured Regression</h3>
              <p>
                We apply four classical regression models to this structured data.
                Every prediction is backed by equations you can verify —
                no black boxes, no hype.
              </p>
            </div>
          </div>
        </div>

        <p className="story-summary">
          This system estimates delivery delay in hours using <strong>supervised regression</strong> on
          structured shipment data — comparing Linear, Ridge, Random Forest, and Gradient Boosting
          models. Scroll down to run predictions against the trained models.
        </p>

        <div className="status-row">
          <span className={`status-dot ${backendStatus}`}></span>
          <span>
            {backendStatus === 'connected' && 'Backend connected — live model server'}
            {backendStatus === 'demo' && 'Demo mode — connect Colab backend for live predictions'}
            {backendStatus === 'error' && 'Backend unreachable — using demo fallback'}
            {backendStatus === 'idle' && 'Checking backend connection...'}
          </span>
        </div>
      </section>

      {/* ===== DASHBOARD ===== */}
      <div ref={reportRef} style={{ backgroundColor: '#0F1115', padding: '0.5rem' }}>

        {/* Demo Mode Banner */}
        {isDemo && models.length > 0 && (
          <div className="demo-banner">
            Demo mode — predictions are derived from input parameters using deterministic formulas.
            Connect your Colab FastAPI backend for real sklearn model results.
          </div>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <div className="ai-summary">
            <h3>Executive Summary — gemini-2.5-flash</h3>
            <p>{aiSummary}</p>
          </div>
        )}

        <div className="dashboard-grid">

          {/* LEFT: Input Form */}
          <div className="card">
            <h2 className="card-title">Inference Parameters</h2>
            <p className="card-desc">
              Enter shipment details below. These features match the columns used to train
              the regression models in the Colab notebook — distance, carrier, traffic level,
              package weight, warehouse load, and time.
            </p>
            <InferenceForm onEstimate={handleEstimate} isLoading={isLoading} />
          </div>

          {/* CENTER: Output + Charts + Math */}
          <div className="section-gap">

            {/* Output */}
            <div className="output-card">
              <div className="output-label">Predicted Delay</div>
              <div className="output-value">
                {activeModel ? `${activeModel.predictedDelay.toFixed(1)} hours` : '—'}
              </div>
              {!activeModel && (
                <p className="card-desc" style={{ marginTop: '0.75rem' }}>
                  Fill in the form on the left and click &quot;Estimate Delay&quot; to see a prediction
                  from all 4 trained regression models.
                </p>
              )}
              {activeModel && (
                <div style={{ marginTop: '1rem' }}>
                  <p className="card-desc" style={{ marginBottom: '0.75rem' }}>
                    This value comes from the <strong>{activeModel.name}</strong> model.
                    Click different models in the comparison table (right) to switch.
                  </p>
                  <button
                    className="btn-primary"
                    onClick={handleGenerateReport}
                    disabled={isGeneratingPdf}
                    style={{ maxWidth: '300px', margin: '0 auto' }}
                  >
                    {isGeneratingPdf ? 'Generating PDF + AI Summary...' : 'Generate Report (PDF)'}
                  </button>
                  <p className="card-desc" style={{ marginTop: '0.5rem', fontSize: '0.6875rem' }}>
                    Exports a PDF containing all charts, metrics, and an AI-generated executive summary
                    powered by Gemini 2.5 Flash.
                  </p>
                </div>
              )}
            </div>

            {/* 4 Regression Charts */}
            {activeModel && activeModel.plotData?.length > 0 && (
              <div className="card">
                <h2 className="card-title">Regression Diagnostics — {activeModel.name}</h2>
                <p className="card-desc">
                  Four standard diagnostic plots for evaluating regression model performance.
                  These are generated from the test set predictions — the data the model was NOT trained on.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                  <div>
                    <div className="chart-label">Actual vs Predicted</div>
                    <p className="chart-desc">Points should cluster along the diagonal (y=x). Deviations indicate prediction error.</p>
                    <div className="chart-wrapper">
                      <RegressionVisualization data={activeModel.plotData} type="scatter" />
                    </div>
                  </div>
                  <div>
                    <div className="chart-label">Residual Plot</div>
                    <p className="chart-desc">Residuals should scatter randomly around zero. Patterns suggest the model is missing structure.</p>
                    <div className="chart-wrapper">
                      <RegressionVisualization data={activeModel.plotData} type="residual" />
                    </div>
                  </div>
                  <div>
                    <div className="chart-label">Error Distribution</div>
                    <p className="chart-desc">A bell-shaped distribution centered at zero indicates well-behaved, unbiased errors.</p>
                    <div className="chart-wrapper">
                      <RegressionVisualization data={activeModel.plotData} type="error-dist" />
                    </div>
                  </div>
                  <div>
                    <div className="chart-label">Q-Q Plot (Normality Check)</div>
                    <p className="chart-desc">Points following the diagonal confirm residuals are approximately normally distributed.</p>
                    <div className="chart-wrapper">
                      <RegressionVisualization data={activeModel.plotData} type="qq" />
                    </div>
                  </div>
                </div>

                <MathExplanation modelName={activeModel.name} />
              </div>
            )}

            {error && <div className="error-box">{error}</div>}
          </div>

          {/* RIGHT: Comparison */}
          <div className="card">
            <h2 className="card-title">Model Comparison</h2>
            <p className="card-desc">
              All 4 regression models run on the same input. Click a row to switch
              the active model — the charts and prediction will update immediately.
              The best model (lowest RMSE) is marked with ✓.
            </p>
            <ModelComparisonTable
              models={models}
              activeModelId={activeModelId}
              onSelectModel={setActiveModelId}
            />
          </div>

        </div>

        {/* ===== 6 ADVANCED MODEL ANALYTICS ===== */}
        {models.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>Advanced Model Analytics</h2>
            <p className="card-desc">Six comparative visualizations across all 4 regression models — error metrics, variance explained, radar analysis, error percentiles, cumulative accuracy, and composite ranking.</p>
            <ModelAnalytics models={models} activeModelId={activeModelId} />
          </div>
        )}

      </div>
    </div>
  );
}

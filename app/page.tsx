"use client";

import React, { useState, useEffect } from 'react';
import { InferenceForm, InferenceData } from '../components/InferenceForm';
import { ModelComparisonTable } from '../components/ModelComparisonTable';
import { RegressionVisualization } from '../components/RegressionVisualization';
import { MathExplanation } from '../components/MathExplanation';
import { ModelAnalytics } from '../components/ModelAnalytics';
import { MathsBehind } from '../components/MathsBehind';
import { WhatIfAnalysis } from '../components/WhatIfAnalysis';
import { NotebookUploader } from '../components/NotebookUploader';
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
  const [showMaths, setShowMaths] = useState(false);
  const [currentInput, setCurrentInput] = useState<InferenceData | null>(null);
  const [dataSource, setDataSource] = useState<'none' | 'notebook' | 'sample' | 'api'>('none');



  useEffect(() => {
    checkBackendHealth().then(setBackendStatus);
  }, []);

  const handleEstimate = async (data: InferenceData) => {
    setIsLoading(true);
    setError(null);
    setCurrentInput(data);
    setAiSummary(null);
    try {
      const result = await runInference(data);
      setModels(result.models);
      setIsDemo(result.isDemo);
      setDataSource('api');
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

      // 2. Generate structured PDF (text-native, no html2canvas)
      await generateReport(active, models, summary);
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
          <div className="subtitle">Supervised Regression Analysis{models.length > 0 ? ` — ${models.length} Model Comparison` : ''}</div>
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
          structured shipment data. Upload your Colab notebook or use the sample data to explore
          model comparison, diagnostics, and mathematical foundations.
        </p>

        <div className="status-row">
          <span className={`status-dot ${backendStatus}`}></span>
          <span>
            {backendStatus === 'connected' && 'Backend connected — live model server'}
            {backendStatus === 'demo' && 'Demo mode — connect Colab backend or upload a notebook'}
            {backendStatus === 'error' && 'Backend unreachable — upload a notebook or use demo'}
            {backendStatus === 'idle' && 'Checking backend connection...'}
          </span>
        </div>

        <NotebookUploader onModelsLoaded={(loaded, source) => {
          setModels(loaded);
          setDataSource(source);
          setIsDemo(source === 'sample');
          setBackendStatus(source === 'notebook' ? 'connected' : 'demo');
          setAiSummary(null);
          if (loaded.length > 0) {
            const best = loaded.reduce((a, b) => a.rmse < b.rmse ? a : b);
            setActiveModelId(best.id);
          }
        }} />
      </section>

      {/* ===== DASHBOARD ===== */}
      <div style={{ backgroundColor: '#0F1115', padding: '0.5rem' }}>

        {/* Data Source Banner */}
        {models.length > 0 && dataSource === 'sample' && (
          <div className="demo-banner">
            Showing pre-trained sample results (4 models from our supply chain dataset).
            Upload your own .ipynb notebook above to replace with your real model results.
          </div>
        )}
        {models.length > 0 && dataSource === 'notebook' && (
          <div className="demo-banner" style={{ color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)' }}>
            Showing results from your uploaded notebook — {models.length} model(s): {models.map(m => m.name).join(', ')}
          </div>
        )}
        {isDemo && models.length > 0 && dataSource === 'api' && (
          <div className="demo-banner">
            Demo mode — predictions derived from input parameters. Connect your Colab backend for real results.
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
                  from the trained regression models.
                </p>
              )}
              {activeModel && (
                <div style={{ marginTop: '1rem' }}>
                  <p className="card-desc" style={{ marginBottom: '0.75rem' }}>
                    This value comes from the <strong>{activeModel.name}</strong> model.
                    Click different models in the comparison table (right) to switch.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn-primary"
                      onClick={handleGenerateReport}
                      disabled={isGeneratingPdf}
                      style={{ maxWidth: '220px', flex: '1' }}
                    >
                      {isGeneratingPdf ? 'Generating...' : 'Generate Report (PDF)'}
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => setShowMaths(true)}
                      style={{ flex: '1', maxWidth: '220px' }}
                    >
                      Show Maths Behind
                    </button>
                  </div>
                  <p className="card-desc" style={{ marginTop: '0.5rem', fontSize: '0.6875rem' }}>
                    <strong>PDF:</strong> Downloads a structured report with metrics, AI summary, and math foundations.&nbsp;
                    <strong>Maths:</strong> Opens a detailed breakdown of how the prediction was computed.
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
              All {models.length} regression models run on the same input. Click a row to switch
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
            <p className="card-desc">{models.length > 1 ? `${models.length} comparative` : 'Diagnostic'} visualizations across all loaded regression models — error metrics, variance explained, radar analysis, error percentiles, cumulative accuracy, and composite ranking.</p>
            <ModelAnalytics models={models} activeModelId={activeModelId} />
          </div>
        )}

        {/* ===== WHAT-IF ANALYSIS ===== */}
        {activeModel && (
          <WhatIfAnalysis model={activeModel} currentDelay={activeModel.predictedDelay} />
        )}

      </div>

      {/* ===== MATHS BEHIND MODAL (renders outside the report area) ===== */}
      {activeModel && currentInput && (
        <MathsBehind
          model={activeModel}
          inputData={currentInput}
          isOpen={showMaths}
          onClose={() => setShowMaths(false)}
        />
      )}
    </div>
  );
}

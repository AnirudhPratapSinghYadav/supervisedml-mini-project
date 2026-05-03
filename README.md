# Supply Chain Delay Prediction

A supervised regression system for predicting logistics delivery delays using structured operational data.

## What This Does

Takes real shipment parameters (distance, carrier, traffic, warehouse load, time) and predicts delivery delay in hours using **4 regression models** trained on historical data:

- **Linear Regression** — OLS baseline
- **Ridge Regression** — L2 regularized for stability
- **Random Forest** — Ensemble of 100 decision trees
- **Gradient Boosting** — Sequential error-correcting ensemble

## Features

- **Visual Storytelling Landing** — 3-card narrative explaining the problem before the dashboard
- **Live Inference** — Submit parameters, get predictions from all 4 models simultaneously
- **10 Analytical Charts** — 4 regression diagnostics + 6 model comparison visualizations
- **Show Maths Behind** — Full-screen modal with step-by-step computation, feature impact bars, error analysis, and deep theory
- **What-If Analysis** — Interactive slider to see how changing one variable affects delay
- **PDF Report** — Structured 3-page PDF with AI executive summary (Gemini 2.5 Flash), model comparison table, and mathematical foundations
- **Demo Mode** — Works without a backend for presentations (deterministic fallback)

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

- `GEMINI_API_KEY` — For AI executive summary in PDF reports
- `NEXT_PUBLIC_API_URL` — Your Colab FastAPI backend URL (optional, demo mode works without it)

## Connecting to Google Colab Backend

1. Open `colab_save_artifacts.py` in your Colab notebook to train and export model artifacts
2. Run `colab_fastapi_backend.py` in Colab to start the FastAPI server
3. Use ngrok/localtunnel to expose the Colab server, set the URL in `.env.local`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Next.js 16 (App Router) |
| Charts | Recharts |
| PDF | jsPDF (text-native, no screenshots) |
| AI Summary | Google Gemini 2.5 Flash |
| Backend | FastAPI + scikit-learn (runs in Colab) |
| Styling | Vanilla CSS with design tokens |

## Project Structure

```
app/
  page.tsx              # Main dashboard
  dataService.ts        # Backend communication + demo fallback
  globals.css           # Design system (tokens, layout, components)
  api/generate-report/  # Gemini AI summary endpoint
components/
  InferenceForm.tsx     # Input form
  ModelComparisonTable  # Metrics table
  RegressionVisualization # 4 diagnostic charts
  ModelAnalytics.tsx    # 6 comparison charts
  MathsBehind.tsx       # Full-screen math modal
  MathExplanation.tsx   # Inline math panel
  WhatIfAnalysis.tsx    # Sensitivity slider
lib/
  reportGenerator.ts    # PDF builder
public/
  story-*.png           # Landing page images
```

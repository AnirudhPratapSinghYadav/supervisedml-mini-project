"""
Supply Chain Delay Prediction — FastAPI Backend
================================================
Copy this file into your Google Colab notebook and run it.

Prerequisites (run in Colab):
    !pip install fastapi uvicorn pyngrok joblib scikit-learn pandas numpy

Usage:
    1. Train your models in Colab and save the pipelines:
       joblib.dump(trained_pipelines, "trained_pipelines.pkl")
       joblib.dump((X_test_array, y_test_array, predictions_dict), "test_results.pkl")
    
    2. Run this script in a Colab cell:
       !python colab_fastapi_backend.py
    
    Or import and run directly in a cell (see bottom of file).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import os
import json

app = FastAPI(title="Supply Chain Delay Prediction API")

# Allow all origins for development (Colab + ngrok)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# LOAD ARTIFACTS
# These files must exist in your Colab working directory.
# ============================================================

PIPELINES: Dict = {}
TEST_RESULTS: Optional[dict] = None

MODEL_ID_MAP = {
    "Linear Regression": "lr",
    "Ridge Regression": "rr",
    "Random Forest": "rf",
    "Gradient Boosting": "gb",
}

def load_artifacts():
    """Load trained pipelines and test results from disk."""
    global PIPELINES, TEST_RESULTS
    
    if os.path.exists("trained_pipelines.pkl"):
        PIPELINES = joblib.load("trained_pipelines.pkl")
        print(f"Loaded {len(PIPELINES)} model pipelines: {list(PIPELINES.keys())}")
    else:
        print("WARNING: trained_pipelines.pkl not found. Train models first.")
    
    if os.path.exists("test_results.pkl"):
        TEST_RESULTS = joblib.load("test_results.pkl")
        print("Loaded test results for chart data.")
    else:
        print("WARNING: test_results.pkl not found. Charts will be empty.")

load_artifacts()


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class PredictionRequest(BaseModel):
    distance_km: float
    carrier: str
    traffic_level: str
    package_weight_kg: float
    warehouse_backlog: float
    hour: int
    day_of_week: str  # "0" through "6" (Monday=0)


# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": len(PIPELINES),
        "model_names": list(PIPELINES.keys()),
    }


@app.post("/predict")
def predict(req: PredictionRequest):
    """
    Run inference through ALL loaded pipelines.
    Returns predictions + metrics + plot data for the frontend.
    """
    if not PIPELINES:
        return {"error": "No models loaded. Run training first."}
    
    # Build input DataFrame matching training schema
    input_data = pd.DataFrame([{
        "distance_km": req.distance_km,
        "carrier": req.carrier,
        "traffic_level": req.traffic_level,
        "package_weight_kg": req.package_weight_kg,
        "warehouse_backlog": req.warehouse_backlog,
        "hour": req.hour,
        "day_of_week": int(req.day_of_week),
    }])
    
    models_response = []
    
    for name, pipeline in PIPELINES.items():
        model_id = MODEL_ID_MAP.get(name, name.lower().replace(" ", "_"))
        
        # Predict
        try:
            pred = float(pipeline.predict(input_data)[0])
        except Exception as e:
            pred = -1.0
            print(f"Prediction error for {name}: {e}")
        
        # Compute metrics from test results if available
        rmse, mae, r2 = 0.0, 0.0, 0.0
        plot_data = []
        
        if TEST_RESULTS:
            y_test = np.array(TEST_RESULTS.get("y_test", []))
            preds_dict = TEST_RESULTS.get("predictions", {})
            y_pred = np.array(preds_dict.get(name, []))
            
            if len(y_test) > 0 and len(y_pred) > 0:
                from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
                rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
                mae = float(mean_absolute_error(y_test, y_pred))
                r2 = float(r2_score(y_test, y_pred))
                
                # Sample plot data (max 200 points for performance)
                indices = np.random.choice(len(y_test), min(200, len(y_test)), replace=False)
                indices.sort()
                for i in indices:
                    plot_data.append({
                        "actual": float(y_test[i]),
                        "predicted": float(y_pred[i]),
                        "residual": float(y_test[i] - y_pred[i]),
                    })
        
        models_response.append({
            "id": model_id,
            "name": name,
            "rmse": rmse,
            "mae": mae,
            "r2": r2,
            "predictedDelay": pred,
            "plotData": plot_data,
        })
    
    return {"models": models_response}


# ============================================================
# RUN SERVER (for Colab)
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    # If running in Colab, use pyngrok to expose the server
    try:
        from pyngrok import ngrok
        public_url = ngrok.connect(8000)
        print(f"\n{'='*60}")
        print(f"PUBLIC URL: {public_url}")
        print(f"Set this as NEXT_PUBLIC_API_URL in your .env.local")
        print(f"{'='*60}\n")
    except ImportError:
        print("pyngrok not installed. Server will only be accessible locally.")
        print("Install with: pip install pyngrok")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Supply Chain Delay — Model Training & Artifact Export
=====================================================
Paste this into your Google Colab notebook AFTER your training loop.

This script saves your trained pipelines and test results in the exact
format that colab_fastapi_backend.py expects.

Prerequisites:
    - You must have `trained_pipelines` dict: { "Model Name": sklearn_pipeline, ... }
    - You must have `X_test`, `y_test` from your train/test split
"""

import joblib
import numpy as np

# ============================================================
# STEP 1: Save all trained pipelines
# ============================================================
# Your training loop should produce something like:
#
# trained_pipelines = {}
# for name, model in models.items():
#     pipe = Pipeline([('preprocessor', preprocessor), ('model', model)])
#     pipe.fit(X_train, y_train)
#     trained_pipelines[name] = pipe

joblib.dump(trained_pipelines, "trained_pipelines.pkl")
print(f"Saved {len(trained_pipelines)} pipelines to trained_pipelines.pkl")


# ============================================================
# STEP 2: Save test results (predictions from each model)
# ============================================================
predictions = {}
for name, pipe in trained_pipelines.items():
    preds = pipe.predict(X_test)
    predictions[name] = preds.tolist()

test_results = {
    "y_test": np.array(y_test).tolist(),
    "predictions": predictions,
}

joblib.dump(test_results, "test_results.pkl")
print(f"Saved test results with {len(predictions)} model predictions")
print(f"Test set size: {len(y_test)} samples")


# ============================================================
# STEP 3: Verify
# ============================================================
print("\n--- Verification ---")
loaded_pipes = joblib.load("trained_pipelines.pkl")
loaded_results = joblib.load("test_results.pkl")
print(f"Pipelines: {list(loaded_pipes.keys())}")
print(f"Test samples: {len(loaded_results['y_test'])}")
print(f"Predictions available for: {list(loaded_results['predictions'].keys())}")
print("\nAll artifacts saved. You can now run colab_fastapi_backend.py")

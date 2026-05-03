# Supply Chain Delay Prediction Platform

A production-grade logistics control tower built to visualize, compare, and interrogate supervised regression models. This platform allows stakeholders to upload trained model outputs (via Jupyter/Colab notebooks) and translates raw metrics into transparent, actionable business intelligence.

## 🚀 Key Features

*   **Strict Notebook Parsing (.ipynb):** The platform features a robust client-side parser that extracts model names, evaluation metrics (RMSE, MAE, R²), residual plot data, feature importances, and linear coefficients directly from the text/JSON outputs of your uploaded Colab notebook. 
*   **Zero Hardcoded Data:** The dashboard enforces strict data integrity. If a notebook is uploaded, *only* the data found in that notebook is displayed. If a notebook lacks the required data, it safely falls back to a complete, pre-trained default dataset.
*   **Mathematical Transparency:** The "Maths Behind" modal breaks down the exact math used to generate a prediction. It shows the step-by-step computation, visualizes feature impact (derived from actual model weights), analyzes residuals, and provides the mathematical theory (equations, loss functions) for the active model.
*   **Interactive What-If Analysis:** Sensitivity sliders allow users to adjust individual variables (e.g., Distance, Package Weight) while keeping others constant. The resulting delay curves scale proportionally to the model's actual error profile (RMSE/MAE).
*   **PDF Report Generation:** Click a button to generate a structured, text-native PDF report containing core metrics, regression charts, and an AI-generated executive summary powered by Gemini 2.5 Flash.

## 💻 Tech Stack

*   **Frontend:** Next.js 16 (App Router), React 19
*   **Data Visualization:** Recharts
*   **Styling:** Vanilla CSS (OLED Black aesthetic, responsive design)
*   **PDF Generation:** jsPDF (Text-native rendering)
*   **AI Integration:** Gemini 2.5 Flash API

## 🛠️ Setup & Installation

### 1. Local Deployment
Clone the repository and install the dependencies:
```bash
git clone https://github.com/AnirudhPratapSinghYadav/supervisedml-mini-project.git
cd supervisedml-mini-project
npm install
npm run dev
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```env
# Required for AI Executive Summaries
GEMINI_API_KEY=your_gemini_api_key_here

# Required ONLY if connecting to a live Colab inference backend
NEXT_PUBLIC_API_URL=https://your-ngrok-url.ngrok.app
```

## 📓 Connecting a Live Colab Backend (Optional)

You can run your models live in Google Colab and connect them to this dashboard using FastAPI and ngrok.

1.  Train your models in Colab.
2.  Add the following code to the bottom of your notebook to start a server:

```python
!pip install fastapi uvicorn pyngrok nest-asyncio

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pyngrok import ngrok
import nest_asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InferenceData(BaseModel):
    distance_km: float
    carrier: str
    traffic_level: str
    package_weight_kg: float
    warehouse_backlog: float
    hour: int
    day_of_week: str

@app.post("/predict")
def predict(data: InferenceData):
    # Pass data into your trained sklearn models here
    # Return an array of ModelResult objects
    pass

ngrok.set_auth_token("YOUR_NGROK_AUTH_TOKEN")
public_url = ngrok.connect(8000).public_url
print(f"YOUR NGROK URL IS: {public_url}")

nest_asyncio.apply()
uvicorn.run(app, host="127.0.0.1", port=8000)
```
3.  Copy the generated ngrok URL and add it to your Vercel Environment Variables or local `.env.local` file as `NEXT_PUBLIC_API_URL`.

## 📦 Uploading Notebooks

To visualize your own data without connecting a live backend, you can upload your `.ipynb` file directly via the dashboard UI. 

**Requirements for parsing:**
Your notebook must print evaluation metrics in the cell outputs. For example:
```python
print("Linear Regression: RMSE=2.41, MAE=1.87, R²=0.78")
```
For maximum functionality (Feature Impact bars, exact sensitivity curves), also print your `model.coef_` or `model.feature_importances_`.

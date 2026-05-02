import jsPDF from 'jspdf';
import { ModelResult } from '../app/dataService';

/* ===================================================================
   PDF REPORT GENERATOR — v2 (Text-native, no html2canvas)
   
   Builds a clean, structured, shareable PDF using only jsPDF text
   rendering. No DOM screenshots — works reliably every time.
   
   Contents:
     Page 1: Title, prediction, AI summary, model comparison table
     Page 2: Mathematical foundations + interpretation
     Page 3: Methodology notes
   =================================================================== */

const C = {
  bg:    [15, 17, 21]       as [number, number, number],
  surf:  [26, 29, 35]       as [number, number, number],
  bdr:   [42, 47, 56]       as [number, number, number],
  txt:   [230, 230, 230]    as [number, number, number],
  muted: [156, 163, 175]    as [number, number, number],
  acc:   [76, 110, 245]     as [number, number, number],
  green: [34, 197, 94]      as [number, number, number],
  amber: [245, 158, 11]     as [number, number, number],
};

const PW = 210;
const PH = 297;
const M = 18;
const CW = PW - M * 2;

function bg(pdf: jsPDF) {
  pdf.setFillColor(...C.bg);
  pdf.rect(0, 0, PW, PH, 'F');
}

function line(pdf: jsPDF, y: number) {
  pdf.setDrawColor(...C.bdr);
  pdf.setLineWidth(0.3);
  pdf.line(M, y, PW - M, y);
}

function space(pdf: jsPDF, y: number, need: number): number {
  if (y + need > PH - 15) { pdf.addPage(); bg(pdf); return M + 5; }
  return y;
}

function heading(pdf: jsPDF, y: number, text: string): number {
  y = space(pdf, y, 10);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.acc);
  pdf.text(text.toUpperCase(), M, y);
  return y + 5;
}

function body(pdf: jsPDF, y: number, text: string, maxW = CW): number {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...C.txt);
  const lines = pdf.splitTextToSize(text, maxW);
  for (const ln of lines) {
    y = space(pdf, y, 5);
    pdf.text(ln, M, y);
    y += 4.2;
  }
  return y;
}

function label(pdf: jsPDF, y: number, text: string): number {
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...C.acc);
  pdf.text(text.toUpperCase(), M, y);
  return y + 4;
}

export async function generateReport(
  activeModel: ModelResult,
  allModels: ModelResult[],
  aiSummary: string,
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = M;
  bg(pdf);

  // ============ PAGE 1: TITLE + RESULTS ============

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(...C.txt);
  pdf.text('Supply Chain Delay Prediction', M, y + 8);
  y += 14;

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...C.muted);
  pdf.text('Supervised Regression Analysis Report', M, y);
  y += 4;
  pdf.text(`Generated: ${new Date().toLocaleString()}`, M, y);
  y += 8;
  line(pdf, y); y += 10;

  // Prediction box
  pdf.setFillColor(...C.surf);
  pdf.roundedRect(M, y, CW, 24, 2, 2, 'F');
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...C.muted);
  pdf.text('PREDICTED DELAY', M + CW / 2, y + 7, { align: 'center' });
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...C.txt);
  pdf.text(`${activeModel.predictedDelay.toFixed(1)} hours`, M + CW / 2, y + 19, { align: 'center' });
  y += 32;

  pdf.setFontSize(8);
  pdf.setFont('courier', 'normal');
  pdf.setTextColor(...C.muted);
  pdf.text(`Model: ${activeModel.name}  |  RMSE: ${activeModel.rmse.toFixed(3)}  |  MAE: ${activeModel.mae.toFixed(3)}  |  R\u00B2: ${activeModel.r2.toFixed(3)}`, M, y);
  y += 8;

  // AI Summary
  if (aiSummary) {
    y = heading(pdf, y, 'Executive Summary \u2014 Gemini 2.5 Flash');
    y = body(pdf, y, aiSummary);
    y += 4;
    line(pdf, y); y += 8;
  }

  // Model Comparison Table
  y = heading(pdf, y, 'Model Comparison');

  const cols = [M, M + 58, M + 90, M + 115, M + 140];
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...C.muted);
  ['MODEL', 'RMSE', 'MAE', 'R\u00B2', 'DELAY (h)'].forEach((h, i) => pdf.text(h, cols[i], y));
  y += 2; line(pdf, y); y += 5;

  const best = allModels.reduce((a, b) => a.rmse < b.rmse ? a : b);
  for (const m of allModels) {
    y = space(pdf, y, 6);
    const isBest = m.id === best.id;
    const isActive = m.id === activeModel.id;

    if (isActive) {
      pdf.setFillColor(76, 110, 245);
      pdf.rect(M - 1, y - 3.5, CW + 2, 5.5, 'F');
      pdf.setTextColor(255, 255, 255);
    } else {
      pdf.setTextColor(...C.txt);
    }

    pdf.setFont('courier', isBest ? 'bold' : 'normal');
    pdf.setFontSize(8);
    pdf.text(m.name + (isBest ? ' \u2713' : ''), cols[0], y);
    pdf.text(m.rmse.toFixed(3), cols[1], y);
    pdf.text(m.mae.toFixed(3), cols[2], y);
    pdf.text(m.r2.toFixed(3), cols[3], y);
    pdf.text(m.predictedDelay.toFixed(1), cols[4], y);
    y += 6;
  }
  y += 5; line(pdf, y); y += 8;

  // What the metrics mean
  y = heading(pdf, y, 'Understanding the Metrics');
  y = body(pdf, y, 'RMSE (Root Mean Squared Error): Average prediction error in hours. Lower means more accurate. Penalizes large errors heavily.');
  y = body(pdf, y, 'MAE (Mean Absolute Error): Average absolute difference between predicted and actual delay. Easier to interpret \u2014 \"on average, the model is off by X hours.\"');
  y = body(pdf, y, 'R\u00B2 (R-Squared): Proportion of variance explained. R\u00B2=1.0 means perfect predictions. R\u00B2=0.94 means the model captures 94% of the patterns in the data.');

  // ============ PAGE 2: MATHEMATICAL FOUNDATIONS ============
  pdf.addPage(); bg(pdf); y = M;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...C.txt);
  pdf.text('Mathematical Foundations', M, y + 5);
  y += 12;
  line(pdf, y); y += 8;

  const mathModels = getMathData();
  for (const md of mathModels) {
    y = space(pdf, y, 45);

    // Model name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...C.txt);
    pdf.text(md.title, M, y);
    y += 6;

    y = label(pdf, y, 'Equation');
    y = body(pdf, y, md.equation);
    y += 1;

    y = label(pdf, y, 'Loss Function');
    y = body(pdf, y, md.loss);
    y += 1;

    y = label(pdf, y, 'How It Works');
    y = body(pdf, y, md.howItWorks);
    y += 1;

    y = label(pdf, y, 'Strengths & Weaknesses');
    y = body(pdf, y, md.strengths);
    y += 4;

    line(pdf, y); y += 6;
  }

  // ============ PAGE 3: METHODOLOGY ============
  pdf.addPage(); bg(pdf); y = M;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...C.txt);
  pdf.text('Methodology & Data Pipeline', M, y + 5);
  y += 12;
  line(pdf, y); y += 8;

  y = heading(pdf, y, 'Data Preprocessing');
  y = body(pdf, y, '1. Categorical features (carrier, traffic level) are one-hot encoded using sklearn OneHotEncoder.');
  y = body(pdf, y, '2. Numerical features (distance, weight, warehouse load) are standardized using StandardScaler.');
  y = body(pdf, y, '3. Time features (hour, day of week) are extracted from timestamps and treated as numerical.');
  y = body(pdf, y, '4. Train/test split: 80/20 with random_state=42 for reproducibility.');
  y += 4;

  y = heading(pdf, y, 'Model Training');
  y = body(pdf, y, 'All four models are wrapped in sklearn Pipeline objects that apply preprocessing and model fitting in a single step. This prevents data leakage between train and test sets.');
  y += 4;

  y = heading(pdf, y, 'Evaluation Strategy');
  y = body(pdf, y, 'Models are evaluated on the held-out test set (20% of data). Three metrics are computed: RMSE (penalizes large errors), MAE (interpretable average error), and R\u00B2 (variance explained). The model with the lowest RMSE is automatically selected as the best performer.');
  y += 4;

  y = heading(pdf, y, 'Prediction');
  y = body(pdf, y, 'For a new input, the same preprocessing pipeline transforms the features, then the trained model outputs a continuous value representing estimated delay in hours. All four models run inference on every input for comparison.');
  y += 6;

  // Footer
  line(pdf, y); y += 4;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(...C.muted);
  pdf.text('Supply Chain Delay Prediction \u2014 Supervised Regression Analysis', M, y);
  pdf.text(new Date().toISOString(), PW - M, y, { align: 'right' });

  // SAVE
  pdf.save('Logistics_Delay_Report.pdf');
}

function getMathData() {
  return [
    {
      title: 'Linear Regression (OLS)',
      equation: '\u0177 = \u03B2\u2080 + \u03B2\u2081x\u2081 + \u03B2\u2082x\u2082 + ... + \u03B2\u2099x\u2099',
      loss: 'J(\u03B2) = (1/n) \u03A3 (y\u1D62 - \u0177\u1D62)\u00B2    (Mean Squared Error)',
      howItWorks: 'Finds the best-fit hyperplane by minimizing squared errors. Uses the Normal Equation: \u03B2 = (X\u1D40X)\u207B\u00B9X\u1D40y. This is a closed-form solution \u2014 no iterations needed. Each coefficient \u03B2 represents how much the delay changes per unit increase in that feature.',
      strengths: 'Fast and interpretable. Weakness: assumes linear relationships. If traffic impact is non-linear (e.g., exponential congestion), this model will underfit.',
    },
    {
      title: 'Ridge Regression (L2 Regularization)',
      equation: '\u0177 = X\u03B2 + \u03B5',
      loss: 'J(\u03B2) = (1/n) \u03A3 (y\u1D62 - \u0177\u1D62)\u00B2 + \u03BB \u03A3 \u03B2\u2C7C\u00B2',
      howItWorks: 'Same as Linear Regression but adds a penalty term \u03BB\u03A3\u03B2\u00B2 that shrinks coefficients toward zero. This prevents any single feature from dominating the prediction. Solved via: \u03B2 = (X\u1D40X + \u03BBI)\u207B\u00B9X\u1D40y. The \u03BB parameter controls regularization strength.',
      strengths: 'Handles multicollinearity (when distance and weight are correlated). More stable than OLS. Weakness: still linear \u2014 cannot capture interaction effects natively.',
    },
    {
      title: 'Random Forest Regressor',
      equation: '\u0177 = (1/B) \u03A3 T\u1D47(x),  b = 1...B trees',
      loss: 'Split criterion: minimize MSE(left child) + MSE(right child) at each node',
      howItWorks: 'Builds B decision trees (typically 100), each trained on a random bootstrap sample of the data. At each split, only a random subset of features is considered. Final prediction is the average of all trees. This decorrelation between trees reduces variance.',
      strengths: 'Handles non-linear relationships natively. Robust to outliers. Provides feature importance scores. Weakness: less interpretable than linear models; can overfit on small datasets.',
    },
    {
      title: 'Gradient Boosting Regressor',
      equation: 'F\u2098(x) = F\u2098\u208B\u2081(x) + \u03BD \u00B7 h\u2098(x),  m = 1...M stages',
      loss: 'L(y, F) = (1/2)(y - F(x))\u00B2.  Gradient: r\u2098 = y - F\u2098\u208B\u2081(x)',
      howItWorks: 'Builds trees sequentially. Each new tree h\u2098 is fit to the pseudo-residuals (errors of the previous ensemble). Learning rate \u03BD controls the contribution of each tree. Typical config: 100-500 trees, \u03BD = 0.1, max_depth = 3-5.',
      strengths: 'Usually the most accurate model for tabular data. Captures complex feature interactions. Weakness: slower to train; prone to overfitting if M is too large (controlled by early stopping).',
    },
  ];
}

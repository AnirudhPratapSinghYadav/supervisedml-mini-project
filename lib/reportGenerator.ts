import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ModelResult } from '../app/dataService';

/* ===================================================================
   PDF REPORT GENERATOR
   
   Builds a structured, professional PDF report with:
     - Title page with metadata
     - AI executive summary (from Gemini)
     - Model comparison table (real text, not screenshot)
     - 4 regression diagnostic charts (rendered as images)
     - Mathematical explanation for the selected model
   
   Output is typically 1-3 MB — lightweight and shareable.
   =================================================================== */

const COLORS = {
  bg: [15, 17, 21] as [number, number, number],
  surface: [26, 29, 35] as [number, number, number],
  border: [42, 47, 56] as [number, number, number],
  text: [230, 230, 230] as [number, number, number],
  textMuted: [156, 163, 175] as [number, number, number],
  accent: [76, 110, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const PAGE_W = 210; // A4 width mm
const PAGE_H = 297; // A4 height mm
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    pdf.addPage();
    drawPageBg(pdf);
    return MARGIN + 5;
  }
  return y;
}

function drawPageBg(pdf: jsPDF) {
  pdf.setFillColor(...COLORS.bg);
  pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function drawLine(pdf: jsPDF, y: number) {
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
}

export async function generateReport(
  activeModel: ModelResult,
  allModels: ModelResult[],
  aiSummary: string,
  chartElements: HTMLElement[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  // ================================================================
  // PAGE 1: TITLE + SUMMARY + TABLE
  // ================================================================
  drawPageBg(pdf);

  // --- Title ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...COLORS.text);
  pdf.text('Supply Chain Delay Prediction', MARGIN, y + 10);
  y += 16;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text('Supervised Regression Analysis Report', MARGIN, y);
  y += 5;
  pdf.text(`Generated: ${new Date().toLocaleString()}`, MARGIN, y);
  y += 5;
  pdf.text(`Selected Model: ${activeModel.name}`, MARGIN, y);
  y += 5;
  pdf.text(`Predicted Delay: ${activeModel.predictedDelay.toFixed(1)} hours`, MARGIN, y);
  y += 8;

  drawLine(pdf, y);
  y += 8;

  // --- Prediction Highlight ---
  pdf.setFillColor(...COLORS.surface);
  pdf.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, 'F');
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text('PREDICTED DELAY', MARGIN + CONTENT_W / 2, y + 7, { align: 'center' });
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(...COLORS.text);
  pdf.text(`${activeModel.predictedDelay.toFixed(1)} hours`, MARGIN + CONTENT_W / 2, y + 18, { align: 'center' });
  y += 30;

  // --- AI Executive Summary ---
  if (aiSummary) {
    y = ensureSpace(pdf, y, 40);

    pdf.setFont('courier', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.accent);
    pdf.text('EXECUTIVE SUMMARY — GEMINI 2.5 FLASH', MARGIN, y);
    y += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.text);

    const summaryLines = pdf.splitTextToSize(aiSummary, CONTENT_W);
    for (const line of summaryLines) {
      y = ensureSpace(pdf, y, 5);
      pdf.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 5;
    drawLine(pdf, y);
    y += 8;
  }

  // --- Model Comparison Table ---
  y = ensureSpace(pdf, y, 50);

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.accent);
  pdf.text('MODEL COMPARISON', MARGIN, y);
  y += 6;

  // Table header
  const colX = [MARGIN, MARGIN + 65, MARGIN + 100, MARGIN + 130, MARGIN + 155];
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text('MODEL', colX[0], y);
  pdf.text('RMSE', colX[1], y);
  pdf.text('MAE', colX[2], y);
  pdf.text('R²', colX[3], y);
  pdf.text('DELAY (h)', colX[4], y);
  y += 2;
  drawLine(pdf, y);
  y += 4;

  // Table rows
  const bestModel = allModels.reduce((a, b) => a.rmse < b.rmse ? a : b);
  for (const m of allModels) {
    y = ensureSpace(pdf, y, 6);
    const isBest = m.id === bestModel.id;
    const isActive = m.id === activeModel.id;

    if (isActive) {
      pdf.setFillColor(76, 110, 245, 0.15);
      pdf.rect(MARGIN - 1, y - 3, CONTENT_W + 2, 5.5, 'F');
    }

    pdf.setFont('courier', isBest ? 'bold' : 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.text);
    pdf.text(m.name + (isBest ? ' ✓' : ''), colX[0], y);
    pdf.text(m.rmse.toFixed(3), colX[1], y);
    pdf.text(m.mae.toFixed(3), colX[2], y);
    pdf.text(m.r2.toFixed(3), colX[3], y);
    pdf.text(m.predictedDelay.toFixed(1), colX[4], y);
    y += 6;
  }
  y += 5;

  // ================================================================
  // PAGE 2+: CHARTS
  // ================================================================
  if (chartElements.length > 0) {
    pdf.addPage();
    drawPageBg(pdf);
    y = MARGIN;

    pdf.setFont('courier', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.accent);
    pdf.text(`REGRESSION DIAGNOSTICS — ${activeModel.name.toUpperCase()}`, MARGIN, y);
    y += 8;

    const chartLabels = [
      'Actual vs Predicted — Points should cluster along the diagonal (y=x).',
      'Residual Plot — Residuals should scatter randomly around zero.',
      'Error Distribution — Bell-shaped curve centered at zero indicates unbiased errors.',
      'Q-Q Plot — Points along diagonal confirm normally distributed residuals.',
    ];

    for (let i = 0; i < chartElements.length; i++) {
      y = ensureSpace(pdf, y, 80);

      // Chart label
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...COLORS.textMuted);
      pdf.text(chartLabels[i] || `Chart ${i + 1}`, MARGIN, y);
      y += 4;

      // Render chart to canvas
      try {
        const canvas = await html2canvas(chartElements[i], {
          backgroundColor: '#0F1115',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85); // JPEG for smaller size
        const imgW = CONTENT_W;
        const imgH = (canvas.height * imgW) / canvas.width;
        const clampedH = Math.min(imgH, 65); // max chart height in PDF

        pdf.addImage(imgData, 'JPEG', MARGIN, y, imgW, clampedH);
        y += clampedH + 8;
      } catch {
        pdf.setTextColor(...COLORS.textMuted);
        pdf.text('[Chart rendering failed]', MARGIN, y);
        y += 8;
      }
    }
  }

  // ================================================================
  // FINAL PAGE: MATH EXPLANATION
  // ================================================================
  y = ensureSpace(pdf, y, 60);

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.accent);
  pdf.text(`MATHEMATICAL FOUNDATION — ${activeModel.name.toUpperCase()}`, MARGIN, y);
  y += 6;

  const mathData = getMathForModel(activeModel.name);
  const mathSections = [
    { label: 'Equation', value: mathData.equation },
    { label: 'Loss Function', value: mathData.loss },
    { label: 'Solution', value: mathData.solution },
    { label: 'Interpretation', value: mathData.interpretation },
  ];

  for (const sec of mathSections) {
    y = ensureSpace(pdf, y, 15);
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.accent);
    pdf.text(sec.label.toUpperCase(), MARGIN, y);
    y += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.text);
    const lines = pdf.splitTextToSize(sec.value, CONTENT_W);
    for (const line of lines) {
      y = ensureSpace(pdf, y, 5);
      pdf.text(line, MARGIN, y);
      y += 4;
    }
    y += 3;
  }

  // Footer
  y = ensureSpace(pdf, y, 15);
  drawLine(pdf, y);
  y += 5;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(...COLORS.textMuted);
  pdf.text('Supply Chain Delay Prediction — Supervised Regression Analysis', MARGIN, y);
  pdf.text(`Report generated ${new Date().toISOString()}`, PAGE_W - MARGIN, y, { align: 'right' });

  // SAVE
  pdf.save('Logistics_Delay_Report.pdf');
}

// --- Math data lookup (same logic as MathExplanation component) ---
function getMathForModel(name: string) {
  if (/linear/i.test(name)) return {
    equation: 'ŷ = β₀ + β₁x₁ + β₂x₂ + ... + βₚxₚ',
    loss: 'J(β) = (1/n) Σᵢ (yᵢ − ŷᵢ)²',
    solution: 'Closed-form: β = (XᵀX)⁻¹ Xᵀy — no iterations needed.',
    interpretation: 'Assumes a linear relationship between features and delay. Fast to train but cannot capture non-linear patterns like traffic saturation thresholds.',
  };
  if (/ridge/i.test(name)) return {
    equation: 'ŷ = Xβ + ε',
    loss: 'J(β) = (1/n) Σᵢ (yᵢ − ŷᵢ)² + λ Σⱼ βⱼ²',
    solution: 'Closed-form: β = (XᵀX + λI)⁻¹ Xᵀy. The λ penalty shrinks coefficients toward zero.',
    interpretation: 'Addresses multicollinearity — stabilizes coefficients when distance and warehouse load are correlated. The regularization parameter λ controls the bias-variance tradeoff.',
  };
  if (/random\s*forest/i.test(name)) return {
    equation: 'ŷ = (1/B) Σᵦ Tᵦ(x), b = 1...B trees',
    loss: 'Per-node split criterion: min MSE(left) + MSE(right)',
    solution: 'No gradient descent. Each tree built on bootstrap sample with random feature subsets. Predictions averaged across B trees.',
    interpretation: 'Captures non-linear interactions natively. Robust to outliers. Feature importance derived from mean decrease in impurity.',
  };
  if (/gradient\s*boost/i.test(name)) return {
    equation: 'Fₘ(x) = Fₘ₋₁(x) + ν · hₘ(x), m = 1...M stages',
    loss: 'L(y, F) = (1/2)(y − F(x))² → gradient: rₘ = y − Fₘ₋₁(x)',
    solution: 'At each stage m, fit tree hₘ to pseudo-residuals rₘ. Learning rate ν controls step size. Typical: 100-500 trees, ν = 0.1.',
    interpretation: 'Each iteration corrects errors of the previous ensemble. Highly effective at capturing complex supply chain interactions. Controlled by early stopping or tree depth limits.',
  };
  return {
    equation: 'ŷ = f(X) + ε',
    loss: 'L(y, ŷ) = loss function',
    solution: 'Optimization method depends on model type.',
    interpretation: 'Select a recognized model for detailed foundations.',
  };
}

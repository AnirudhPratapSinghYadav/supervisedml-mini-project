import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activeModel, allModels } = body;

    if (!activeModel) {
      return NextResponse.json({ error: 'No model data provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Graceful fallback — still return a usable summary so PDF generation doesn't crash
      return NextResponse.json({
        summary: `[Gemini API key not configured] Model "${activeModel.name}" reports RMSE ${activeModel.rmse?.toFixed(3) ?? 'N/A'}, MAE ${activeModel.mae?.toFixed(3) ?? 'N/A'}, R² ${activeModel.r2?.toFixed(3) ?? 'N/A'}. Predicted delay: ${activeModel.predictedDelay?.toFixed(1) ?? 'N/A'} hours. Configure GEMINI_API_KEY in .env.local for AI-generated analysis.`
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build a comprehensive context string including all model comparisons
    let modelsContext = '';
    if (allModels && Array.isArray(allModels)) {
      modelsContext = allModels.map((m: any) =>
        `  - ${m.name}: RMSE=${m.rmse?.toFixed(3)}, MAE=${m.mae?.toFixed(3)}, R²=${m.r2?.toFixed(3)}`
      ).join('\n');
    }

    const prompt = `You are a senior logistics operations engineer writing an internal report.

Context: A supply chain delay prediction system has been trained with 4 regression models on shipment data.

Selected model for this report: ${activeModel.name}
  RMSE: ${activeModel.rmse?.toFixed(3) ?? 'unknown'}
  MAE: ${activeModel.mae?.toFixed(3) ?? 'unknown'}  
  R²: ${activeModel.r2?.toFixed(3) ?? 'unknown'}
  Predicted delay for current input: ${activeModel.predictedDelay?.toFixed(1) ?? 'unknown'} hours

All models compared:
${modelsContext || '  (comparison data not available)'}

Write a 4-5 sentence executive summary. Be blunt and practical:
1. State whether this model is reliable based on RMSE/MAE relative to the prediction magnitude.
2. Identify which model performs best and why.
3. Flag any operational risk if the predicted delay exceeds 4 hours.
4. Give one specific, actionable recommendation for the logistics team.
Do not use marketing language. Write like an engineer filing an internal report.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ summary: text });
  } catch (error: any) {
    console.error('Gemini API error:', error?.message || error);
    // Return a meaningful fallback even on error so the PDF still generates
    return NextResponse.json({
      summary: `[AI summary unavailable — API error] Review the model metrics table directly for decision-making.`,
    });
  }
}

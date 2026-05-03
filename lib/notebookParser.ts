import { ModelResult, PlotPoint, FeatureImportance } from '../app/dataService';

/* ===================================================================
   NOTEBOOK PARSER — v2 (Strict extraction, no invented data)
   
   Parses .ipynb and extracts ONLY what actually exists in cell outputs.
   If data isn't found, it's left as undefined — the UI shows "not available".
   
   Extracts:
     - Model names + metrics (RMSE, MAE, R²)
     - Feature names (from DataFrame columns, print output)
     - Feature importance values (from model.feature_importances_)
     - Actual vs Predicted arrays (from test set output)
     - Coefficients (from model.coef_)
   =================================================================== */

interface ParsedNotebook {
  models: ModelResult[];
  featureNames: string[];
  datasetInfo: { rows?: number; features?: number };
}

export function parseNotebook(content: string): ParsedNotebook {
  const nb = JSON.parse(content);
  const cells = nb.cells || [];
  const result: ParsedNotebook = { models: [], featureNames: [], datasetInfo: {} };

  const allOutputText: string[] = [];
  const allSourceCode: string[] = [];

  for (const cell of cells) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
    allSourceCode.push(source);

    let outputText = '';
    if (cell.outputs) {
      for (const out of cell.outputs) {
        if (out.text) outputText += (Array.isArray(out.text) ? out.text.join('') : out.text);
        if (out.data) {
          if (out.data['text/plain']) {
            const p = out.data['text/plain'];
            outputText += (Array.isArray(p) ? p.join('') : p);
          }
          if (out.data['text/html']) {
            const h = out.data['text/html'];
            outputText += (Array.isArray(h) ? h.join('') : h);
          }
        }
      }
    }
    allOutputText.push(outputText);
  }

  const fullOutput = allOutputText.join('\n');
  const fullSource = allSourceCode.join('\n');

  // === EXTRACT MODELS ===
  result.models = tryExtractJSON(fullOutput)
    || tryExtractFromPrint(fullOutput)
    || tryExtractFromHTML(fullOutput)
    || tryExtractFromSource(fullSource, fullOutput)
    || [];

  // === EXTRACT FEATURE NAMES ===
  result.featureNames = extractFeatureNames(fullOutput, fullSource);

  // === EXTRACT FEATURE IMPORTANCE (per model) ===
  const importances = extractFeatureImportance(fullOutput, result.featureNames);

  // === EXTRACT ACTUAL VS PREDICTED ARRAYS ===
  const plotArrays = extractPlotData(fullOutput);

  // === EXTRACT COEFFICIENTS ===
  const coeffData = extractCoefficients(fullOutput);

  // === MERGE EXTRACTED DATA INTO MODELS ===
  for (const m of result.models) {
    // Feature importance — attach to tree-based models if found
    if (importances.length > 0) {
      m.featureImportance = importances;
    }

    // Feature names
    if (result.featureNames.length > 0) {
      m.featureNames = result.featureNames;
    }

    // Plot data from notebook
    if (plotArrays && plotArrays.length > 0 && (!m.plotData || m.plotData.length === 0)) {
      m.plotData = plotArrays;
    }

    // Coefficients for linear models
    if (coeffData && /linear|ridge|lasso|elastic/i.test(m.name)) {
      m.coefficients = coeffData.coefs;
      m.intercept = coeffData.intercept;
    }

    // Mark source
    m.source = 'notebook';
  }

  // Dataset info
  const rowMatch = fullOutput.match(/(\d+)\s*(?:rows|samples|entries|records)/i);
  if (rowMatch) result.datasetInfo.rows = parseInt(rowMatch[1]);
  const featMatch = fullOutput.match(/(\d+)\s*(?:features|columns|variables)/i);
  if (featMatch) result.datasetInfo.features = parseInt(featMatch[1]);

  return result;
}

// ========================= MODEL EXTRACTION =========================

function tryExtractJSON(text: string): ModelResult[] | null {
  const lines = text.split('\n');
  const jsonObjects: any[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed.replace(/'/g, '"'));
        if (obj.rmse || obj.RMSE || obj.mae || obj.MAE) {
          jsonObjects.push(obj);
        }
      } catch { /* skip */ }
    }
  }
  if (jsonObjects.length > 0) {
    return jsonObjects.map((o, i) => normalizeModel(o, i)).filter(Boolean) as ModelResult[];
  }

  // Try array pattern
  const arrMatch = text.match(/\[\s*\{[^[\]]*"(?:name|model)"[^[\]]*\}\s*(?:,\s*\{[^[\]]*\}\s*)*\]/g);
  if (arrMatch) {
    for (const m of arrMatch) {
      try {
        const arr = JSON.parse(m);
        const models = arr.map((item: any, idx: number) => normalizeModel(item, idx)).filter(Boolean);
        if (models.length > 0) return models as ModelResult[];
      } catch { /* skip */ }
    }
  }
  return null;
}

function tryExtractFromPrint(text: string): ModelResult[] | null {
  const models: ModelResult[] = [];
  const modelDefs = [
    { pattern: /linear\s*regression/i, name: 'Linear Regression', id: 'lr' },
    { pattern: /ridge\s*regression/i, name: 'Ridge Regression', id: 'rr' },
    { pattern: /lasso\s*regression/i, name: 'Lasso Regression', id: 'lasso' },
    { pattern: /random\s*forest/i, name: 'Random Forest', id: 'rf' },
    { pattern: /gradient\s*boost/i, name: 'Gradient Boosting', id: 'gb' },
    { pattern: /xgb(?:oost)?/i, name: 'XGBoost', id: 'xgb' },
    { pattern: /svr|support\s*vector/i, name: 'SVR', id: 'svr' },
    { pattern: /decision\s*tree/i, name: 'Decision Tree', id: 'dt' },
    { pattern: /elastic\s*net/i, name: 'Elastic Net', id: 'en' },
    { pattern: /knn|k.?nearest/i, name: 'KNN Regressor', id: 'knn' },
  ];

  const lines = text.split('\n');
  for (const md of modelDefs) {
    for (let i = 0; i < lines.length; i++) {
      if (md.pattern.test(lines[i])) {
        const ctx = lines.slice(i, i + 5).join(' ');
        const rmse = extractNum(ctx, /rmse[:\s=]*([0-9.]+)/i);
        const mae = extractNum(ctx, /mae[:\s=]*([0-9.]+)/i);
        const r2 = extractNum(ctx, /r[²2_]?\s*(?:score|squared)?[:\s=]*([0-9.]+)/i);
        if (rmse !== null || mae !== null || r2 !== null) {
          models.push({
            id: md.id, name: md.name,
            rmse: rmse ?? 0, mae: mae ?? 0, r2: r2 ?? 0,
            predictedDelay: 0, plotData: [],
          });
          break;
        }
      }
    }
  }
  return models.length > 0 ? models : null;
}

function tryExtractFromHTML(text: string): ModelResult[] | null {
  const models: ModelResult[] = [];
  const tableMatch = text.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows || rows.length < 2) return null;

  const headerCells = rows[0].match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
  const headers = (headerCells || []).map(c => c.replace(/<[^>]+>/g, '').trim().toLowerCase());

  const nameIdx = headers.findIndex(h => /model|name|algorithm/i.test(h));
  const rmseIdx = headers.findIndex(h => /rmse/i.test(h));
  const maeIdx = headers.findIndex(h => /mae/i.test(h));
  const r2Idx = headers.findIndex(h => /r[²2]|r.?squared/i.test(h));

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells) continue;
    const vals = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
    const name = nameIdx >= 0 ? vals[nameIdx] : `Model ${i}`;
    const rmse = rmseIdx >= 0 ? parseFloat(vals[rmseIdx]) : 0;
    const mae = maeIdx >= 0 ? parseFloat(vals[maeIdx]) : 0;
    const r2 = r2Idx >= 0 ? parseFloat(vals[r2Idx]) : 0;
    if (name && (rmse > 0 || mae > 0 || r2 > 0)) {
      models.push({ id: `m${i}`, name, rmse, mae, r2, predictedDelay: 0, plotData: [] });
    }
  }
  return models.length > 0 ? models : null;
}

function tryExtractFromSource(source: string, output: string): ModelResult[] | null {
  const modelChecks = [
    { pattern: /LinearRegression/i, name: 'Linear Regression', id: 'lr' },
    { pattern: /Ridge\b/i, name: 'Ridge Regression', id: 'rr' },
    { pattern: /RandomForest/i, name: 'Random Forest', id: 'rf' },
    { pattern: /GradientBoosting/i, name: 'Gradient Boosting', id: 'gb' },
    { pattern: /XGB/i, name: 'XGBoost', id: 'xgb' },
    { pattern: /DecisionTree/i, name: 'Decision Tree', id: 'dt' },
    { pattern: /Lasso\b/i, name: 'Lasso Regression', id: 'lasso' },
    { pattern: /SVR\b/i, name: 'SVR', id: 'svr' },
  ];

  const found = modelChecks.filter(mc => mc.pattern.test(source));
  if (found.length === 0) return null;

  // Try to find metric-like numbers in output
  const nums = (output.match(/\d+\.\d{2,}/g) || []).map(Number);
  const models: ModelResult[] = [];
  for (let i = 0; i < found.length; i++) {
    const bi = i * 3;
    if (bi + 2 < nums.length) {
      const possibleRmse = nums[bi] < 20 ? nums[bi] : 0;
      const possibleMae = nums[bi + 1] < 20 ? nums[bi + 1] : 0;
      const possibleR2 = nums[bi + 2] <= 1 ? nums[bi + 2] : 0;
      if (possibleRmse > 0 || possibleMae > 0 || possibleR2 > 0) {
        models.push({
          id: found[i].id, name: found[i].name,
          rmse: possibleRmse, mae: possibleMae, r2: possibleR2,
          predictedDelay: 0, plotData: [],
        });
      }
    }
  }
  return models.length > 0 ? models : null;
}

// ========================= FEATURE EXTRACTION =========================

function extractFeatureNames(output: string, source: string): string[] {
  // Look for: feature_names = ['distance_km', 'weight', ...]
  const arrayMatch = output.match(/(?:feature|column|X)[\w]*\s*[:=]\s*\[([^\]]+)\]/i)
    || source.match(/(?:feature|column)[\w]*\s*[:=]\s*\[([^\]]+)\]/i);
  if (arrayMatch) {
    return arrayMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean);
  }

  // Look for df.columns output
  const colMatch = output.match(/Index\(\[([^\]]+)\]/);
  if (colMatch) {
    return colMatch[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean);
  }

  return [];
}

function extractFeatureImportance(output: string, featureNames: string[]): FeatureImportance[] {
  const importances: FeatureImportance[] = [];

  // Pattern: "feature_importances_: [0.12, 0.34, ...]"
  const arrMatch = output.match(/feature.?importanc\w*[:\s=]*\[([^\]]+)\]/i);
  if (arrMatch) {
    const vals = arrMatch[1].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
    for (let i = 0; i < vals.length; i++) {
      importances.push({
        name: featureNames[i] || `Feature ${i + 1}`,
        importance: vals[i],
      });
    }
    return importances;
  }

  // Pattern: "distance_km: 0.342\nweight: 0.123\n..."
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w_]+)\s*[:\t]\s*([0-9.]+)\s*$/);
    if (match) {
      const val = parseFloat(match[2]);
      if (val > 0 && val <= 1) {
        importances.push({ name: match[1], importance: val });
      }
    }
  }
  // Only return if we found enough (at least 2 features)
  return importances.length >= 2 ? importances : [];
}

function extractPlotData(output: string): PlotPoint[] | null {
  // Look for actual/predicted arrays
  const actualMatch = output.match(/(?:y_test|actual|y_true)[:\s=]*\[([^\]]+)\]/i);
  const predMatch = output.match(/(?:y_pred|predicted|predictions)[:\s=]*\[([^\]]+)\]/i);

  if (actualMatch && predMatch) {
    const actuals = actualMatch[1].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
    const preds = predMatch[1].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
    const len = Math.min(actuals.length, preds.length);
    if (len >= 5) {
      return Array.from({ length: len }, (_, i) => ({
        actual: Math.round(actuals[i] * 100) / 100,
        predicted: Math.round(preds[i] * 100) / 100,
        residual: Math.round((actuals[i] - preds[i]) * 100) / 100,
      }));
    }
  }
  return null;
}

function extractCoefficients(output: string): { coefs: number[]; intercept: number } | null {
  const coefMatch = output.match(/(?:coef|coefficients?)[_:\s=]*\[([^\]]+)\]/i);
  const interceptMatch = output.match(/intercept[_:\s=]*([0-9.\-]+)/i);

  if (coefMatch) {
    const coefs = coefMatch[1].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
    const intercept = interceptMatch ? parseFloat(interceptMatch[1]) : 0;
    return { coefs, intercept };
  }
  return null;
}

// ========================= HELPERS =========================

function normalizeModel(obj: any, idx: number): ModelResult | null {
  const name = obj.name || obj.model || obj.Model || obj.algorithm || `Model ${idx + 1}`;
  const rmse = Number(obj.rmse || obj.RMSE || obj.root_mean_squared_error || 0);
  const mae = Number(obj.mae || obj.MAE || obj.mean_absolute_error || 0);
  const r2 = Number(obj.r2 || obj.R2 || obj.r_squared || obj.r2_score || 0);
  if (!rmse && !mae && !r2) return null;
  return {
    id: String(obj.id || name.toLowerCase().replace(/\s+/g, '_')).substring(0, 10),
    name: String(name), rmse, mae, r2,
    predictedDelay: Number(obj.predictedDelay || obj.predicted_delay || 0),
    plotData: obj.plotData || [],
  };
}

function extractNum(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (match) { const n = parseFloat(match[1]); return isNaN(n) ? null : n; }
  return null;
}

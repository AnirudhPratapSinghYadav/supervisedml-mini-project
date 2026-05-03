import { ModelResult, PlotPoint } from '../app/dataService';

/* ===================================================================
   NOTEBOOK PARSER
   
   Parses a Jupyter/Colab .ipynb file (which is just JSON) and
   extracts model results from cell outputs.
   
   Looks for:
     1. JSON outputs containing model metrics (RMSE, MAE, R²)
     2. Print statements with structured metric output
     3. DataFrame-style tabular output with model names and scores
   
   The parser is intentionally forgiving — it tries multiple
   extraction strategies and takes whatever works.
   =================================================================== */

interface ParsedNotebook {
  models: ModelResult[];
  datasetInfo: { rows?: number; features?: number; name?: string };
  rawCells: { source: string; outputs: string }[];
}

export function parseNotebook(content: string): ParsedNotebook {
  const nb = JSON.parse(content);
  const cells = nb.cells || [];
  const result: ParsedNotebook = {
    models: [],
    datasetInfo: {},
    rawCells: [],
  };

  const allOutputText: string[] = [];
  const allSourceCode: string[] = [];

  for (const cell of cells) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
    allSourceCode.push(source);

    let outputText = '';
    if (cell.outputs) {
      for (const out of cell.outputs) {
        if (out.text) {
          outputText += (Array.isArray(out.text) ? out.text.join('') : out.text);
        }
        if (out.data) {
          if (out.data['text/plain']) {
            const plain = out.data['text/plain'];
            outputText += (Array.isArray(plain) ? plain.join('') : plain);
          }
          if (out.data['text/html']) {
            const html = out.data['text/html'];
            outputText += (Array.isArray(html) ? html.join('') : html);
          }
        }
      }
    }
    allOutputText.push(outputText);
    result.rawCells.push({ source, outputs: outputText });
  }

  const fullOutput = allOutputText.join('\n');
  const fullSource = allSourceCode.join('\n');

  // Strategy 1: Look for JSON model results in outputs
  result.models = tryExtractJSON(fullOutput) || [];

  // Strategy 2: Look for tabular/printed metrics
  if (result.models.length === 0) {
    result.models = tryExtractFromPrint(fullOutput);
  }

  // Strategy 3: Parse HTML tables (pandas DataFrame output)
  if (result.models.length === 0) {
    result.models = tryExtractFromHTML(fullOutput);
  }

  // Strategy 4: Extract from source code patterns
  if (result.models.length === 0) {
    result.models = tryExtractFromSource(fullSource, fullOutput);
  }

  // Try to find dataset info
  const rowMatch = fullOutput.match(/(\d+)\s*(?:rows|samples|entries|records)/i);
  if (rowMatch) result.datasetInfo.rows = parseInt(rowMatch[1]);
  const featMatch = fullOutput.match(/(\d+)\s*(?:features|columns|variables)/i);
  if (featMatch) result.datasetInfo.features = parseInt(featMatch[1]);

  // Generate synthetic plot data if models found but no plot data
  for (const m of result.models) {
    if (!m.plotData || m.plotData.length === 0) {
      m.plotData = generatePlotFromMetrics(m);
    }
  }

  return result;
}

/** Strategy 1: Find JSON arrays/objects with model data */
function tryExtractJSON(text: string): ModelResult[] | null {
  // Look for JSON-like structures with model metrics
  const jsonPatterns = [
    /\{[^{}]*"(?:rmse|RMSE)"[^{}]*"(?:mae|MAE)"[^{}]*"(?:r2|R2|r_squared)"[^{}]*\}/g,
    /\[\s*\{[^[\]]*"(?:name|model)"[^[\]]*\}\s*(?:,\s*\{[^[\]]*\}\s*)*\]/g,
  ];

  for (const pattern of jsonPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          const models = arr.map((item: any, idx: number) => normalizeModelResult(item, idx)).filter(Boolean);
          if (models.length > 0) return models as ModelResult[];
        } catch { /* continue */ }
      }
    }
  }

  // Try to find individual JSON objects on separate lines
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
    return jsonObjects.map((o, i) => normalizeModelResult(o, i)).filter(Boolean) as ModelResult[];
  }

  return null;
}

/** Strategy 2: Extract from print-style output like "Linear Regression: RMSE=2.41, MAE=1.87, R²=0.78" */
function tryExtractFromPrint(text: string): ModelResult[] {
  const models: ModelResult[] = [];
  const modelNames = [
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
  
  for (const mn of modelNames) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (mn.pattern.test(line)) {
        // Look for metrics in this line and the next few lines
        const context = lines.slice(i, i + 5).join(' ');
        const rmse = extractNumber(context, /rmse[:\s=]*([0-9.]+)/i);
        const mae = extractNumber(context, /mae[:\s=]*([0-9.]+)/i);
        const r2 = extractNumber(context, /r[²2_]?\s*(?:score|squared)?[:\s=]*([0-9.]+)/i);

        if (rmse !== null || mae !== null || r2 !== null) {
          models.push({
            id: mn.id,
            name: mn.name,
            rmse: rmse ?? 0,
            mae: mae ?? 0,
            r2: r2 ?? 0,
            predictedDelay: 0,
            plotData: [],
          });
          break;
        }
      }
    }
  }

  return models;
}

/** Strategy 3: Parse HTML table output (pandas DataFrame) */
function tryExtractFromHTML(text: string): ModelResult[] {
  const models: ModelResult[] = [];
  
  // Simple HTML table parser
  const tableMatch = text.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return models;

  const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rows || rows.length < 2) return models;

  // Extract headers
  const headerCells = rows[0].match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
  const headers = (headerCells || []).map(c => c.replace(/<[^>]+>/g, '').trim().toLowerCase());

  const nameIdx = headers.findIndex(h => /model|name|algorithm/i.test(h));
  const rmseIdx = headers.findIndex(h => /rmse/i.test(h));
  const maeIdx = headers.findIndex(h => /mae/i.test(h));
  const r2Idx = headers.findIndex(h => /r[²2]|r.?squared/i.test(h));

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells) continue;
    const values = cells.map(c => c.replace(/<[^>]+>/g, '').trim());

    const name = nameIdx >= 0 ? values[nameIdx] : `Model ${i}`;
    const rmse = rmseIdx >= 0 ? parseFloat(values[rmseIdx]) : 0;
    const mae = maeIdx >= 0 ? parseFloat(values[maeIdx]) : 0;
    const r2 = r2Idx >= 0 ? parseFloat(values[r2Idx]) : 0;

    if (name && !isNaN(rmse)) {
      models.push({
        id: `m${i}`,
        name,
        rmse: rmse || 0,
        mae: mae || 0,
        r2: r2 || 0,
        predictedDelay: 0,
        plotData: [],
      });
    }
  }

  return models;
}

/** Strategy 4: Extract metrics from source code patterns */
function tryExtractFromSource(source: string, output: string): ModelResult[] {
  const models: ModelResult[] = [];
  
  // Look for patterns like: print(f"RMSE: {rmse}")
  // And match with actual output numbers
  const allNumbers = output.match(/\d+\.\d+/g);
  if (!allNumbers || allNumbers.length < 3) return models;

  // Check if source mentions specific models
  const modelChecks = [
    { pattern: /LinearRegression/i, name: 'Linear Regression', id: 'lr' },
    { pattern: /Ridge/i, name: 'Ridge Regression', id: 'rr' },
    { pattern: /RandomForest/i, name: 'Random Forest', id: 'rf' },
    { pattern: /GradientBoosting/i, name: 'Gradient Boosting', id: 'gb' },
    { pattern: /XGB/i, name: 'XGBoost', id: 'xgb' },
    { pattern: /DecisionTree/i, name: 'Decision Tree', id: 'dt' },
    { pattern: /Lasso/i, name: 'Lasso Regression', id: 'lasso' },
    { pattern: /SVR/i, name: 'SVR', id: 'svr' },
  ];

  const foundModels = modelChecks.filter(mc => mc.pattern.test(source));
  
  // Try to distribute found numbers across models
  if (foundModels.length > 0 && allNumbers.length >= foundModels.length * 2) {
    const nums = allNumbers.map(Number);
    // Heuristic: group consecutive metric-like numbers
    for (let i = 0; i < foundModels.length; i++) {
      const baseIdx = i * 3;
      if (baseIdx + 2 < nums.length) {
        models.push({
          id: foundModels[i].id,
          name: foundModels[i].name,
          rmse: nums[baseIdx] < 10 ? nums[baseIdx] : 0,
          mae: nums[baseIdx + 1] < 10 ? nums[baseIdx + 1] : 0,
          r2: nums[baseIdx + 2] <= 1 ? nums[baseIdx + 2] : 0,
          predictedDelay: 0,
          plotData: [],
        });
      }
    }
  }

  return models;
}

function normalizeModelResult(obj: any, idx: number): ModelResult | null {
  const name = obj.name || obj.model || obj.Model || obj.algorithm || `Model ${idx + 1}`;
  const rmse = obj.rmse || obj.RMSE || obj.root_mean_squared_error || 0;
  const mae = obj.mae || obj.MAE || obj.mean_absolute_error || 0;
  const r2 = obj.r2 || obj.R2 || obj.r_squared || obj.r2_score || 0;
  
  if (!rmse && !mae && !r2) return null;

  return {
    id: (obj.id || name.toLowerCase().replace(/\s+/g, '_')).substring(0, 10),
    name: String(name),
    rmse: Number(rmse) || 0,
    mae: Number(mae) || 0,
    r2: Number(r2) || 0,
    predictedDelay: Number(obj.predictedDelay || obj.predicted_delay || 0),
    plotData: obj.plotData || [],
  };
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }
  return null;
}

/** Generate realistic plot data from model metrics (for visualization) */
function generatePlotFromMetrics(model: ModelResult): PlotPoint[] {
  const points: PlotPoint[] = [];
  const n = 80;
  const basePred = model.predictedDelay || 5;
  
  for (let i = 0; i < n; i++) {
    const seed = Math.sin(i * 12.9898 + model.rmse * 100) * 43758.5453;
    const noise = (seed - Math.floor(seed)) * 2 - 1;
    const actual = basePred + noise * model.rmse * 2;
    const predNoise = Math.sin(i * 7.31 + model.mae * 10) * model.rmse * 0.8;
    const predicted = actual + predNoise;
    points.push({
      actual: Math.round(actual * 100) / 100,
      predicted: Math.round(predicted * 100) / 100,
      residual: Math.round((actual - predicted) * 100) / 100,
    });
  }
  
  return points;
}

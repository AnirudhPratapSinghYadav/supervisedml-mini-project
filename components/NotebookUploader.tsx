"use client";

import React, { useRef, useState } from 'react';
import { parseNotebook } from '../lib/notebookParser';
import { ModelResult } from '../app/dataService';

interface Props {
  onModelsLoaded: (models: ModelResult[]) => void;
}

/**
 * NotebookUploader — Upload a Colab .ipynb file to extract trained model results.
 * 
 * Accepts .ipynb files, parses them client-side (no server upload needed),
 * extracts model metrics from cell outputs, and feeds them into the dashboard.
 */
export const NotebookUploader = ({ onModelsLoaded }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [filename, setFilename] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ipynb')) {
      setStatus('error');
      setMessage('Please upload a .ipynb (Jupyter/Colab notebook) file.');
      return;
    }

    setFilename(file.name);
    setStatus('parsing');
    setMessage('Parsing notebook...');

    try {
      const text = await file.text();
      const result = parseNotebook(text);

      if (result.models.length === 0) {
        setStatus('error');
        setMessage(
          'No model metrics found in the notebook outputs. Make sure your notebook prints or displays RMSE, MAE, and R² values for each model.'
        );
        return;
      }

      // Set a default predicted delay if none was extracted
      for (const m of result.models) {
        if (m.predictedDelay === 0) {
          m.predictedDelay = Math.max(1, m.rmse * 2 + m.mae);
        }
      }

      setStatus('success');
      const info = result.datasetInfo;
      setMessage(
        `Extracted ${result.models.length} model(s): ${result.models.map(m => m.name).join(', ')}` +
        (info.rows ? ` · ${info.rows} rows` : '') +
        (info.features ? ` · ${info.features} features` : '')
      );

      onModelsLoaded(result.models);
    } catch (err: any) {
      setStatus('error');
      setMessage(`Failed to parse notebook: ${err.message || 'Invalid .ipynb format'}`);
    }

    // Reset file input so same file can be re-uploaded
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="upload-section">
      <div className="upload-header">
        <div className="upload-icon">📓</div>
        <div>
          <div className="upload-title">Upload Colab Notebook</div>
          <div className="upload-desc">
            Upload your own trained .ipynb file — metrics will be extracted from cell outputs
            and the dashboard will update with your real model results.
          </div>
        </div>
      </div>

      <div className="upload-controls">
        <input
          ref={fileRef}
          type="file"
          accept=".ipynb"
          onChange={handleUpload}
          style={{ display: 'none' }}
          id="notebook-upload"
        />
        <label htmlFor="notebook-upload" className="btn-outline upload-btn">
          {status === 'parsing' ? 'Parsing...' : 'Choose .ipynb File'}
        </label>
        {filename && status === 'success' && (
          <span className="upload-filename">{filename}</span>
        )}
      </div>

      {message && (
        <div className={`upload-message ${status}`}>
          {status === 'success' && '✓ '}
          {status === 'error' && '✗ '}
          {message}
        </div>
      )}

      <div className="upload-help">
        <div className="upload-help-title">What your notebook should contain:</div>
        <ul>
          <li>Print or display RMSE, MAE, R² for each model</li>
          <li>Use model names like &ldquo;Linear Regression&rdquo;, &ldquo;Random Forest&rdquo;, etc.</li>
          <li>Works with pandas DataFrames, print statements, or JSON output</li>
        </ul>
        <div className="upload-example">
          <code>print(f&quot;Linear Regression: RMSE=&#123;rmse:.3f&#125;, MAE=&#123;mae:.3f&#125;, R²=&#123;r2:.3f&#125;&quot;)</code>
        </div>
      </div>
    </div>
  );
};

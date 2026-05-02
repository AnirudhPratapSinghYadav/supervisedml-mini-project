"use client";

import React, { useState } from 'react';

export interface InferenceData {
  distance: number;
  carrier: string;
  trafficLevel: string;
  weight: number;
  warehouseLoad: number;
  hour: number;
  day: string;
}

interface Props {
  onEstimate: (data: InferenceData) => void;
  isLoading: boolean;
}

/**
 * InferenceForm
 * 
 * All field values match the exact categorical labels
 * used in the Colab training notebook's dataset.
 * If your dataset uses different carrier names or traffic labels,
 * update the <option> values here to match exactly.
 */
export const InferenceForm = ({ onEstimate, isLoading }: Props) => {
  const [formData, setFormData] = useState<InferenceData>({
    distance: 0,
    carrier: '',
    trafficLevel: '',
    weight: 0,
    warehouseLoad: 0,
    hour: 0,
    day: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = formData.distance > 0 && formData.carrier && formData.trafficLevel && formData.weight > 0 && formData.day;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    onEstimate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Distance (km)</label>
        <input
          type="number"
          name="distance"
          value={formData.distance || ''}
          onChange={handleChange}
          className="form-input"
          placeholder="e.g. 450"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Carrier</label>
        <select name="carrier" value={formData.carrier} onChange={handleChange} className="form-select" required>
          <option value="">Select carrier</option>
          <option value="DHL">DHL</option>
          <option value="FedEx">FedEx</option>
          <option value="BlueDart">BlueDart</option>
          <option value="DTDC">DTDC</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Traffic Level</label>
        <select name="trafficLevel" value={formData.trafficLevel} onChange={handleChange} className="form-select" required>
          <option value="">Select level</option>
          <option value="Low">Low</option>
          <option value="Moderate">Moderate</option>
          <option value="High">High</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Package Weight (kg)</label>
        <input
          type="number"
          name="weight"
          value={formData.weight || ''}
          onChange={handleChange}
          className="form-input"
          placeholder="e.g. 12"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Warehouse Load (%)</label>
        <input
          type="number"
          name="warehouseLoad"
          value={formData.warehouseLoad || ''}
          onChange={handleChange}
          className="form-input"
          placeholder="e.g. 75"
          min="0"
          max="100"
          required
        />
      </div>

      <div className="form-row">
        <div>
          <label className="form-label">Hour (0-23)</label>
          <input
            type="number"
            name="hour"
            value={formData.hour || ''}
            onChange={handleChange}
            className="form-input"
            min="0"
            max="23"
            required
          />
        </div>
        <div>
          <label className="form-label">Day of Week</label>
          <select name="day" value={formData.day} onChange={handleChange} className="form-select" required>
            <option value="">Select day</option>
            <option value="0">Monday</option>
            <option value="1">Tuesday</option>
            <option value="2">Wednesday</option>
            <option value="3">Thursday</option>
            <option value="4">Friday</option>
            <option value="5">Saturday</option>
            <option value="6">Sunday</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={isLoading || !isFormValid}>
        {isLoading ? 'Estimating...' : 'Estimate Delay'}
      </button>
    </form>
  );
};

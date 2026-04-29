import React, { useState } from 'react';

interface AIDraftPanelProps {
  caseId: number;
  onGenerate: (prompt: string) => Promise<string>;
  onSave: (content: string) => Promise<void>;
}

export default function AIDraftPanel({ caseId, onGenerate, onSave }: AIDraftPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const generated = await onGenerate(prompt);
      setDraft(generated);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      alert('Draft saved successfully');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">AI Appeal Draft Generator</h2>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want the appeal to focus on..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition mb-4"
      >
        {loading ? 'Generating...' : 'Generate Draft'}
      </button>

      {draft && (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Generated Draft</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      )}
    </div>
  );
}

interface OutcomePredictorProps {
  caseId: number;
  onPredict: () => Promise<{
    winProbability: number;
    reasoning: string;
    recommendations: string[];
  }>;
}

export function OutcomePredictor({ caseId, onPredict }: OutcomePredictorProps) {
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const result = await onPredict();
      setPrediction(result);
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Outcome Predictor</h2>

      <button
        onClick={handlePredict}
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition mb-4"
      >
        {loading ? 'Analyzing...' : 'Predict Outcome'}
      </button>

      {prediction && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-100 to-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Win Probability</p>
            <p className="text-3xl font-bold text-purple-600">{prediction.winProbability}%</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Analysis</p>
            <p className="text-gray-600">{prediction.reasoning}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Recommendations</p>
            <ul className="space-y-1">
              {prediction.recommendations.map((rec: string, i: number) => (
                <li key={i} className="text-sm text-gray-600">• {rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

interface ImageAnalyzerProps {
  onAnalyze: (imageUrl: string) => Promise<string>;
}

export function ImageAnalyzer({ onAnalyze }: ImageAnalyzerProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await onAnalyze(imageUrl);
      setAnalysis(result);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Image Analyzer</h2>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Image URL</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || !imageUrl}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition mb-4"
      >
        {loading ? 'Analyzing...' : 'Analyze Image'}
      </button>

      {analysis && (
        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">Analysis Result</p>
          <p className="text-gray-600">{analysis}</p>
        </div>
      )}
    </div>
  );
}

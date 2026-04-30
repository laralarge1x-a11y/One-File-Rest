import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface PredictionData {
  currentScore: number;
  currentGrade: string;
  predictedScore: number;
  predictedGrade: string;
  confidence: number;
  trend: string;
  recommendations: string[];
}

interface PredictionChartProps {
  history: Array<{ score: number; calculated_at: string }>;
  prediction: PredictionData;
}

export const PredictionChart: React.FC<PredictionChartProps> = ({ history, prediction }) => {
  const chartData = {
    labels: history.map((h) =>
      new Date(h.calculated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: 'Historical Scores',
        data: history.map((h) => h.score),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Predicted Score',
        data: [...Array(history.length - 1).fill(null), prediction.predictedScore],
        borderColor: '#ef4444',
        borderDash: [5, 5],
        pointRadius: 6,
        pointBackgroundColor: '#ef4444',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Compliance Score Trend & Prediction',
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Line data={chartData} options={options} />
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Prediction:</strong> Your score is predicted to reach <strong>{prediction.predictedScore}</strong> ({prediction.predictedGrade})
          with <strong>{prediction.confidence}%</strong> confidence. Trend: <strong>{prediction.trend}</strong>
        </p>
      </div>
    </div>
  );
};

interface RecommendationsListProps {
  recommendations: string[];
  score: number;
}

export const RecommendationsList: React.FC<RecommendationsListProps> = ({ recommendations, score }) => {
  const getPriorityColor = (index: number) => {
    if (index === 0) return 'border-l-4 border-red-500 bg-red-50';
    if (index === 1) return 'border-l-4 border-orange-500 bg-orange-50';
    return 'border-l-4 border-yellow-500 bg-yellow-50';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Recommendations</h3>
      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <div key={index} className={`p-4 rounded ${getPriorityColor(index)}`}>
            <p className="text-sm text-gray-700">{rec}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface BenchmarkComparisonProps {
  userScore: number;
  benchmark: {
    avgScore: number;
    medianScore: number;
    percentile25: number;
    percentile75: number;
    percentile90: number;
  };
  percentile: number;
}

export const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({
  userScore,
  benchmark,
  percentile,
}) => {
  const chartData = {
    labels: ['Your Score', 'Average', 'Median', 'P75', 'P90'],
    datasets: [
      {
        label: 'Compliance Scores',
        data: [
          userScore,
          benchmark.avgScore,
          benchmark.medianScore,
          benchmark.percentile75,
          benchmark.percentile90,
        ],
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
        ],
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Your Score vs Benchmarks',
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Bar data={chartData} options={options} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-xs text-gray-600">Your Percentile</p>
          <p className="text-2xl font-bold text-blue-600">{percentile}%</p>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <p className="text-xs text-gray-600">vs Average</p>
          <p className="text-2xl font-bold text-green-600">
            {(userScore - benchmark.avgScore).toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
};

interface TrendAnalysisProps {
  trend: {
    trend: string;
    volatility: string;
    momentum: number;
    currentScore: number;
    previousScore: number;
    highestScore: number;
    lowestScore: number;
    averageScore: string;
  };
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ trend }) => {
  const getTrendIcon = (trendType: string) => {
    if (trendType === 'improving') return '📈';
    if (trendType === 'declining') return '📉';
    return '➡️';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Trend Analysis</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded">
          <p className="text-xs text-gray-600">Trend</p>
          <p className="text-2xl font-bold">
            {getTrendIcon(trend.trend)} {trend.trend.charAt(0).toUpperCase() + trend.trend.slice(1)}
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <p className="text-xs text-gray-600">Volatility</p>
          <p className="text-2xl font-bold">{trend.volatility}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <p className="text-xs text-gray-600">Momentum</p>
          <p className="text-2xl font-bold">{trend.momentum > 0 ? '+' : ''}{trend.momentum}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded">
          <p className="text-xs text-gray-600">Average Score</p>
          <p className="text-2xl font-bold">{trend.averageScore}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded">
          <p className="text-xs text-gray-600">Current</p>
          <p className="text-2xl font-bold text-blue-600">{trend.currentScore}</p>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <p className="text-xs text-gray-600">Previous</p>
          <p className="text-2xl font-bold text-green-600">{trend.previousScore}</p>
        </div>
      </div>
      <div className="mt-4 p-4 bg-yellow-50 rounded">
        <p className="text-sm text-gray-700">
          <strong>Range:</strong> {trend.lowestScore} - {trend.highestScore}
        </p>
      </div>
    </div>
  );
};

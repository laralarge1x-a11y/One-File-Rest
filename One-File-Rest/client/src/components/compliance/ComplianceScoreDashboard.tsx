import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

interface ComplianceFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
  status: 'good' | 'warning' | 'critical';
}

interface ComplianceData {
  overall_score: number;
  grade: string;
  trend: number;
  factors: ComplianceFactor[];
  last_updated: string;
  recommendations: string[];
}

export default function ComplianceScoreDashboard({ caseId }: { caseId: number }) {
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchCompliance();
    fetchHistory();
  }, [caseId]);

  const fetchCompliance = async () => {
    try {
      const data = await api.get(`/api/compliance/score/${caseId}`);
      setCompliance(data);
    } catch (err) {
      console.error('Failed to fetch compliance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await api.get(`/api/compliance/history/${caseId}`);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!compliance) {
    return <div className="text-gray-600">No compliance data available</div>;
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-green-600 bg-green-50';
      case 'B':
        return 'text-blue-600 bg-blue-50';
      case 'C':
        return 'text-yellow-600 bg-yellow-50';
      case 'D':
        return 'text-orange-600 bg-orange-50';
      case 'F':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Compliance Score</h2>
          <span className="text-sm text-gray-500">Last updated: {new Date(compliance.last_updated).toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Score Circle */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke={compliance.overall_score >= 80 ? '#10b981' : compliance.overall_score >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={`${(compliance.overall_score / 100) * 339.29} 339.29`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-gray-900">{compliance.overall_score}</span>
                <span className="text-sm text-gray-600">/ 100</span>
              </div>
            </div>
            <div className={`mt-4 px-4 py-2 rounded-lg font-bold text-lg ${getGradeColor(compliance.grade)}`}>
              Grade: {compliance.grade}
            </div>
          </div>

          {/* Trend & Stats */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Trend</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-blue-600">{compliance.trend > 0 ? '+' : ''}{compliance.trend}%</span>
                <span className={`text-2xl ${compliance.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {compliance.trend > 0 ? '↑' : '↓'}
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Factors Analyzed</p>
              <p className="text-3xl font-bold text-purple-600">{compliance.factors.length}</p>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Recommendations</p>
            <ul className="space-y-2">
              {compliance.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Factors Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Compliance Factors</h3>
        <div className="space-y-4">
          {compliance.factors.map((factor, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{factor.name}</h4>
                  <p className="text-sm text-gray-600">{factor.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(factor.status)}`}>
                  {factor.status}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        factor.score >= 80
                          ? 'bg-green-600'
                          : factor.score >= 60
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${factor.score}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">{factor.score}</span>
                  <span className="text-sm text-gray-600 ml-1">({factor.weight}% weight)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Trend */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Score History</h3>
          <div className="space-y-2">
            {history.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-600">{new Date(entry.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${entry.score}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold text-gray-900 w-12 text-right">{entry.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

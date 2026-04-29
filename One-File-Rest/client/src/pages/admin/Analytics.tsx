import React, { useEffect, useState } from 'react';

interface AnalyticsData {
  totalCases: number;
  wonCases: number;
  deniedCases: number;
  avgResolutionTime: number;
  avgComplianceScore: number;
  totalRevenue: number;
  clientRetention: number;
  casesByStatus: Array<{ status: string; count: number }>;
  casesByViolationType: Array<{ type: string; count: number }>;
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics', {
        credentials: 'include',
      });

      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics</h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Cases</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalCases}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Won Cases</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{data.wonCases}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Avg Resolution Time</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{data.avgResolutionTime}d</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Revenue</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">${data.totalRevenue}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cases by Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cases by Status</h2>
            <div className="space-y-2">
              {data.casesByStatus.map((item) => (
                <div key={item.status} className="flex justify-between items-center">
                  <span className="text-gray-600">{item.status}</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cases by Violation Type */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cases by Violation Type</h2>
            <div className="space-y-2">
              {data.casesByViolationType.map((item) => (
                <div key={item.type} className="flex justify-between items-center">
                  <span className="text-gray-600">{item.type}</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

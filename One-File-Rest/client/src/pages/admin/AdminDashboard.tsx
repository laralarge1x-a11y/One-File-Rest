import React, { useEffect, useState } from 'react';

interface AdminStats {
  totalClients: number;
  activeCases: number;
  wonCases: number;
  totalRevenue: number;
  avgComplianceScore: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalClients: 0,
    activeCases: 0,
    wonCases: 0,
    totalRevenue: 0,
    avgComplianceScore: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/analytics', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Total Clients</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalClients}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Active Cases</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.activeCases}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Won Cases</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.wonCases}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">${stats.totalRevenue}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm">Avg Compliance</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.avgComplianceScore}%</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded transition">View All Clients</button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded transition">View All Cases</button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded transition">Send Broadcast</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <p className="text-gray-600 text-sm">No recent activity</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <p className="text-green-600 font-semibold">✓ All systems operational</p>
        </div>
      </div>
    </div>
  );
}

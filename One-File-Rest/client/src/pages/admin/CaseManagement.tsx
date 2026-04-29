import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Case {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  priority: string;
  client_username: string;
  appeal_deadline: string;
  created_at: string;
}

export default function CaseManagement() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const response = await fetch('/api/cases', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCases(data);
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = filterStatus === 'all' ? cases : cases.filter((c) => c.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'won':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Case Management</h1>

        {/* Filter */}
        <div className="mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Cases</option>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="denied">Denied</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Violation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCases.map((caseItem) => (
                <tr key={caseItem.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{caseItem.account_username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{caseItem.violation_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{caseItem.client_username}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(caseItem.status)}`}>
                      {caseItem.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-600">{caseItem.priority}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(caseItem.appeal_deadline).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => navigate(`/cases/${caseItem.id}`)}
                      className="text-blue-600 hover:text-blue-900 font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

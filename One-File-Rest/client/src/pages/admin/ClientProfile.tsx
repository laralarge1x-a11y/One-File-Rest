import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface ClientProfile {
  id: number;
  discord_id: string;
  discord_username: string;
  email: string;
  total_cases: number;
  won_cases: number;
  compliance_score: number;
  created_at: string;
  cases: Array<{
    id: number;
    account_username: string;
    violation_type: string;
    status: string;
    created_at: string;
  }>;
}

export default function ClientProfile() {
  const { discordId } = useParams<{ discordId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!discordId) return;

    fetchProfile();
  }, [discordId]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/analytics/clients/${discordId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <p className="text-gray-600">Client not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/admin/clients')} className="text-blue-600 hover:text-blue-900 mb-4 font-semibold">
          ← Back to Clients
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">{profile.discord_username}</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Email</p>
            <p className="text-lg font-semibold text-gray-900 mt-2">{profile.email}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Cases</p>
            <p className="text-lg font-semibold text-gray-900 mt-2">{profile.total_cases}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Won Cases</p>
            <p className="text-lg font-semibold text-green-600 mt-2">{profile.won_cases}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Compliance Score</p>
            <p className="text-lg font-semibold text-blue-600 mt-2">{profile.compliance_score}%</p>
          </div>
        </div>

        {/* Cases */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Cases</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Violation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {profile.cases.map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{caseItem.account_username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{caseItem.violation_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{caseItem.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(caseItem.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Client {
  id: number;
  discord_id: string;
  discord_username: string;
  email: string;
  total_cases: number;
  won_cases: number;
  compliance_score: number;
  created_at: string;
}

export default function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/analytics/clients', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.discord_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Clients</h1>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total Cases</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Won Cases</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Compliance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.discord_username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{client.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{client.total_cases}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{client.won_cases}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold">{client.compliance_score}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => navigate(`/admin/clients/${client.discord_id}`)}
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

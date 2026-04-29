import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface PolicyAlert {
  id: number;
  title: string;
  content: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export default function PolicyAlerts() {
  const { socket, isConnected } = useSocket();
  const [alerts, setAlerts] = useState<PolicyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('policy:new_alert', (alert: PolicyAlert) => {
        setAlerts((prev) => [alert, ...prev]);
      });

      return () => {
        socket.off('policy:new_alert');
      };
    }
  }, [socket]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/policies', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-300 text-red-900';
      case 'high':
        return 'bg-orange-100 border-orange-300 text-orange-900';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'low':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      case 'low':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading policy alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Policy Alerts</h1>
        <p className="text-gray-600 mb-8">Stay updated with the latest TikTok policy changes and alerts</p>

        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No policy alerts at this time</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border-l-4 p-6 ${getSeverityColor(alert.severity)} bg-white shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{alert.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityBadgeColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 mt-2">{alert.content}</p>
                    <p className="text-sm text-gray-500 mt-4">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Connection Status */}
        <div className="mt-8 text-sm text-gray-600">
          <p>
            Socket Status: <span className={isConnected ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {isConnected ? '✓ Connected' : '✗ Disconnected'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

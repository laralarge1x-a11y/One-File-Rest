import React from 'react';
import { formatDate } from '../../lib/utils';

interface PolicyAlert {
  id: number;
  title: string;
  content: string;
  severity: string;
  created_at: string;
  read: boolean;
}

interface PolicyAlertCardProps {
  alert: PolicyAlert;
  onMarkRead?: (id: number) => void;
}

export default function PolicyAlertCard({ alert, onMarkRead }: PolicyAlertCardProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div
      className={`border-l-4 rounded-lg p-4 ${getSeverityColor(alert.severity)} ${
        !alert.read ? 'opacity-100' : 'opacity-75'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold">{alert.title}</h3>
        <span className="text-xs font-semibold uppercase">{alert.severity}</span>
      </div>
      <p className="text-sm mb-2">{alert.content}</p>
      <div className="flex justify-between items-center">
        <p className="text-xs opacity-75">{formatDate(alert.created_at)}</p>
        {onMarkRead && !alert.read && (
          <button
            onClick={() => onMarkRead(alert.id)}
            className="text-xs font-semibold hover:underline"
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
}

interface PolicyFeedProps {
  alerts: PolicyAlert[];
  onMarkRead?: (id: number) => void;
}

export function PolicyFeed({ alerts, onMarkRead }: PolicyFeedProps) {
  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Policy Alerts</h2>
        {unreadCount > 0 && (
          <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            {unreadCount} new
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No policy alerts</p>
      ) : (
        alerts.map((alert) => (
          <PolicyAlertCard key={alert.id} alert={alert} onMarkRead={onMarkRead} />
        ))
      )}
    </div>
  );
}

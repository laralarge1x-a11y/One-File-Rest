import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, getDaysUntil, getStatusColor } from '../../lib/utils';

interface CaseCardProps {
  id: number;
  accountUsername: string;
  violationType: string;
  status: string;
  priority: string;
  appealDeadline: string;
  complianceScore: number;
}

export default function CaseCard({
  id,
  accountUsername,
  violationType,
  status,
  priority,
  appealDeadline,
  complianceScore,
}: CaseCardProps) {
  const navigate = useNavigate();
  const daysRemaining = getDaysUntil(appealDeadline);

  return (
    <div
      onClick={() => navigate(`/cases/${id}`)}
      className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{accountUsername}</h3>
          <p className="text-sm text-gray-600">{violationType}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Priority</p>
          <p className="text-sm font-semibold text-gray-900">{priority}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Compliance</p>
          <p className="text-sm font-semibold text-blue-600">{complianceScore}%</p>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs text-gray-500">Appeal Deadline</p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-sm font-semibold text-gray-900">{formatDate(appealDeadline)}</p>
          <p className={`text-xs font-semibold ${daysRemaining < 3 ? 'text-red-600' : 'text-green-600'}`}>
            {daysRemaining} days
          </p>
        </div>
      </div>
    </div>
  );
}

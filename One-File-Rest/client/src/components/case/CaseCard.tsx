import { useNavigate } from 'react-router-dom';
import { formatDate, getDaysUntil } from '../../lib/utils';
import { emojiForStatus, formatStatusLabel } from '@shared/stages';

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  drafting: 'bg-blue-100 text-blue-800',
  submitted: 'bg-indigo-100 text-indigo-800',
  awaiting_response: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  closed: 'bg-gray-200 text-gray-700',
};
const getStatusColor = (status: string): string => STATUS_PILL[status] ?? 'bg-gray-100 text-gray-800';

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
          {emojiForStatus(status)} {formatStatusLabel(status)}
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

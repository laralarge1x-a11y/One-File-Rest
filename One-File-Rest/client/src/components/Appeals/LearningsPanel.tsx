import React, { useState } from 'react';
import { AccessibleButton } from '../Accessible';

interface Learning {
  id: number;
  what_worked: string;
  what_didnt_work: string;
  key_insights: string;
  recommendations_for_future: string;
  created_at: string;
}

interface LearningsPanelProps {
  caseId: number;
  learnings: Learning[];
  onSaveLearnings: (data: any) => Promise<void>;
  loading?: boolean;
}

export const LearningsPanel: React.FC<LearningsPanelProps> = ({
  caseId,
  learnings,
  onSaveLearnings,
  loading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    whatWorked: '',
    whatDidntWork: '',
    keyInsights: '',
    recommendationsForFuture: '',
  });

  const handleSave = async () => {
    try {
      await onSaveLearnings(formData);
      setFormData({
        whatWorked: '',
        whatDidntWork: '',
        keyInsights: '',
        recommendationsForFuture: '',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving learnings:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Appeal Learnings</h3>
        {!isEditing && (
          <AccessibleButton
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            ariaLabel="Add new learning"
          >
            + Add Learning
          </AccessibleButton>
        )}
      </div>

      {isEditing && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What Worked?</label>
            <textarea
              value={formData.whatWorked}
              onChange={(e) => setFormData({ ...formData, whatWorked: e.target.value })}
              placeholder="Describe what worked well in this appeal..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What Didn't Work?</label>
            <textarea
              value={formData.whatDidntWork}
              onChange={(e) => setFormData({ ...formData, whatDidntWork: e.target.value })}
              placeholder="Describe what didn't work..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Key Insights</label>
            <textarea
              value={formData.keyInsights}
              onChange={(e) => setFormData({ ...formData, keyInsights: e.target.value })}
              placeholder="Share key insights from this appeal..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recommendations for Future</label>
            <textarea
              value={formData.recommendationsForFuture}
              onChange={(e) => setFormData({ ...formData, recommendationsForFuture: e.target.value })}
              placeholder="What would you do differently next time?..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <AccessibleButton
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              ariaLabel="Save learnings"
            >
              {loading ? 'Saving...' : 'Save Learnings'}
            </AccessibleButton>
            <AccessibleButton
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              ariaLabel="Cancel"
            >
              Cancel
            </AccessibleButton>
          </div>
        </div>
      )}

      {learnings.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No learnings recorded yet. Add your first learning!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {learnings.map((learning) => (
            <div key={learning.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <p className="text-xs text-gray-500 mb-3">{formatDate(learning.created_at)}</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 text-sm mb-1">✓ What Worked</h4>
                  <p className="text-sm text-gray-700">{learning.what_worked}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-red-700 text-sm mb-1">✗ What Didn't Work</h4>
                  <p className="text-sm text-gray-700">{learning.what_didnt_work}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <h4 className="font-semibold text-blue-700 text-sm mb-1">💡 Key Insights</h4>
                <p className="text-sm text-gray-700">{learning.key_insights}</p>
              </div>

              <div className="mt-3 pt-3 border-t">
                <h4 className="font-semibold text-purple-700 text-sm mb-1">🎯 Recommendations</h4>
                <p className="text-sm text-gray-700">{learning.recommendations_for_future}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface SimilarAppealsProps {
  similar: Array<{
    id: number;
    account_username: string;
    violation_type: string;
    status: string;
    outcome: string;
  }>;
}

export const SimilarAppeals: React.FC<SimilarAppealsProps> = ({ similar }) => {
  if (similar.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No similar appeals found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Similar Appeals</h3>
      <div className="space-y-3">
        {similar.map((appeal) => (
          <div key={appeal.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800">{appeal.account_username}</p>
                <p className="text-sm text-gray-600">{appeal.violation_type}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  appeal.outcome === 'won'
                    ? 'bg-green-100 text-green-800'
                    : appeal.outcome === 'denied'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {appeal.outcome || appeal.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

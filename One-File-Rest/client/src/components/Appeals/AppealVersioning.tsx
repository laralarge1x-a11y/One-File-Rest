import React, { useState } from 'react';
import { AccessibleButton } from '../Accessible';

interface AppealVersion {
  id: number;
  version_number: number;
  appeal_content: string;
  arguments: string[];
  evidence_ids: number[];
  created_by_discord_id: string;
  change_summary: string;
  status: string;
  created_at: string;
}

interface AppealVersionsProps {
  versions: AppealVersion[];
  onSelectVersion: (versionId: number) => void;
  onSubmitVersion: (versionId: number) => Promise<void>;
  onArchiveVersion: (versionId: number) => Promise<void>;
  loading?: boolean;
}

export const AppealVersions: React.FC<AppealVersionsProps> = ({
  versions,
  onSelectVersion,
  onSubmitVersion,
  onArchiveVersion,
  loading = false,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-blue-100 text-blue-800',
      archived: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (versions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No appeal versions yet. Create your first version!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {versions.map((version) => (
        <div
          key={version.id}
          className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
            selectedVersion === version.id ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => {
            setSelectedVersion(version.id);
            onSelectVersion(version.id);
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  Version {version.version_number}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(version.status)}`}>
                  {version.status.charAt(0).toUpperCase() + version.status.slice(1)}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{formatDate(version.created_at)}</p>
            </div>
          </div>

          {version.change_summary && (
            <p className="text-sm text-gray-700 mb-3 p-2 bg-gray-50 rounded">
              {version.change_summary}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-gray-600">Content Length</p>
              <p className="font-semibold text-blue-600">{version.appeal_content.length} chars</p>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <p className="text-xs text-gray-600">Arguments</p>
              <p className="font-semibold text-green-600">{version.arguments?.length || 0}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded">
              <p className="text-xs text-gray-600">Evidence</p>
              <p className="font-semibold text-purple-600">{version.evidence_ids?.length || 0}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {version.status === 'draft' && (
              <AccessibleButton
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmitVersion(version.id);
                }}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                ariaLabel={`Submit version ${version.version_number}`}
              >
                Submit
              </AccessibleButton>
            )}
            <AccessibleButton
              onClick={(e) => {
                e.stopPropagation();
                onArchiveVersion(version.id);
              }}
              disabled={loading}
              className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              ariaLabel={`Archive version ${version.version_number}`}
            >
              Archive
            </AccessibleButton>
          </div>
        </div>
      ))}
    </div>
  );
};

interface VersionDiffViewerProps {
  version1: AppealVersion;
  version2: AppealVersion;
  similarity: number;
}

export const VersionDiffViewer: React.FC<VersionDiffViewerProps> = ({
  version1,
  version2,
  similarity,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'arguments' | 'evidence'>('content');

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Version Comparison</h3>
          <div className="text-sm">
            <span className="text-gray-600">Similarity: </span>
            <span className="font-bold text-blue-600">{similarity.toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex gap-2 border-b">
          {(['content', 'arguments', 'evidence'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Version 1 */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">Version {version1.version_number}</h4>
          {activeTab === 'content' && (
            <p className="text-sm text-gray-700 line-clamp-6">{version1.appeal_content}</p>
          )}
          {activeTab === 'arguments' && (
            <ul className="text-sm text-gray-700 space-y-1">
              {version1.arguments?.map((arg, i) => (
                <li key={i} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{arg}</span>
                </li>
              ))}
            </ul>
          )}
          {activeTab === 'evidence' && (
            <p className="text-sm text-gray-700">{version1.evidence_ids?.length || 0} evidence items</p>
          )}
        </div>

        {/* Version 2 */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <h4 className="font-semibold text-gray-800 mb-2">Version {version2.version_number}</h4>
          {activeTab === 'content' && (
            <p className="text-sm text-gray-700 line-clamp-6">{version2.appeal_content}</p>
          )}
          {activeTab === 'arguments' && (
            <ul className="text-sm text-gray-700 space-y-1">
              {version2.arguments?.map((arg, i) => (
                <li key={i} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{arg}</span>
                </li>
              ))}
            </ul>
          )}
          {activeTab === 'evidence' && (
            <p className="text-sm text-gray-700">{version2.evidence_ids?.length || 0} evidence items</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface AppealHistoryProps {
  history: Array<{
    id: number;
    action: string;
    old_value: string | null;
    new_value: string | null;
    changed_by_discord_id: string;
    change_reason: string;
    created_at: string;
  }>;
}

export const AppealHistory: React.FC<AppealHistoryProps> = ({ history }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Appeal History</h3>
      <div className="space-y-4">
        {history.map((entry, index) => (
          <div key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              {index < history.length - 1 && <div className="w-0.5 h-12 bg-gray-300 mt-2"></div>}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{entry.action}</p>
                  <p className="text-sm text-gray-600">{entry.change_reason}</p>
                </div>
                <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
              </div>
              {entry.old_value && entry.new_value && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                  <p><strong>From:</strong> {entry.old_value.substring(0, 100)}...</p>
                  <p><strong>To:</strong> {entry.new_value.substring(0, 100)}...</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

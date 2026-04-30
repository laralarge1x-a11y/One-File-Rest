import React, { useState, useEffect } from 'react';
import { AccessibleButton } from '../Accessible';

interface Report {
  id: number;
  report_type: string;
  title: string;
  format: string;
  generated_at: string;
  created_at: string;
}

interface ReportListProps {
  reports: Report[];
  onDownload: (reportId: number) => void;
  onDelete: (reportId: number) => void;
  loading?: boolean;
}

export const ReportList: React.FC<ReportListProps> = ({
  reports,
  onDownload,
  onDelete,
  loading = false,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReportTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      monthly: 'bg-blue-100 text-blue-800',
      quarterly: 'bg-green-100 text-green-800',
      custom: 'bg-purple-100 text-purple-800',
      compliance: 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No reports generated yet. Create your first report!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Format</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Generated</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-900">{report.title}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getReportTypeColor(report.report_type)}`}>
                    {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 uppercase">{report.format}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(report.generated_at || report.created_at)}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex gap-2">
                    <AccessibleButton
                      onClick={() => onDownload(report.id)}
                      disabled={loading}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                      ariaLabel={`Download ${report.title}`}
                    >
                      Download
                    </AccessibleButton>
                    <AccessibleButton
                      onClick={() => onDelete(report.id)}
                      disabled={loading}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                      ariaLabel={`Delete ${report.title}`}
                    >
                      Delete
                    </AccessibleButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

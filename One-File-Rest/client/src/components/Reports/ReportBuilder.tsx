import React, { useState } from 'react';
import { AccessibleButton } from '../Accessible';
import { a11y } from '../../utils/accessibility';

interface ReportBuilderProps {
  onGenerateReport: (config: any) => Promise<void>;
  loading?: boolean;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({ onGenerateReport, loading = false }) => {
  const [reportType, setReportType] = useState<'monthly' | 'quarterly' | 'custom'>('monthly');
  const [title, setTitle] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(1);
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [sections, setSections] = useState<string[]>(['summary', 'details']);
  const [filters, setFilters] = useState({
    status: '',
    violationType: '',
    startDate: '',
    endDate: '',
  });

  const handleSectionToggle = (section: string) => {
    setSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleGenerateReport = async () => {
    try {
      const config = {
        reportType,
        title: title || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        format,
        ...(reportType === 'monthly' && { month, year }),
        ...(reportType === 'quarterly' && { quarter, year }),
        ...(reportType === 'custom' && { sections, filters }),
      };

      await onGenerateReport(config);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Report Builder</h2>

      {/* Report Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Report Type</label>
        <div className="flex gap-4">
          {(['monthly', 'quarterly', 'custom'] as const).map(type => (
            <label key={type} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="reportType"
                value={type}
                checked={reportType === type}
                onChange={(e) => setReportType(e.target.value as any)}
                className="mr-2"
              />
              <span className="text-gray-700 capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Monthly Report Options */}
      {reportType === 'monthly' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min="2020"
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Quarterly Report Options */}
      {reportType === 'quarterly' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4].map(q => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min="2020"
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Options */}
      {reportType === 'custom' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter report title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Sections</label>
            <div className="space-y-2">
              {['summary', 'details', 'compliance', 'analytics'].map(section => (
                <label key={section} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sections.includes(section)}
                    onChange={() => handleSectionToggle(section)}
                    className="mr-2"
                  />
                  <span className="text-gray-700 capitalize">{section}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="won">Won</option>
                <option value="denied">Denied</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Violation Type</label>
              <select
                value={filters.violationType}
                onChange={(e) => setFilters({ ...filters, violationType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="content_violation">Content Violation</option>
                <option value="copyright">Copyright</option>
                <option value="fraud">Fraud</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Export Format</label>
        <div className="flex gap-4">
          {(['pdf', 'csv', 'json'] as const).map(fmt => (
            <label key={fmt} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="format"
                value={fmt}
                checked={format === fmt}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mr-2"
              />
              <span className="text-gray-700 uppercase">{fmt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <AccessibleButton
        onClick={handleGenerateReport}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        ariaLabel="Generate report"
      >
        {loading ? 'Generating...' : 'Generate Report'}
      </AccessibleButton>
    </div>
  );
};

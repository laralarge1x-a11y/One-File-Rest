import React from 'react';

interface ViolationData {
  date: string;
  count: number;
  type: string;
}

interface ViolationHistoryChartProps {
  data: ViolationData[];
  title?: string;
}

export default function ViolationHistoryChart({ data, title = 'Violation History' }: ViolationHistoryChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'copyright':
        return 'bg-red-500';
      case 'harassment':
        return 'bg-orange-500';
      case 'misinformation':
        return 'bg-yellow-500';
      case 'spam':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>

      <div className="space-y-4">
        {data.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No violation data</p>
        ) : (
          data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="w-24 text-sm text-gray-600">{item.date}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">{item.type}</span>
                  <span className="text-xs text-gray-500">{item.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getTypeColor(item.type)}`}
                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Violation Types</p>
        <div className="grid grid-cols-2 gap-2">
          {['copyright', 'harassment', 'misinformation', 'spam'].map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getTypeColor(type)}`}></div>
              <span className="text-xs text-gray-600 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

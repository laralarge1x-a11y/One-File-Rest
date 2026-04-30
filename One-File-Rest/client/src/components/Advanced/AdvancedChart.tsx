import React from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface AdvancedChartProps {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartData[];
  title?: string;
  dataKey?: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  animated?: boolean;
  loading?: boolean;
}

const COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#f97316',
];

export const AdvancedChart: React.FC<AdvancedChartProps> = ({
  type,
  data,
  title,
  dataKey = 'value',
  colors = COLORS,
  height = 300,
  showLegend = true,
  showGrid = true,
  animated = true,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const chartProps = {
    data,
    height,
    margin: { top: 5, right: 30, left: 0, bottom: 5 },
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              {showLegend && <Legend />}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive={animated}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              {showLegend && <Legend />}
              <Bar
                dataKey={dataKey}
                fill={colors[0]}
                isAnimationActive={animated}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={dataKey}
                isAnimationActive={animated}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      )}
      <div className="rounded-lg bg-white p-4 dark:bg-gray-800">
        {renderChart()}
      </div>
    </motion.div>
  );
};

// Chart Container Component
interface ChartContainerProps {
  title?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  children,
  loading,
  error,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
    >
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && children}
    </motion.div>
  );
};

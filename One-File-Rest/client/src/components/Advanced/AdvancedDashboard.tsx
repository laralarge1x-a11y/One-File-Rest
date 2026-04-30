import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, X, Plus, Settings } from 'lucide-react';

interface Widget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'list' | 'custom';
  title: string;
  size: 'small' | 'medium' | 'large';
  data?: any;
  config?: any;
}

interface AdvancedDashboardProps {
  widgets: Widget[];
  onWidgetRemove?: (id: string) => void;
  onWidgetAdd?: () => void;
  onWidgetReorder?: (widgets: Widget[]) => void;
  editable?: boolean;
  children?: React.ReactNode;
}

export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({
  widgets,
  onWidgetRemove,
  onWidgetAdd,
  onWidgetReorder,
  editable = true,
  children,
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const sizeClasses = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-2 row-span-1 md:col-span-2',
    large: 'col-span-2 row-span-2 md:col-span-3',
  };

  const handleDragStart = (id: string) => {
    setDraggedWidget(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedWidget || draggedWidget === targetId) return;

    const draggedIndex = widgets.findIndex(w => w.id === draggedWidget);
    const targetIndex = widgets.findIndex(w => w.id === targetId);

    const newWidgets = [...widgets];
    [newWidgets[draggedIndex], newWidgets[targetIndex]] = [
      newWidgets[targetIndex],
      newWidgets[draggedIndex],
    ];

    onWidgetReorder?.(newWidgets);
    setDraggedWidget(null);
  };

  return (
    <div className="w-full">
      {/* Dashboard Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center justify-between"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        {editable && (
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setEditMode(!editMode)}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              <Settings className="h-4 w-4" />
              {editMode ? 'Done' : 'Edit'}
            </motion.button>
            {editMode && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onWidgetAdd}
                className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
              >
                <Plus className="h-4 w-4" />
                Add Widget
              </motion.button>
            )}
          </div>
        )}
      </motion.div>

      {/* Widgets Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-max"
      >
        <AnimatePresence>
          {widgets.map((widget) => (
            <motion.div
              key={widget.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              draggable={editMode}
              onDragStart={() => handleDragStart(widget.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(widget.id)}
              className={`${sizeClasses[widget.size]} rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
                editMode ? 'cursor-move' : ''
              } ${draggedWidget === widget.id ? 'opacity-50' : ''}`}
            >
              {/* Widget Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editMode && (
                    <GripVertical className="h-5 w-5 text-gray-400" />
                  )}
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {widget.title}
                  </h3>
                </div>
                {editMode && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onWidgetRemove?.(widget.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                )}
              </div>

              {/* Widget Content */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="min-h-48"
              >
                {children}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// Metric Widget Component
interface MetricWidgetProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export const MetricWidget: React.FC<MetricWidgetProps> = ({
  label,
  value,
  change,
  icon,
  trend = 'neutral',
}) => {
  const trendColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-gray-500',
  }[trend];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </span>
        {change !== undefined && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`text-sm font-semibold ${trendColor}`}
          >
            {change > 0 ? '+' : ''}{change}%
          </motion.span>
        )}
      </div>
    </motion.div>
  );
};

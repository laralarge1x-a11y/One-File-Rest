import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface AdvancedTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  fullWidth?: boolean;
}

export const AdvancedTabs: React.FC<AdvancedTabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  variant = 'default',
  fullWidth = false,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const tabVariants = {
    default: 'rounded-t-lg border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600',
    pills: 'rounded-full mx-1 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800',
    underline: 'border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 pb-2',
  };

  const activeTabVariants = {
    default: 'border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    pills: 'bg-blue-500 text-white',
    underline: 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="w-full">
      {/* Tab List */}
      <div
        className={`flex gap-2 border-b border-gray-200 dark:border-gray-700 ${
          fullWidth ? 'w-full' : ''
        } ${variant === 'pills' ? 'bg-gray-100 dark:bg-gray-800 rounded-lg p-1' : ''}`}
      >
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => !tab.disabled && handleTabChange(tab.id)}
            disabled={tab.disabled}
            whileHover={!tab.disabled ? { scale: 1.05 } : {}}
            whileTap={!tab.disabled ? { scale: 0.95 } : {}}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-all ${
              tab.disabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              activeTab === tab.id
                ? `text-blue-600 dark:text-blue-400 ${activeTabVariants[variant]}`
                : `text-gray-700 dark:text-gray-300 ${tabVariants[variant]}`
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full"
              >
                {tab.badge}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="mt-4"
      >
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </motion.div>
    </div>
  );
};

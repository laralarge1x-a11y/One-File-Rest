import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface AdvancedAccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
  onChange?: (openItems: string[]) => void;
}

export const AdvancedAccordion: React.FC<AdvancedAccordionProps> = ({
  items,
  allowMultiple = false,
  defaultOpen = [],
  onChange,
}) => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen));

  const toggleItem = (id: string) => {
    const newOpen = new Set(openItems);

    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      if (!allowMultiple) {
        newOpen.clear();
      }
      newOpen.add(id);
    }

    setOpenItems(newOpen);
    onChange?.(Array.from(newOpen));
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Header */}
          <motion.button
            onClick={() => !item.disabled && toggleItem(item.id)}
            disabled={item.disabled}
            whileHover={!item.disabled ? { backgroundColor: 'rgba(59, 130, 246, 0.05)' } : {}}
            className={`w-full flex items-center justify-between px-4 py-3 text-left font-medium transition-colors ${
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {item.icon && <span className="text-lg">{item.icon}</span>}
              <span className="text-gray-900 dark:text-white">{item.title}</span>
            </div>
            <motion.div
              animate={{ rotate: openItems.has(item.id) ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </motion.div>
          </motion.button>

          {/* Content */}
          <AnimatePresence>
            {openItems.has(item.id) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {item.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
};

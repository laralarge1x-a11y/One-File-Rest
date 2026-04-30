import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, Trash2 } from 'lucide-react';

interface SearchSuggestion {
  id: string;
  label: string;
  category?: string;
  icon?: React.ReactNode;
}

interface AdvancedSearchProps {
  onSearch: (query: string) => void;
  suggestions?: SearchSuggestion[];
  placeholder?: string;
  debounceMs?: number;
  showHistory?: boolean;
  maxHistoryItems?: number;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  filters?: { label: string; value: string }[];
  onFilterChange?: (filter: string) => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  suggestions = [],
  placeholder = 'Search...',
  debounceMs = 300,
  showHistory = true,
  maxHistoryItems = 5,
  onSuggestionSelect,
  filters,
  onFilterChange,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('');

  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (searchQuery: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onSearch(searchQuery);
        }, debounceMs);
      };
    })(),
    [onSearch, debounceMs]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim()) {
      debouncedSearch(value);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      setHistory((prev) => [
        searchQuery,
        ...prev.filter((item) => item !== searchQuery),
      ].slice(0, maxHistoryItems));
      onSearch(searchQuery);
      setQuery(searchQuery);
      setIsOpen(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.label);
    handleSearch(suggestion.label);
    onSuggestionSelect?.(suggestion);
  };

  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    return suggestions.filter((s) =>
      s.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, suggestions]);

  const displaySuggestions = filteredSuggestions.length > 0 ? filteredSuggestions : [];
  const displayHistory = showHistory && !query.trim() ? history : [];

  return (
    <div className="relative w-full">
      {/* Search input */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
        />
        {query && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </motion.button>
        )}
      </motion.div>

      {/* Filters */}
      {filters && filters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex flex-wrap gap-2"
        >
          {filters.map((filter) => (
            <motion.button
              key={filter.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedFilter(filter.value);
                onFilterChange?.(filter.value);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedFilter === filter.value
                  ? 'bg-blue-500 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (displaySuggestions.length > 0 || displayHistory.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Suggestions */}
            {displaySuggestions.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Suggestions
                </div>
                {displaySuggestions.map((suggestion) => (
                  <motion.button
                    key={suggestion.id}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-gray-700"
                  >
                    {suggestion.icon && <span>{suggestion.icon}</span>}
                    <div>
                      <div>{suggestion.label}</div>
                      {suggestion.category && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.category}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* History */}
            {displayHistory.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Recent Searches
                </div>
                {displayHistory.map((item, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    onClick={() => handleSearch(item)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {item}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory((prev) => prev.filter((h) => h !== item));
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Search, Download, Filter, Eye, EyeOff } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface AdvancedTableProps<T extends { id: string | number }> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  searchable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  onExport?: () => void;
  loading?: boolean;
  pagination?: boolean;
  itemsPerPage?: number;
  striped?: boolean;
  hover?: boolean;
}

export const AdvancedTable = React.forwardRef<HTMLDivElement, AdvancedTableProps<any>>(
  ({
    data,
    columns,
    onRowClick,
    selectable = false,
    onSelectionChange,
    searchable = true,
    filterable = true,
    exportable = true,
    onExport,
    loading = false,
    pagination = true,
    itemsPerPage = 10,
    striped = true,
    hover = true,
  }, ref) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof any; direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleColumns, setVisibleColumns] = useState<Set<keyof any>>(new Set(columns.map(c => c.key)));

    const filteredData = useMemo(() => {
      let result = [...data];

      if (searchTerm) {
        result = result.filter(row =>
          columns.some(col =>
            String(row[col.key]).toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      }

      if (sortConfig) {
        result.sort((a, b) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];

          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return result;
    }, [data, searchTerm, sortConfig, columns]);

    const paginatedData = useMemo(() => {
      if (!pagination) return filteredData;
      const start = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage, pagination]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const handleSort = (key: keyof any) => {
      setSortConfig(current =>
        current?.key === key && current.direction === 'asc'
          ? { key, direction: 'desc' }
          : { key, direction: 'asc' }
      );
    };

    const handleSelectAll = () => {
      if (selectedRows.size === paginatedData.length) {
        setSelectedRows(new Set());
      } else {
        setSelectedRows(new Set(paginatedData.map(row => row.id)));
      }
    };

    const handleSelectRow = (id: string | number) => {
      const newSelected = new Set(selectedRows);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedRows(newSelected);
      onSelectionChange?.(paginatedData.filter(row => newSelected.has(row.id)));
    };

    const toggleColumnVisibility = (key: keyof any) => {
      const newVisible = new Set(visibleColumns);
      if (newVisible.has(key)) {
        newVisible.delete(key);
      } else {
        newVisible.add(key);
      }
      setVisibleColumns(newVisible);
    };

    return (
      <div ref={ref} className="w-full">
        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          {searchable && (
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          )}

          <div className="flex gap-2">
            {filterable && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                title="Filter"
              >
                <Filter className="h-4 w-4" />
              </motion.button>
            )}

            {exportable && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onExport}
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                title="Export"
              >
                <Download className="h-4 w-4" />
              </motion.button>
            )}

            <div className="relative group">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                title="Column visibility"
              >
                <Eye className="h-4 w-4" />
              </motion.button>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileHover={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full z-10 hidden rounded-lg border border-gray-300 bg-white shadow-lg group-hover:block dark:border-gray-600 dark:bg-gray-800"
              >
                {columns.map(col => (
                  <button
                    key={String(col.key)}
                    onClick={() => toggleColumnVisibility(col.key)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {visibleColumns.has(col.key) ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                    {col.label}
                  </button>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                {selectable && (
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                {columns.map(col => (
                  visibleColumns.has(col.key) && (
                    <th
                      key={String(col.key)}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 ${
                        col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''
                      }`}
                      style={{ width: col.width }}
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {col.sortable && sortConfig?.key === col.key && (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        )}
                      </div>
                    </th>
                  )
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-8 text-center">
                      <div className="flex justify-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"
                        />
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                      No data available
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => onRowClick?.(row)}
                      className={`border-b border-gray-200 transition-colors dark:border-gray-700 ${
                        striped && idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                      } ${hover ? 'hover:bg-blue-50 dark:hover:bg-gray-700/50' : ''} ${
                        onRowClick ? 'cursor-pointer' : ''
                      }`}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.id)}
                            onChange={() => handleSelectRow(row.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300"
                          />
                        </td>
                      )}
                      {columns.map(col => (
                        visibleColumns.has(col.key) && (
                          <td
                            key={String(col.key)}
                            className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
                            style={{ width: col.width }}
                          >
                            {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                          </td>
                        )
                      ))}
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </motion.div>

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center justify-between"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
            </div>

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                Previous
              </motion.button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <motion.button
                  key={page}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-blue-500 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {page}
                </motion.button>
              ))}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                Next
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    );
  }
);

AdvancedTable.displayName = 'AdvancedTable';

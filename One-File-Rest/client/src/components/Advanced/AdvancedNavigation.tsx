import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, Home, Settings, Bell, User, LogOut, Search } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
  submenu?: NavItem[];
}

interface AdvancedNavigationProps {
  items: NavItem[];
  logo?: React.ReactNode;
  onNavigate?: (href: string) => void;
  user?: { name: string; avatar?: string };
  onLogout?: () => void;
  searchable?: boolean;
  onSearch?: (query: string) => void;
}

export const AdvancedNavigation: React.FC<AdvancedNavigationProps> = ({
  items,
  logo,
  onNavigate,
  user,
  onLogout,
  searchable = true,
  onSearch,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      {/* Desktop Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 sticky top-0 z-40 shadow-sm"
      >
        {/* Logo */}
        <div className="flex items-center gap-8">
          {logo && <div className="text-2xl font-bold">{logo}</div>}

          {/* Nav Items */}
          <div className="flex items-center gap-1">
            {items.map((item) => (
              <div key={item.href} className="relative group">
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                  onClick={() => onNavigate?.(item.href)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                  {item.submenu && <ChevronDown className="h-4 w-4" />}
                </motion.button>

                {/* Submenu */}
                {item.submenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    className="absolute left-0 top-full hidden group-hover:block bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-48 mt-2"
                  >
                    {item.submenu.map((subitem) => (
                      <motion.button
                        key={subitem.href}
                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                        onClick={() => onNavigate?.(subitem.href)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 first:rounded-t-lg last:rounded-b-lg transition-colors"
                      >
                        {subitem.label}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {searchable && (
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Notifications */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="relative p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Bell className="h-5 w-5" />
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
            />
          </motion.button>

          {/* User Menu */}
          {user && (
            <div className="relative group">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                ) : (
                  <User className="h-5 w-5" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
                <ChevronDown className="h-4 w-4" />
              </motion.button>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileHover={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full hidden group-hover:block bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-48 mt-2"
              >
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-t-lg">
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-b-lg"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </motion.nav>

      {/* Mobile Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 z-40 flex items-center justify-between"
      >
        <div>{logo}</div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-700 dark:text-gray-300"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </motion.button>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed top-16 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30"
          >
            <div className="px-4 py-4 space-y-2">
              {items.map((item) => (
                <div key={item.href}>
                  <motion.button
                    whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                    onClick={() => {
                      onNavigate?.(item.href);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    {item.submenu && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          activeSubmenu === item.href ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </motion.button>

                  {item.submenu && activeSubmenu === item.href && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pl-4 space-y-1"
                    >
                      {item.submenu.map((subitem) => (
                        <motion.button
                          key={subitem.href}
                          whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                          onClick={() => {
                            onNavigate?.(subitem.href);
                            setMobileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                        >
                          {subitem.label}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

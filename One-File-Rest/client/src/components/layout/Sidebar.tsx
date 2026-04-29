import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/cases/new', label: 'New Case', icon: '➕' },
    { path: '/messages', label: 'Messages', icon: '💬' },
    { path: '/policies', label: 'Policies', icon: '📋' },
    { path: '/timeline', label: 'Timeline', icon: '📅' },
    { path: '/subscription', label: 'Subscription', icon: '💳' },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Elite Tok Club</h1>
        <p className="text-gray-400 text-sm mt-1">Appeal Management</p>
      </div>

      <nav className="mt-8">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-6 py-3 transition ${
              isActive(item.path)
                ? 'bg-blue-600 border-l-4 border-blue-400'
                : 'hover:bg-gray-800'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-700">
        <p className="text-xs text-gray-400">© 2026 Elite Tok Club</p>
      </div>
    </aside>
  );
}

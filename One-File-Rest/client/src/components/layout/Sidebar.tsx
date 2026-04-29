import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/cases/new', label: 'New Case', icon: '➕' },
  { to: '/messages', label: 'Messages', icon: '💬' },
  { to: '/policies', label: 'Policy Alerts', icon: '📢' },
  { to: '/timeline', label: 'Timeline', icon: '📅' },
  { to: '/subscription', label: 'Subscription', icon: '⭐' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-purple-400">Elite Tok Club</h1>
        <p className="text-xs text-gray-400 mt-1">TikTok Appeal Portal</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">
              {user.discord_username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.discord_username}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

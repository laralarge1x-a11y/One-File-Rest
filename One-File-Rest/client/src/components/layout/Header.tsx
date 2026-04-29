import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  isAdmin?: boolean;
}

export default function Header({ isAdmin }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {isAdmin && (
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
            Admin
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">
              {user.discord_username?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="font-medium">{user.discord_username}</span>
          </div>
        )}
      </div>
    </header>
  );
}

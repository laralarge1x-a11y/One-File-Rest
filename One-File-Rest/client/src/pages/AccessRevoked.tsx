import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessRevoked() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">🚫</div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Access Revoked
        </h1>

        <p className="text-gray-600 mb-6">
          Your Elite Tok Club portal access has been ended. Your subscription is no longer active.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            <strong>What this means:</strong>
          </p>
          <ul className="text-sm text-gray-600 mt-2 space-y-1">
            <li>• Your portal link is no longer active</li>
            <li>• Your case history is preserved</li>
            <li>• You can re-subscribe anytime to regain access</li>
          </ul>
        </div>

        <p className="text-gray-600 mb-6">
          If you believe this is a mistake or would like to re-subscribe, please message us on Discord.
        </p>

        <button
          onClick={() => window.location.href = 'https://discord.com'}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          Go to Discord
        </button>

        <button
          onClick={() => navigate('/login')}
          className="w-full mt-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { formatTime } from '../../lib/utils';

interface MessageBubbleProps {
  content: string;
  sender: string;
  timestamp: string;
  isOwn: boolean;
  type?: 'text' | 'system' | 'alert';
}

export default function MessageBubble({
  content,
  sender,
  timestamp,
  isOwn,
  type = 'text',
}: MessageBubbleProps) {
  if (type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 text-sm px-4 py-2 rounded-full">{content}</div>
      </div>
    );
  }

  if (type === 'alert') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-yellow-100 text-yellow-800 text-sm px-4 py-2 rounded-full">{content}</div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3`}>
        {!isOwn && <p className="text-xs font-semibold mb-1 opacity-75">{sender}</p>}
        <p className="break-words">{content}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime(timestamp)}</p>
      </div>
    </div>
  );
}

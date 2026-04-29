import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

interface Message {
  id: number;
  sender_discord_id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

export default function Messages() {
  const { caseId } = useParams<{ caseId: string }>();
  const { socket, isConnected, joinCase, leaveCase, sendMessage } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    fetchMessages();
    joinCase(parseInt(caseId));

    return () => {
      leaveCase(parseInt(caseId));
    };
  }, [caseId]);

  useEffect(() => {
    if (!socket || !caseId) return;

    const handleNewMessage = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, caseId]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !caseId) return;

    setSending(true);
    try {
      sendMessage(parseInt(caseId), messageText, 'text');
      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Messages - Case {caseId}</h1>

        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-96">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No messages yet. Start the conversation!</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-4">
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">{msg.sender_discord_id}</p>
                      <p className="text-gray-700 mt-1">{msg.content}</p>
                      <p className="text-xs text-gray-500 mt-2">{new Date(msg.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mt-4 text-sm text-gray-600">
          <p>
            Socket Status: <span className={isConnected ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {isConnected ? '✓ Connected' : '✗ Disconnected'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

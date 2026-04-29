import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

interface CaseDetail {
  id: number;
  account_username: string;
  violation_type: string;
  violation_description: string;
  status: string;
  priority: string;
  appeal_deadline: string;
  outcome: string;
  total_gmv: number;
  face_videos_posted: number;
  commission_frozen: boolean;
  created_at: string;
  updated_at: string;
  complianceScore: {
    score: number;
    grade: string;
    factors: Array<{ name: string; impact: number; description: string }>;
    recommendations: string[];
  };
  messages: Array<{
    id: number;
    sender_discord_id: string;
    sender_type: string;
    content: string;
    created_at: string;
  }>;
  evidence: Array<{
    id: number;
    file_url: string;
    file_type: string;
    created_at: string;
  }>;
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket, isConnected, joinCase, leaveCase, sendMessage } = useSocket();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetchCase();
    joinCase(parseInt(id));

    return () => {
      leaveCase(parseInt(id));
    };
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleNewMessage = (message: any) => {
      setCaseData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, message],
        };
      });
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, id]);

  const fetchCase = async () => {
    try {
      const response = await fetch(`/api/cases/${id}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCaseData(data);
      }
    } catch (err) {
      console.error('Error fetching case:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !id) return;

    setSending(true);
    try {
      sendMessage(parseInt(id), messageText, 'text');
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
          <p className="text-gray-600">Loading case...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <p className="text-gray-600">Case not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:text-blue-900 mb-4 font-semibold">
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{caseData.account_username}</h1>
        <p className="text-gray-600">{caseData.violation_type}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Case Details */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Case Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className="text-gray-900 font-semibold">{caseData.status}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Priority</p>
                <p className="text-gray-900 font-semibold">{caseData.priority}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Appeal Deadline</p>
                <p className="text-gray-900 font-semibold">{new Date(caseData.appeal_deadline).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Outcome</p>
                <p className="text-gray-900 font-semibold">{caseData.outcome || 'Pending'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total GMV</p>
                <p className="text-gray-900 font-semibold">${caseData.total_gmv}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Commission Frozen</p>
                <p className="text-gray-900 font-semibold">{caseData.commission_frozen ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {caseData.messages.length === 0 ? (
                <p className="text-gray-600">No messages yet</p>
              ) : (
                caseData.messages.map((msg) => (
                  <div key={msg.id} className="bg-gray-50 rounded p-4 border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">{msg.sender_discord_id}</p>
                    <p className="text-gray-900">{msg.content}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(msg.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-white text-gray-900 rounded px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Compliance Score */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Compliance Score</h2>
            <div className="text-center mb-4">
              <p className="text-5xl font-bold text-blue-600">{caseData.complianceScore.score}</p>
              <p className="text-gray-600 text-sm">Grade: {caseData.complianceScore.grade}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Factors</h3>
              {caseData.complianceScore.factors.map((factor, idx) => (
                <div key={idx} className="text-sm">
                  <p className="text-gray-700">{factor.name}</p>
                  <p className={`text-xs ${factor.impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {factor.impact > 0 ? '+' : ''}{factor.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recommendations</h2>
            <ul className="space-y-2">
              {caseData.complianceScore.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

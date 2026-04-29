import React, { useState } from 'react';

export default function BulkBroadcast() {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetSegment: 'all',
    sendNow: true,
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({
          title: '',
          message: '',
          targetSegment: 'all',
          sendNow: true,
        });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error sending broadcast:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Bulk Broadcast</h1>

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            Broadcast sent successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Message</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Target Segment */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Target Segment</label>
            <select
              name="targetSegment"
              value={formData.targetSegment}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Clients</option>
              <option value="active">Active Clients</option>
              <option value="high_compliance">High Compliance Score</option>
              <option value="low_compliance">Low Compliance Score</option>
              <option value="won_cases">Won Cases</option>
            </select>
          </div>

          {/* Send Now */}
          <div className="mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="sendNow"
                checked={formData.sendNow}
                onChange={handleChange}
                className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-gray-900">Send immediately</span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={sending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {sending ? 'Sending...' : 'Send Broadcast'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

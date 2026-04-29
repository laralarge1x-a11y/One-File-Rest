import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NewCase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    accountUsername: '',
    violationType: '',
    violationDescription: '',
    appealDeadline: '',
    totalGMV: '',
    faceVideosPosted: '',
    commissionFrozen: false,
    accountPurchaseDate: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accountUsername: formData.accountUsername,
          violationType: formData.violationType,
          violationDescription: formData.violationDescription,
          appealDeadline: formData.appealDeadline,
          totalGMV: parseFloat(formData.totalGMV) || 0,
          faceVideosPosted: parseInt(formData.faceVideosPosted) || 0,
          commissionFrozen: formData.commissionFrozen,
          accountPurchaseDate: formData.accountPurchaseDate || null,
        }),
      });

      if (response.ok) {
        const newCase = await response.json();
        navigate(`/cases/${newCase.id}`);
      } else {
        alert('Failed to create case');
      }
    } catch (err) {
      console.error('Error creating case:', err);
      alert('Error creating case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:text-blue-900 mb-4 font-semibold">
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Appeal</h1>
          <p className="text-gray-600 mt-2">Submit a new TikTok appeal case</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
          {/* Account Username */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">TikTok Account Username *</label>
            <input
              type="text"
              name="accountUsername"
              value={formData.accountUsername}
              onChange={handleChange}
              required
              placeholder="@yourusername"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Violation Type */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Violation Type *</label>
            <select
              name="violationType"
              value={formData.violationType}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a violation type</option>
              <option value="banned_account">Banned Account</option>
              <option value="suspended_account">Suspended Account</option>
              <option value="commission_frozen">Commission Frozen</option>
              <option value="shop_restricted">Shop Restricted</option>
              <option value="content_violation">Content Violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Violation Description */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Violation Description</label>
            <textarea
              name="violationDescription"
              value={formData.violationDescription}
              onChange={handleChange}
              placeholder="Describe the violation and any relevant details..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Appeal Deadline */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Appeal Deadline *</label>
            <input
              type="datetime-local"
              name="appealDeadline"
              value={formData.appealDeadline}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Total GMV */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Total GMV (Monthly)</label>
            <input
              type="number"
              name="totalGMV"
              value={formData.totalGMV}
              onChange={handleChange}
              placeholder="0"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Face Videos Posted */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Face Videos Posted</label>
            <input
              type="number"
              name="faceVideosPosted"
              value={formData.faceVideosPosted}
              onChange={handleChange}
              placeholder="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Commission Frozen */}
          <div className="mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="commissionFrozen"
                checked={formData.commissionFrozen}
                onChange={handleChange}
                className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-gray-900">Commission Frozen</span>
            </label>
          </div>

          {/* Account Purchase Date */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Account Purchase Date</label>
            <input
              type="date"
              name="accountPurchaseDate"
              value={formData.accountPurchaseDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Creating...' : 'Create Appeal'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

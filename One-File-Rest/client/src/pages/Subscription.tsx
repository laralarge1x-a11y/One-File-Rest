import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface Subscription {
  id: number;
  plan: string;
  status: string;
  created_at: string;
  expires_at: string;
  price: number;
}

export default function Subscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Subscription</h1>

        {subscription ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-gray-600 text-sm">Plan</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{subscription.plan}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{subscription.status}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Price</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">${subscription.price}/month</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Expires</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{new Date(subscription.expires_at).toLocaleDateString()}</p>
              </div>
            </div>

            <button className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition">
              Manage Subscription
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No active subscription</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition">
              Subscribe Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

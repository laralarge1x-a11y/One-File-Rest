import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface TimelineEvent {
  id: number;
  date: string;
  title: string;
  description: string;
  type: string;
}

export default function ViolationTimeline() {
  const { caseId } = useParams<{ caseId: string }>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;

    fetchTimeline();
  }, [caseId]);

  const fetchTimeline = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Parse timeline events from case data
        const timelineEvents: TimelineEvent[] = [
          {
            id: 1,
            date: data.created_at,
            title: 'Case Created',
            description: 'Appeal case was created',
            type: 'created',
          },
          {
            id: 2,
            date: data.appeal_deadline,
            title: 'Appeal Deadline',
            description: 'Deadline to submit appeal',
            type: 'deadline',
          },
        ];

        if (data.updated_at) {
          timelineEvents.push({
            id: 3,
            date: data.updated_at,
            title: 'Case Updated',
            description: 'Case information was updated',
            type: 'updated',
          });
        }

        setEvents(timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created':
        return 'bg-blue-500';
      case 'deadline':
        return 'bg-red-500';
      case 'updated':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Violation Timeline - Case {caseId}</h1>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="space-y-8">
            {events.map((event, index) => (
              <div key={event.id} className="flex gap-4">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full ${getEventColor(event.type)} border-4 border-white shadow`}></div>
                  {index < events.length - 1 && <div className="w-1 h-16 bg-gray-300 mt-2"></div>}
                </div>

                {/* Event content */}
                <div className="pb-8">
                  <p className="text-sm text-gray-500">{new Date(event.date).toLocaleString()}</p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{event.title}</h3>
                  <p className="text-gray-600 mt-2">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

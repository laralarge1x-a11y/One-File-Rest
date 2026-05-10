import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCase } from '../../hooks/queries/useCases';
import { Badge, Skeleton, Button } from '../../components/ui';
import { ArrowLeft, Clock, FileText, AlertTriangle, CheckCircle, RefreshCw, MessageSquare } from 'lucide-react';

interface TimelineEvent {
  id: number;
  date: string;
  title: string;
  description: string;
  type: string;
  icon?: React.ReactNode;
  color?: string;
}

const EVENT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  created: { icon: <FileText size={16} />, color: '#5865F2' },
  deadline: { icon: <Clock size={16} />, color: '#ED4245' },
  updated: { icon: <RefreshCw size={16} />, color: '#FEE75C' },
  message: { icon: <MessageSquare size={16} />, color: '#57F287' },
  status: { icon: <AlertTriangle size={16} />, color: '#FAA61A' },
  resolved: { icon: <CheckCircle size={16} />, color: '#57F287' },
};

export default function ViolationTimeline() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { data: caseData, isLoading } = useCase(caseId);

  const events: TimelineEvent[] = React.useMemo(() => {
    if (!caseData) return [];
    const list: TimelineEvent[] = [
      { id: 1, date: caseData.created_at, title: 'Case Created', description: 'Appeal case was created and assigned', type: 'created' },
    ];
    if (caseData.appeal_deadline) {
      list.push({
        id: 2, date: caseData.appeal_deadline, title: 'Appeal Deadline',
        description: 'Deadline to submit the appeal to TikTok', type: 'deadline',
      });
    }
    if (caseData.updated_at) {
      list.push({
        id: 3, date: caseData.updated_at, title: 'Case Updated',
        description: 'Case information was updated by staff', type: 'updated',
      });
    }
    if (caseData.outcome === 'won' || caseData.status === 'won') {
      list.push({
        id: 4, date: caseData.updated_at || caseData.created_at, title: 'Case Won',
        description: 'Appeal was successful!', type: 'resolved',
      });
    } else if (caseData.outcome === 'denied') {
      list.push({
        id: 4, date: caseData.updated_at || caseData.created_at, title: 'Case Denied',
        description: 'Appeal was not successful', type: 'status',
      });
    }
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [caseData]);

  return (
    <div className="page-wrap" style={{ maxWidth: 720 }}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ letterSpacing: -0.5 }}>
            Timeline {caseId && <span className="text-[var(--text-muted)]">· Case #{caseId}</span>}
          </h1>
          {caseData && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {caseData.violation_type || 'Appeal case'} · @{caseData.account_username}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6 pl-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton height={12} width={12} borderRadius="50%" />
              <div className="flex-1">
                <Skeleton height={14} width="30%" />
                <Skeleton height={12} width="60%" className="mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-bold">No timeline events</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Timeline will populate as your case progresses.</p>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--border)]" />
          <div className="space-y-6">
            {events.map((event, i) => {
              const meta = EVENT_META[event.type] || { icon: <FileText size={14} />, color: '#5865F2' };
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="relative"
                >
                  <div
                    className="absolute -left-8 top-1 w-[30px] h-[30px] rounded-full flex items-center justify-center border-2 z-10"
                    style={{
                      background: 'var(--bg-primary)',
                      borderColor: meta.color,
                      color: meta.color,
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div
                    className="rounded-[var(--radius-lg)] p-4 ml-2"
                    style={{
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${meta.color}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{event.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(event.date).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{event.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
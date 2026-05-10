import { useNavigate } from 'react-router-dom';
import { formatDate, getDaysUntil } from '../../lib/utils';
import { emojiForStatus, formatStatusLabel } from '@shared/stages';
import { Badge } from '../ui/badge';
import { Clock, Users, FileText, MessageSquare, ChevronRight } from 'lucide-react';

const PRIORITY_COLORS: Record<string, { color: string; bg: string }> = {
  critical: { color: '#ED4245', bg: 'rgba(237,66,69,0.12)' },
  high: { color: '#FAA61A', bg: 'rgba(250,166,26,0.12)' },
  normal: { color: '#5865F2', bg: 'rgba(88,101,242,0.12)' },
  low: { color: 'var(--text-muted)', bg: 'var(--bg-glass)' },
};

interface CaseCardProps {
  id: number;
  accountUsername: string;
  violationType: string;
  status: string;
  stage?: string;
  priority: string;
  appealDeadline: string;
  complianceScore: number;
  staffName?: string;
  evidenceCount?: number;
  unreadMessages?: number;
  updatedAt?: string;
}

export default function CaseCard({
  id,
  accountUsername,
  violationType,
  status,
  stage,
  priority,
  appealDeadline,
  complianceScore,
  staffName,
  evidenceCount = 0,
  unreadMessages = 0,
  updatedAt,
}: CaseCardProps) {
  const navigate = useNavigate();
  const daysRemaining = getDaysUntil(appealDeadline);
  const priColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal;

  return (
    <div
      onClick={() => navigate(`/cases/${id}`)}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--bg-glass)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.transform = 'scale(1.005)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{ height: 3, background: priColor.color }} />

      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 6px',
            background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text-muted)', fontFamily: 'monospace',
          }}>
            #{id}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              color: status === 'won' ? '#57F287' : status === 'denied' ? '#ED4245' : 'var(--text-muted)',
              background: status === 'won' ? 'rgba(87,242,135,0.12)' : status === 'denied' ? 'rgba(237,66,69,0.12)' : 'var(--bg-glass)',
            }}>
              {emojiForStatus(status)} {formatStatusLabel(status)}
            </span>
            {daysRemaining !== null && daysRemaining <= 3 && (
              <Badge variant="danger" size="sm"><Clock size={10} /> {daysRemaining}d</Badge>
            )}
          </div>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
          {violationType || 'Case'} · <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>@{accountUsername}</span>
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: priColor.bg, color: priColor.color,
          }}>
            {priority}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: complianceScore >= 70 ? 'rgba(87,242,135,0.12)' : complianceScore >= 50 ? 'rgba(254,231,92,0.12)' : 'rgba(237,66,69,0.12)',
            color: complianceScore >= 70 ? '#57F287' : complianceScore >= 50 ? '#FEE75C' : '#ED4245',
          }}>
            {complianceScore}% compliance
          </span>
          {daysRemaining !== null && daysRemaining > 3 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              color: 'var(--text-muted)', background: 'var(--bg-glass)',
            }}>
              <Clock size={10} /> {daysRemaining}d left
            </span>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
        }}>
          {staffName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <Users size={10} /> <span>{staffName}</span>
            </div>
          )}
          {evidenceCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <FileText size={10} /> <span>{evidenceCount} files</span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          {unreadMessages > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>
              <MessageSquare size={10} /> <span>{unreadMessages} unread</span>
            </div>
          )}
          {updatedAt && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(updatedAt)}</span>}
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </div>
  );
}

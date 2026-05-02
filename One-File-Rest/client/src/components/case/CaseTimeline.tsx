import React from 'react';
import { motion } from 'framer-motion';

export interface TimelineStage {
  stage_name: string;
  stage_status: 'pending' | 'active' | 'complete' | 'skipped' | string;
  completed_at?: string | null;
  created_at?: string | null;
  owner_name?: string | null;
  notes?: string | null;
}

const DEFAULT_STAGES = [
  'Submitted',
  'In Review',
  'Appeal Drafted',
  'Appeal Sent',
  'Awaiting TikTok',
  'Resolved',
];

const STATUS_TO_STAGE: Record<string, number> = {
  pending: 0,
  intake: 1,
  profile_built: 1,
  appeal_drafted: 2,
  appeal_submitted: 3,
  awaiting_tiktok: 4,
  response_received: 4,
  escalated: 4,
  won: 5,
  denied: 5,
  closed: 5,
};

function deriveStages(stages: TimelineStage[] | undefined, currentStatus?: string): TimelineStage[] {
  if (stages && stages.length > 0) return stages;
  const idx = STATUS_TO_STAGE[currentStatus || 'pending'] ?? 0;
  return DEFAULT_STAGES.map((name, i) => ({
    stage_name: name,
    stage_status: i < idx ? 'complete' : i === idx ? 'active' : 'pending',
  }));
}

const dotStyle = (status: string): React.CSSProperties => {
  if (status === 'complete') return { background: '#57F287', borderColor: '#57F287', boxShadow: '0 0 12px rgba(87,242,135,0.5)' };
  if (status === 'active') return { background: '#5865F2', borderColor: '#5865F2', boxShadow: '0 0 14px rgba(88,101,242,0.6)' };
  if (status === 'skipped') return { background: 'transparent', borderColor: '#444' };
  return { background: 'transparent', borderColor: 'var(--border, #2a2a2a)' };
};

interface Props {
  stages?: TimelineStage[];
  currentStatus?: string;
  orientation?: 'vertical' | 'horizontal';
  compact?: boolean;
}

export default function CaseTimeline({ stages, currentStatus, orientation = 'vertical', compact = false }: Props) {
  const items = deriveStages(stages, currentStatus);

  if (orientation === 'horizontal') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', overflowX: 'auto' }}>
        {items.map((s, i) => {
          const ds = dotStyle(s.stage_status);
          return (
            <React.Fragment key={s.stage_name + i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64, flexShrink: 0 }}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid', ...ds,
                  }}
                />
                <div style={{
                  marginTop: 6, fontSize: 10, fontWeight: 600,
                  color: s.stage_status === 'pending' ? 'var(--text-muted, #666)' : 'var(--text-primary, #fff)',
                  textAlign: 'center', maxWidth: 80, lineHeight: 1.2,
                }}>{s.stage_name}</div>
              </div>
              {i < items.length - 1 && (
                <div style={{
                  flex: 1, height: 2, minWidth: 16, borderRadius: 2,
                  background: items[i + 1].stage_status === 'complete' || items[i].stage_status === 'complete'
                    ? '#57F287' : 'var(--border, #2a2a2a)',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
      {items.map((s, i) => {
        const ds = dotStyle(s.stage_status);
        const isLast = i === items.length - 1;
        return (
          <motion.div
            key={s.stage_name + i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{ display: 'flex', gap: 12, position: 'relative' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid', ...ds, flexShrink: 0,
              }} />
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, marginTop: 4,
                  background: s.stage_status === 'complete' ? '#57F287' : 'var(--border, #2a2a2a)',
                  minHeight: compact ? 16 : 22,
                }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : compact ? 4 : 6 }}>
              <div style={{
                fontSize: compact ? 13 : 14, fontWeight: 600,
                color: s.stage_status === 'pending' ? 'var(--text-muted, #777)' : 'var(--text-primary, #fff)',
              }}>
                {s.stage_name}
                {s.stage_status === 'active' && (
                  <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(88,101,242,0.15)', color: '#5865F2', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Now</span>
                )}
              </div>
              {(s.completed_at || s.owner_name) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted, #666)', marginTop: 2 }}>
                  {s.completed_at && (
                    <>
                      {new Date(s.completed_at).toLocaleDateString()}
                      {' · '}
                      {new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  )}
                  {s.owner_name && (
                    <span style={{ marginLeft: s.completed_at ? 8 : 0 }}>by {s.owner_name}</span>
                  )}
                </div>
              )}
              {s.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', marginTop: 4 }}>{s.notes}</div>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

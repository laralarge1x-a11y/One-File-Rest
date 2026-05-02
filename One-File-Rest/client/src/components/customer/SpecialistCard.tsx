import React from 'react';

export interface Specialist {
  discord_id: string;
  name: string;
  role: string;
  bio?: string | null;
  languages?: string[];
  specialties?: string[];
  timezone?: string | null;
  discord_avatar?: string | null;
  online?: boolean;
  win_rate?: number | null;
  resolved_cases?: number;
  won_cases?: number;
  avg_resolution_hours?: number | null;
  favorited?: boolean;
}

export default function SpecialistCard({
  s, onFavorite, onMessage, compact,
}: {
  s: Specialist;
  onFavorite?: (s: Specialist) => void;
  onMessage?: (s: Specialist) => void;
  compact?: boolean;
}) {
  const avatarUrl = s.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${s.discord_id}/${s.discord_avatar}.png?size=64`
    : null;
  return (
    <div style={{
      background: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: compact ? 12 : 16,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={{ width: compact ? 40 : 56, height: compact ? 40 : 56, borderRadius: '50%', border: '2px solid var(--border)' }} />
        ) : (
          <div style={{
            width: compact ? 40 : 56, height: compact ? 40 : 56, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: compact ? 16 : 22,
          }}>{(s.name || '?').charAt(0).toUpperCase()}</div>
        )}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 12, height: 12, borderRadius: '50%',
          background: s.online ? '#57F287' : '#666',
          border: '2px solid var(--bg-primary, #07070F)',
          boxShadow: s.online ? '0 0 6px rgba(87,242,135,0.6)' : 'none',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {s.role.replace('_', ' ')} • {s.online ? 'online' : 'offline'}
              {s.timezone ? ` • ${s.timezone}` : ''}
            </div>
          </div>
          {onFavorite && (
            <button onClick={() => onFavorite(s)} title={s.favorited ? 'Unfavorite' : 'Favorite'} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: s.favorited ? '#FFD700' : 'var(--text-muted)', fontSize: 16,
            }}>{s.favorited ? '★' : '☆'}</button>
          )}
        </div>
        {!compact && s.bio && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{s.bio}</div>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          {typeof s.win_rate === 'number' && (
            <Stat label="Win rate" value={`${s.win_rate}%`} color="#57F287" />
          )}
          {typeof s.resolved_cases === 'number' && (
            <Stat label="Resolved" value={String(s.resolved_cases)} />
          )}
          {typeof s.avg_resolution_hours === 'number' && s.avg_resolution_hours > 0 && (
            <Stat label="Avg time" value={`${Math.round(s.avg_resolution_hours)}h`} />
          )}
        </div>
        {!compact && s.specialties && s.specialties.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {s.specialties.map((sp) => (
              <span key={sp} style={{
                padding: '2px 8px', fontSize: 10,
                background: 'rgba(88,101,242,0.15)', color: '#5865F2',
                borderRadius: 999, fontWeight: 600,
              }}>{sp}</span>
            ))}
          </div>
        )}
        {onMessage && (
          <button onClick={() => onMessage(s)} style={{
            marginTop: 10, padding: '6px 12px', fontSize: 12, fontWeight: 600,
            background: '#5865F2', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer',
          }}>Message</button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

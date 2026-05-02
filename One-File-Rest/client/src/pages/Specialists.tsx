import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import SpecialistCard, { Specialist } from '../components/customer/SpecialistCard';

export default function Specialists() {
  const { socket } = useSocket();
  const [list, setList] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'favorites'>('all');

  const load = () => {
    fetch('/api/staff-public', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then(setList)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return;
    const onPresence = (p: { discordId: string; online: boolean }) => {
      setList((prev) => prev.map((s) => s.discord_id === p.discordId ? { ...s, online: p.online } : s));
    };
    socket.on('presence:update', onPresence);
    return () => { socket.off('presence:update', onPresence); };
  }, [socket]);

  const favorite = async (s: Specialist) => {
    const method = s.favorited ? 'DELETE' : 'POST';
    await fetch(`/api/staff-public/${s.discord_id}/favorite`, { method, credentials: 'include' });
    setList((prev) => prev.map((x) => x.discord_id === s.discord_id ? { ...x, favorited: !x.favorited } : x));
  };

  const visible = list.filter((s) => filter === 'online' ? s.online : filter === 'favorites' ? s.favorited : true);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 100px', color: '#fff' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Your Specialists</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        The team standing by to recover your TikTok Shop access.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'online', 'favorites'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', borderRadius: 999,
            background: filter === f ? '#5865F2' : 'var(--bg-glass)',
            color: '#fff', border: '1px solid var(--border)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          No specialists match this filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {visible.map((s) => <SpecialistCard key={s.discord_id} s={s} onFavorite={favorite} />)}
        </div>
      )}
    </div>
  );
}

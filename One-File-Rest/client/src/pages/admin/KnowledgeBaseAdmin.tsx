import React, { useEffect, useState } from 'react';

interface Article {
  id: number;
  slug: string;
  title: string;
  category: string | null;
  body_md: string;
  tags: string[];
  published: boolean;
  view_count: number;
  updated_at: string;
}

export default function KnowledgeBaseAdmin() {
  const [list, setList] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);

  const load = () => fetch('/api/kb', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : []).then(setList);

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const body = JSON.stringify({
      slug: editing.slug,
      title: editing.title,
      category: editing.category,
      body_md: editing.body_md,
      tags: typeof editing.tags === 'string' ? (editing.tags as any).split(',').map((s: string) => s.trim()).filter(Boolean) : (editing.tags || []),
      published: editing.published !== false,
    });
    const r = editing.id
      ? await fetch(`/api/kb/${editing.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body })
      : await fetch('/api/kb', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body });
    if (r.ok) { setEditing(null); load(); }
    else { alert((await r.json()).error || 'Failed'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete article?')) return;
    await fetch(`/api/kb/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <div style={{ padding: 28, color: '#fff', minHeight: '100vh', background: '#0a0a0a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Knowledge Base</h1>
        <button onClick={() => setEditing({ published: true, tags: [] })} style={btn}>+ New Article</button>
      </div>

      {editing && (
        <div style={{ background: '#111', border: '1px solid #222', padding: 16, borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input placeholder="Slug (url-safe)" value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} style={inp} disabled={!!editing.id} />
            <input placeholder="Title" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={inp} />
            <input placeholder="Category" value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={inp} />
            <input placeholder="Tags (comma separated)" value={Array.isArray(editing.tags) ? editing.tags.join(', ') : (editing.tags as any) || ''} onChange={(e) => setEditing({ ...editing, tags: e.target.value as any })} style={inp} />
          </div>
          <textarea
            placeholder="Body (markdown)"
            value={editing.body_md || ''}
            onChange={(e) => setEditing({ ...editing, body_md: e.target.value })}
            rows={14}
            style={{ ...inp, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={editing.published !== false} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
              Published
            </label>
            <button onClick={save} style={btn}>Save</button>
            <button onClick={() => setEditing(null)} style={{ ...btn, background: '#333' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((a) => (
          <div key={a.id} style={{ background: '#111', border: '1px solid #222', padding: 14, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{a.title} {!a.published && <span style={{ fontSize: 10, color: '#F5A623' }}>(draft)</span>}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{a.category || 'uncategorized'} • {a.view_count} views • /kb/{a.slug}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(a)} style={{ ...btn, background: '#5865F2' }}>Edit</button>
              <button onClick={() => remove(a.id)} style={{ ...btn, background: 'transparent', border: '1px solid #ED4245', color: '#ED4245' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { padding: '8px 14px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#0a0a0a', border: '1px solid #222', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' };

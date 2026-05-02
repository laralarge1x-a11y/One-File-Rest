import React, { useEffect, useState, useCallback } from 'react';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '18px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px', display: 'block' },
};

const TEMPLATE_CATEGORIES = ['appeal', 'rejection', 'escalation', 'welcome', 'followup', 'notification', 'other'];
const CATEGORY_COLORS: Record<string, string> = {
  appeal: '#5865F2', rejection: '#ED4245', escalation: '#F5A623', welcome: '#57F287',
  followup: '#9B59B6', notification: '#00b4d8', other: '#666',
};

const VARIABLES = ['{account_username}', '{violation_type}', '{client_name}', '{case_id}', '{appeal_deadline}', '{plan_name}', '{staff_name}', '{decision}'];

export default function TemplateBuilder() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({ name: '', category: 'appeal', body: '', tags: '' });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/templates', { credentials: 'include' });
      if (r.ok) setTemplates(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filteredTemplates = templates.filter(t => {
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !(t.body || t.content || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const url = editMode && selectedTemplate ? `/api/templates/${selectedTemplate.id}` : '/api/templates';
      const method = editMode ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, category: form.category, body: form.body, tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) }),
      });
      if (r.ok) {
        await fetchTemplates();
        setShowForm(false);
        setEditMode(false);
        setSelectedTemplate(null);
        setForm({ name: '', category: 'appeal', body: '', tags: '' });
        setSaveMsg('✅ Template saved');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        const d = await r.json();
        setSaveMsg('❌ ' + (d.error || 'Save failed'));
      }
    } catch (e) { setSaveMsg('❌ Network error'); }
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE', credentials: 'include' });
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  const editTemplate = (t: any) => {
    setForm({ name: t.name, category: t.category || 'appeal', body: t.body || t.content || '', tags: (t.tags || []).join(', ') });
    setSelectedTemplate(t);
    setEditMode(true);
    setShowForm(true);
  };

  const enhanceWithAI = async () => {
    if (!form.body.trim()) return;
    setAiLoading(true);
    setAiMsg('');
    try {
      const r = await fetch('/api/ai/enhance-template', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_body: form.body, category: form.category }),
      });
      if (r.ok) {
        const d = await r.json();
        setForm(f => ({ ...f, body: d.enhanced || f.body }));
        setAiMsg('✅ Template enhanced by AI');
        setTimeout(() => setAiMsg(''), 4000);
      }
    } catch (e) { setAiMsg('❌ AI enhancement failed'); }
    setAiLoading(false);
  };

  const insertVariable = (variable: string) => {
    setForm(f => ({ ...f, body: f.body + variable }));
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
          Appeal Templates <span style={{ color: '#444', fontSize: '14px', fontWeight: '400' }}>({templates.length})</span>
        </h1>
        <button onClick={() => { setShowForm(true); setEditMode(false); setForm({ name: '', category: 'appeal', body: '', tags: '' }); }}
          style={{ ...S.btn, background: '#5865F2', color: '#fff' }}>+ New Template</button>
      </div>

      {saveMsg && !showForm && <div style={{ background: saveMsg.startsWith('✅') ? '#57F28720' : '#ED424520', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: saveMsg.startsWith('✅') ? '#57F287' : '#ED4245', marginBottom: '16px', border: `1px solid ${saveMsg.startsWith('✅') ? '#57F28740' : '#ED424540'}` }}>{saveMsg}</div>}

      {/* Create/Edit form */}
      {showForm && (
        <div style={{ ...S.card, marginBottom: '20px', border: '1px solid #5865F230', background: '#0d0d1a' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#5865F2', marginBottom: '16px' }}>{editMode ? '✏️ Edit Template' : '+ New Template'}</div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '12px' }}>
              <div>
                <label style={S.label}>Template Name *</label>
                <input style={S.input} placeholder="e.g. Product Violation Appeal Letter" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label style={S.label}>Category</label>
                <select style={S.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Tags (comma-separated)</label>
                <input style={S.input} placeholder="e.g. product, policy, appeal" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
            </div>

            {/* Variables palette */}
            <div>
              <label style={{ ...S.label, marginBottom: '6px' }}>Insert Variable</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {VARIABLES.map(v => (
                  <button type="button" key={v} onClick={() => insertVariable(v)}
                    style={{ background: '#1a1a2a', border: '1px solid #5865F230', color: '#5865F2', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}>{v}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...S.label, margin: 0 }}>Template Body *</label>
                <button type="button" onClick={enhanceWithAI} disabled={aiLoading || !form.body.trim()}
                  style={{ background: '#5865F220', border: '1px solid #5865F240', color: '#5865F2', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600', opacity: !form.body.trim() ? 0.5 : 1 }}>
                  {aiLoading ? '⏳ Enhancing...' : '🤖 AI Enhance'}
                </button>
              </div>
              {aiMsg && <div style={{ fontSize: '11px', color: aiMsg.startsWith('✅') ? '#57F287' : '#ED4245', marginBottom: '6px' }}>{aiMsg}</div>}
              <textarea
                style={{ ...S.input, resize: 'vertical', minHeight: '200px', lineHeight: '1.7', fontFamily: 'inherit' }}
                placeholder="Write your template here. Use {variable} placeholders for dynamic content."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving} style={{ ...S.btn, background: '#5865F2', color: '#fff', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : (editMode ? 'Update Template' : 'Create Template')}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditMode(false); }} style={{ ...S.btn, background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...S.card, marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="🔍 Search templates..." style={{ ...S.input, flex: '1', minWidth: '200px' }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...S.select, width: 'auto' }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {/* Template grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#444' }}>Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px', color: '#444' }}>No templates found. Create your first one!</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
          {filteredTemplates.map((t) => {
            const catColor = CATEGORY_COLORS[t.category] || '#666';
            return (
              <div key={t.id} style={{ ...S.card, cursor: 'pointer', borderTop: `3px solid ${catColor}`, transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ background: `${catColor}22`, color: catColor, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{t.category || 'appeal'}</span>
                      {t.use_count > 0 && <span style={{ background: '#1a1a1a', color: '#666', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>Used {t.use_count}×</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={(e) => { e.stopPropagation(); editTemplate(t); }}
                      style={{ background: '#1a1a2a', border: '1px solid #5865F230', color: '#5865F2', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}>✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                      style={{ background: '#1a0a0a', border: '1px solid #ED424530', color: '#ED4245', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
                <div style={{ color: '#888', fontSize: '12px', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {t.body || t.content || 'No content'}
                </div>
                {(t.tags || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {(t.tags || []).map((tag: string) => (
                      <span key={tag} style={{ background: '#1a1a1a', color: '#555', padding: '1px 7px', borderRadius: '4px', fontSize: '10px' }}>#{tag}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1a1a1a', fontSize: '11px' }}>
                  <button onClick={() => navigator.clipboard.writeText(t.body || t.content || '')}
                    style={{ background: 'none', border: 'none', color: '#5865F2', cursor: 'pointer', fontSize: '11px', padding: 0 }}>📋 Copy</button>
                  <span style={{ color: '#444' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

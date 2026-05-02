import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Item {
  id: number;
  case_id: number;
  stage: string;
  label: string;
  required: boolean;
  completed: boolean;
  completed_at?: string | null;
  evidence_id?: number | null;
}

const STAGES = ['Submitted', 'In Review', 'Appeal Drafted', 'Appeal Sent', 'Awaiting TikTok', 'Resolved'];

export default function DocumentChecklist({
  caseId,
  currentStage,
  canEdit = true,
}: {
  caseId: number;
  currentStage?: string;
  canEdit?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`/api/checklist/${caseId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { setItems(d || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const toggle = async (item: Item) => {
    if (!canEdit) return;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, completed: !i.completed } : i));
    await fetch(`/api/checklist/${item.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !item.completed }),
    }).catch(() => load());
  };

  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      if (!m.has(i.stage)) m.set(i.stage, []);
      m.get(i.stage)!.push(i);
    }
    return m;
  }, [items]);

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading checklist…</div>;
  if (items.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No checklist items yet.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {STAGES.map((stage) => {
        const list = grouped.get(stage);
        if (!list || list.length === 0) return null;
        const required = list.filter((i) => i.required);
        const requiredDone = required.filter((i) => i.completed).length;
        const all = list.filter((i) => i.completed).length;
        const isCurrent = currentStage === stage;
        const allRequired = requiredDone === required.length;

        return (
          <div key={stage} style={{
            border: '1px solid ' + (isCurrent ? '#5865F2' : 'var(--border)'),
            borderRadius: 'var(--radius-md)',
            padding: 12,
            background: isCurrent ? 'rgba(88,101,242,0.05)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{stage}</span>
                {isCurrent && <span style={{ fontSize: 9, color: '#5865F2', fontWeight: 700, padding: '2px 6px', background: 'rgba(88,101,242,0.15)', borderRadius: 4 }}>CURRENT</span>}
              </div>
              <span style={{ fontSize: 11, color: allRequired ? '#57F287' : 'var(--text-muted)' }}>
                {all}/{list.length} {allRequired ? '✓' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {list.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => toggle(item)}
                  whileTap={canEdit ? { scale: 0.98 } : undefined}
                  disabled={!canEdit}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 6,
                    background: item.completed ? 'rgba(87,242,135,0.05)' : 'transparent',
                    border: '1px solid ' + (item.completed ? 'rgba(87,242,135,0.2)' : 'transparent'),
                    cursor: canEdit ? 'pointer' : 'default',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: '2px solid ' + (item.completed ? '#57F287' : 'var(--border)'),
                    background: item.completed ? '#57F287' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {item.completed && <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 12,
                    color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: item.completed ? 'line-through' : 'none',
                  }}>
                    {item.label}
                    {item.required && <span style={{ color: '#ED4245', marginLeft: 4 }}>*</span>}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

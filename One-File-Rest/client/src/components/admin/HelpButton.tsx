import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Section = { title: string; items: Array<{ q: string; a: string }> };

const ADMIN_SECTIONS: Section[] = [
  {
    title: 'Stage Board',
    items: [
      { q: 'How does drag-and-drop work?', a: 'Drag any case card from one column to another. The status updates instantly, the customer is notified, and the move is recorded in the audit log.' },
      { q: 'Can I move several at once?', a: 'Hold ⌘ / Ctrl and click cards to select multiple, then drag any one — or use the bulk-move toolbar that appears at the top of the board.' },
      { q: 'What does "Needs my attention" do?', a: 'It surfaces cases with unread client messages, critical priority, an upcoming deadline assigned to you, or stuck in TikTok Replied / Needs Retry — regardless of column.' },
    ],
  },
  {
    title: 'Shortcuts',
    items: [
      { q: 'Cmd / Ctrl + K', a: 'Opens the command palette to jump to any page or search cases, clients, staff, articles, and templates.' },
      { q: '/ (forward slash)', a: 'Opens the command palette when not typing in a field.' },
      { q: 'ESC', a: 'Closes the command palette or any open modal.' },
    ],
  },
  {
    title: 'Saved Views',
    items: [
      { q: 'How do I save a view?', a: 'Set your filter chips on the Stage Board, then click "Save view" in the sidebar. Pinned views appear at the top of the sidebar for one-click access.' },
    ],
  },
];

const CUSTOMER_SECTIONS: Section[] = [
  {
    title: 'Your case',
    items: [
      { q: 'What do the stages mean?', a: 'Intake → Appeal Drafting → Appeal Sent → TikTok Replied → Resolved. The colored bar above each case shows where your appeal currently sits.' },
      { q: 'How do I message my specialist?', a: 'Open any case and use the Messages tab — replies sync to Discord and the portal in real time.' },
      { q: 'Where do I see all updates?', a: 'Your Dashboard groups cases by Action Required, Active, and Resolved so the most important items are always at the top.' },
    ],
  },
  {
    title: 'Shortcuts',
    items: [
      { q: 'Cmd / Ctrl + K', a: 'Opens search to jump to any case or page in the portal.' },
      { q: 'ESC', a: 'Closes search or any open modal.' },
    ],
  },
];

interface HelpButtonProps { scope?: 'admin' | 'customer' }

export default function HelpButton({ scope = 'admin' }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const sections = scope === 'customer' ? CUSTOMER_SECTIONS : ADMIN_SECTIONS;
  const kbHref = scope === 'customer' ? '/kb' : '/admin/kb';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Help & shortcuts (?)"
        aria-label="Help"
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 90,
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #5865F2, #7289DA)',
          color: '#fff', fontSize: 18, fontWeight: 700,
          border: 'none', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(88,101,242,0.45)',
        }}
      >?</button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: 'min(560px, 100%)', maxHeight: '80vh', overflowY: 'auto',
            background: '#101015', border: '1px solid #2a2a32', borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1a1a22' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>Help & shortcuts</div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
              {sections.map((s) => (
                <div key={s.title}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.08, color: '#5865F2', fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {s.items.map((it) => (
                      <div key={it.q}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{it.q}</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 3, lineHeight: 1.5 }}>{it.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setOpen(false); navigate(kbHref); }} style={primaryBtn}>Open Knowledge Base</button>
                {scope === 'customer' ? (
                  <button
                    onClick={() => { setOpen(false); navigate('/messages'); }}
                    style={secondaryBtn}
                  >Message my specialist</button>
                ) : (
                  <a href="mailto:support@elitetokclub.com" style={{ ...secondaryBtn, textDecoration: 'none', textAlign: 'center' }}>Email Support</a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const primaryBtn: React.CSSProperties = {
  flex: 1, padding: '10px 14px', borderRadius: 8,
  background: '#5865F2', color: '#fff', border: 'none',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '10px 14px', borderRadius: 8,
  background: '#1a1a22', color: '#ccc', border: '1px solid #2a2a32',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../components/customer/Toast';

interface Article {
  id: number;
  title: string;
  category: string | null;
  body_md: string;
  tags: string[];
  updated_at: string;
}

// Minimal markdown -> HTML
function md(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.+<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<)(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`);
}

export default function KbArticle() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    fetch(`/api/kb/${slug}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then(setArticle)
      .finally(() => setLoading(false));
  }, [slug]);

  const sendFeedback = async (helpful: boolean) => {
    if (!article) return;
    setFeedbackSent(true);
    await fetch(`/api/kb/${article.id}/feedback`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful }),
    });
    toast('Thanks for the feedback!', 'success');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  if (!article) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>Article not found</div>
      <Link to="/kb" style={{ color: '#5865F2' }}>← Back to Knowledge Base</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 100px', color: '#fff' }}>
      <Link to="/kb" style={{ color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none' }}>← All articles</Link>
      {article.category && (
        <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: '#5865F2', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {article.category}
        </div>
      )}
      <h1 style={{ fontSize: 30, fontWeight: 800, marginTop: 6, marginBottom: 8 }}>{article.title}</h1>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
        Updated {new Date(article.updated_at).toLocaleDateString()}
      </div>
      <div
        className="kb-article"
        style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}
        dangerouslySetInnerHTML={{ __html: md(article.body_md) }}
      />

      {!feedbackSent && (
        <div style={{ marginTop: 32, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600 }}>Was this helpful?</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => sendFeedback(true)} style={{ padding: '6px 14px', background: '#57F287', color: '#000', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>👍 Yes</button>
            <button onClick={() => sendFeedback(false)} style={{ padding: '6px 14px', background: 'transparent', color: '#ED4245', border: '1px solid #ED4245', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>👎 No</button>
          </div>
        </div>
      )}
      <style>{`
        .kb-article h1, .kb-article h2, .kb-article h3 { margin: 24px 0 12px; font-weight: 700; }
        .kb-article h1 { font-size: 22px; }
        .kb-article h2 { font-size: 18px; }
        .kb-article h3 { font-size: 16px; }
        .kb-article p { margin: 12px 0; }
        .kb-article ul { margin: 12px 0 12px 20px; }
        .kb-article li { margin: 4px 0; }
        .kb-article code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
        .kb-article a { color: #5865F2; }
      `}</style>
    </div>
  );
}

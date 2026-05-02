import React, { useEffect, useState, useCallback } from 'react';

interface Props {
  caseId: number | string;
  compact?: boolean;
  onUseReply?: (text: string) => void;
}

interface SummaryData {
  issue: string;
  done: string;
  nextAction: string;
  suggestedReply: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  generatedAt: string;
}

interface ApiSummaryResponse {
  summary?: string;
  text?: string;
  issue?: string;
  done?: string;
  next_action?: string;
  nextAction?: string;
  suggested_reply?: string;
  suggestedReply?: string;
  risk_level?: string;
  riskLevel?: string;
  recommendations?: string[];
  next_steps?: string[];
}

const cache = new Map<string, SummaryData>();

function extractSection(text: string, headings: string[]): string {
  // Look for "Heading: rest" or "Heading\n rest"
  for (const h of headings) {
    const re = new RegExp(`(?:^|\\n)\\s*(?:[*#\\-]+\\s*)?${h}\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:[*#\\-]+\\s*)?(?:Issue|Problem|Done|Progress|What we did|Next Action|Next step|Suggested Reply|Risk)\\s*[:\\-]|$)`, 'i');
    const m = text.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+\n/g, '\n').slice(0, 800);
  }
  return '';
}

function parseSummary(d: ApiSummaryResponse): SummaryData {
  const text = d.summary || d.text || '';
  const issue = d.issue || extractSection(text, ['Issue', 'Problem']);
  const done = d.done || extractSection(text, ['Done', 'Progress', 'What we did', 'What we have done']);
  const nextAction = d.next_action || d.nextAction || extractSection(text, ['Next Action', 'Next Step', 'Recommended Next Step']);
  const suggestedReply = d.suggested_reply || d.suggestedReply || extractSection(text, ['Suggested Reply', 'Reply', 'Suggested message']);
  let risk: SummaryData['riskLevel'] = 'unknown';
  const rawRisk = (d.risk_level || d.riskLevel || '').toLowerCase();
  if (rawRisk === 'critical' || rawRisk === 'high' || rawRisk === 'medium' || rawRisk === 'low') {
    risk = rawRisk;
  } else {
    const m = text.match(/risk\s*(?:level)?\s*[:\-]\s*(critical|high|medium|low)/i);
    if (m) risk = m[1].toLowerCase() as SummaryData['riskLevel'];
  }
  // Fallbacks if AI returned a free-form blob with no labels
  if (!issue && !done && !nextAction) {
    return {
      issue: text.slice(0, 400),
      done: '',
      nextAction: (d.recommendations || d.next_steps || []).slice(0, 3).join('\n'),
      suggestedReply: '',
      riskLevel: risk,
      generatedAt: new Date().toISOString(),
    };
  }
  return {
    issue, done, nextAction, suggestedReply,
    riskLevel: risk,
    generatedAt: new Date().toISOString(),
  };
}

export default function AISummaryPanel({ caseId, compact = false, onUseReply }: Props) {
  const [data, setData] = useState<SummaryData | null>(cache.get(String(caseId)) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/ai/case-summary', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: Number(caseId), structured: true }),
      });
      if (!r.ok) throw new Error('Failed to fetch summary');
      const raw: ApiSummaryResponse = await r.json();
      const parsed = parseSummary(raw);
      cache.set(String(caseId), parsed);
      setData(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load AI summary');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (!cache.has(String(caseId))) fetchSummary();
  }, [caseId, fetchSummary]);

  const copyReply = async () => {
    if (!data?.suggestedReply) return;
    try {
      await navigator.clipboard.writeText(data.suggestedReply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const riskColor =
    data?.riskLevel === 'critical' || data?.riskLevel === 'high' ? '#ED4245'
    : data?.riskLevel === 'medium' ? '#F5A623'
    : data?.riskLevel === 'low' ? '#57F287' : '#888';

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#9B59B6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: compact ? 12 : 13, color: 'var(--text-primary, #ddd)',
        lineHeight: 1.55, whiteSpace: 'pre-wrap',
      }}>{children}</div>
    </div>
  );

  return (
    <div style={{
      background: 'rgba(155,89,182,0.08)',
      border: '1px solid rgba(155,89,182,0.25)',
      borderRadius: 12,
      padding: compact ? 14 : 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }} aria-hidden>🤖</span>
          <span style={{ fontWeight: 700, fontSize: compact ? 12 : 13, color: '#9B59B6', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            AI Summary
          </span>
          {data?.riskLevel && data.riskLevel !== 'unknown' && (
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 4,
              background: `${riskColor}22`, color: riskColor, letterSpacing: 0.4,
            }}>{data.riskLevel} risk</span>
          )}
        </div>
        <button
          onClick={() => { cache.delete(String(caseId)); fetchSummary(); }}
          disabled={loading}
          title="Regenerate"
          style={{
            background: 'transparent', border: '1px solid rgba(155,89,182,0.3)',
            color: '#9B59B6', borderRadius: 6, fontSize: 11, padding: '3px 9px',
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {loading && !data && <div style={{ color: '#888', fontSize: 12 }}>Generating summary…</div>}
      {error && <div style={{ color: '#ED4245', fontSize: 12 }}>{error}</div>}

      {data && (
        <>
          {data.issue && <Section label="Issue">{data.issue}</Section>}
          {data.done && <Section label="Done">{data.done}</Section>}
          {data.nextAction && <Section label="Next Action">{data.nextAction}</Section>}
          {data.suggestedReply && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid rgba(155,89,182,0.18)' }}>
              <div style={{ fontSize: 10, color: '#9B59B6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                Suggested Reply
              </div>
              <div style={{
                fontSize: compact ? 12 : 13, color: 'var(--text-secondary, #ccc)',
                lineHeight: 1.55, whiteSpace: 'pre-wrap',
              }}>{data.suggestedReply}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {onUseReply && (
                  <button
                    onClick={() => onUseReply(data.suggestedReply)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                  >Send as reply</button>
                )}
                <button
                  onClick={copyReply}
                  style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', background: 'transparent', color: '#9B59B6', border: '1px solid rgba(155,89,182,0.4)', borderRadius: 5, cursor: 'pointer' }}
                >{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
          )}
          {data.generatedAt && (
            <div style={{ fontSize: 10, color: '#666', marginTop: 10, textAlign: 'right' }}>
              Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

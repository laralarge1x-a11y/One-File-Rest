import React, { useState } from 'react';

const S = {
  page: { padding: '28px', background: '#0a0a0a', minHeight: '100vh', color: '#fff' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' } as React.CSSProperties,
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  select: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%' } as React.CSSProperties,
  btn: { border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
  label: { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px', display: 'block' },
  result: { background: '#0a0a16', border: '1px solid #2a2a4a', borderRadius: '10px', padding: '16px', marginTop: '16px', position: 'relative' as const },
};

type Tab = 'appeal-writer' | 'violation-analyzer' | 'image-analyzer' | 'bulk-ranker' | 'policy-explainer';

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'appeal-writer', label: 'Appeal Writer', icon: '✍️', desc: 'Generate professional appeal letters' },
  { id: 'violation-analyzer', label: 'Violation Analyzer', icon: '🔍', desc: 'Analyze violations & get strategy' },
  { id: 'image-analyzer', label: 'Image Analyzer', icon: '🖼️', desc: 'Upload screenshot of violation notice for AI analysis' },
  { id: 'bulk-ranker', label: 'Bulk Case Ranker', icon: '📊', desc: 'AI-rank all pending cases by urgency' },
  { id: 'policy-explainer', label: 'Policy Explainer', icon: '📖', desc: 'Explain TikTok policies in plain language' },
];

const VIOLATION_TYPES = [
  'Product Policy Violation', 'Intellectual Property', 'Counterfeit Products', 'Prohibited Products',
  'Misleading Content', 'Community Guidelines', 'Copyright Infringement', 'Account Restriction',
  'Payment Issue', 'Shipping Policy', 'Product Quality', 'Safety Violation', 'Other',
];

function ResultBox({ result, label }: { result: string; label?: string }) {
  return (
    <div style={S.result}>
      {label && <div style={{ fontSize: '11px', color: '#5865F2', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{label}</div>}
      <pre style={{ color: '#ccc', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0, maxHeight: '400px', overflowY: 'auto' }}>{result}</pre>
      <button onClick={() => navigator.clipboard.writeText(result)}
        style={{ position: 'absolute', top: '12px', right: '12px', background: '#1a1a2a', border: '1px solid #5865F230', color: '#5865F2', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
        📋 Copy
      </button>
    </div>
  );
}

function AppealWriter() {
  const [form, setForm] = useState({ violation_type: '', platform: 'TikTok Shop', account_age: '', previous_violations: false, business_type: '', additional_context: '' });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setResult('');
    try {
      const r = await fetch('/api/ai/generate-appeal', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) setResult(d.draft || '');
      else setError(d.error || 'Failed');
    } catch (e) { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={S.label}>Violation Type</label>
          <select style={S.select} value={form.violation_type} onChange={(e) => setForm({ ...form, violation_type: e.target.value })}>
            <option value="">Select violation...</option>
            {VIOLATION_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Platform</label>
          <select style={S.select} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option value="TikTok Shop">TikTok Shop</option>
            <option value="TikTok">TikTok</option>
          </select>
        </div>
        <div>
          <label style={S.label}>Account Age</label>
          <input style={S.input} placeholder="e.g. 2 years, 6 months" value={form.account_age} onChange={(e) => setForm({ ...form, account_age: e.target.value })} />
        </div>
        <div>
          <label style={S.label}>Business Type</label>
          <input style={S.input} placeholder="e.g. clothing brand, electronics reseller" value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Additional Context</label>
          <textarea style={{ ...S.input, resize: 'vertical', minHeight: '80px', lineHeight: '1.6' }} placeholder="Any specific circumstances, sales history, or context to include..." value={form.additional_context} onChange={(e) => setForm({ ...form, additional_context: e.target.value })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="prevViol" checked={form.previous_violations} onChange={(e) => setForm({ ...form, previous_violations: e.target.checked })} style={{ width: 16, height: 16 }} />
          <label htmlFor="prevViol" style={{ ...S.label, margin: 0, cursor: 'pointer' }}>Has Previous Violations</label>
        </div>
      </div>

      <button onClick={generate} disabled={loading || !form.violation_type}
        style={{ ...S.btn, background: loading ? '#333' : '#5865F2', color: '#fff', marginTop: '16px', opacity: !form.violation_type ? 0.5 : 1 }}>
        {loading ? '⏳ Generating...' : '✍️ Generate Appeal Letter'}
      </button>

      {error && <div style={{ background: '#ED424520', border: '1px solid #ED424540', borderRadius: '8px', padding: '10px', color: '#ED4245', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
      {result && <ResultBox result={result} label="Generated Appeal Letter" />}
    </div>
  );
}

function ViolationAnalyzer() {
  const [form, setForm] = useState({ violation_type: '', violation_description: '', account_history: '' });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/ai/analyze-violation', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) setResult(d.analysis || d);
      else setError(d.error || 'Failed');
    } catch (e) { setError('Network error'); }
    setLoading(false);
  };

  const severityColor: Record<string, string> = { Critical: '#ED4245', High: '#F5A623', Medium: '#FEE75C', Low: '#57F287' };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={S.label}>Violation Type</label>
          <select style={S.select} value={form.violation_type} onChange={(e) => setForm({ ...form, violation_type: e.target.value })}>
            <option value="">Select violation...</option>
            {VIOLATION_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Violation Description</label>
          <textarea style={{ ...S.input, resize: 'vertical', minHeight: '80px', lineHeight: '1.6' }} placeholder="Describe the violation notice or situation in detail..." value={form.violation_description} onChange={(e) => setForm({ ...form, violation_description: e.target.value })} />
        </div>
        <div>
          <label style={S.label}>Account History (optional)</label>
          <input style={S.input} placeholder="e.g. 2 years old, $50k GMV, 500 products, clean record" value={form.account_history} onChange={(e) => setForm({ ...form, account_history: e.target.value })} />
        </div>
        <button onClick={analyze} disabled={loading || !form.violation_type}
          style={{ ...S.btn, background: loading ? '#333' : '#5865F2', color: '#fff', opacity: !form.violation_type ? 0.5 : 1 }}>
          {loading ? '⏳ Analyzing...' : '🔍 Analyze Violation'}
        </button>
      </div>

      {error && <div style={{ background: '#ED424520', border: '1px solid #ED424540', borderRadius: '8px', padding: '10px', color: '#ED4245', fontSize: '13px', marginTop: '12px' }}>{error}</div>}

      {result && !result.raw && (
        <div style={{ ...S.result }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Severity', value: result.severity, color: severityColor[result.severity] || '#666' },
              { label: 'Severity Score', value: `${result.severity_score}/10`, color: '#5865F2' },
              { label: 'Appeal Success Rate', value: result.appeal_success_rate, color: '#57F287' },
              { label: 'Timeline', value: result.timeline, color: '#FEE75C' },
            ].map(item => (
              <div key={item.label} style={{ background: '#111', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ color: item.color, fontWeight: '700', fontSize: '14px' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {result.policy_section && <div style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>📋 <strong style={{ color: '#ccc' }}>Policy:</strong> {result.policy_section}</div>}
          {result.recommended_strategy && <div style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>💡 <strong style={{ color: '#ccc' }}>Strategy:</strong> {result.recommended_strategy}</div>}
          {(result.key_arguments || []).length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Key Arguments</div>
              {result.key_arguments.map((a: string, i: number) => <div key={i} style={{ color: '#ccc', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>• {a}</div>)}
            </div>
          )}
          {(result.evidence_needed || []).length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Evidence Needed</div>
              {result.evidence_needed.map((e: string, i: number) => <div key={i} style={{ color: '#57F287', fontSize: '12px', padding: '4px 0' }}>✓ {e}</div>)}
            </div>
          )}
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
            style={{ position: 'absolute', top: '12px', right: '12px', background: '#1a1a2a', border: '1px solid #5865F230', color: '#5865F2', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
            📋 Copy JSON
          </button>
        </div>
      )}
      {result?.raw && <ResultBox result={result.raw} label="Analysis" />}
    </div>
  );
}

function BulkRanker() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setRankings([]);
    try {
      const r = await fetch('/api/ai/bulk-analyze', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (r.ok) { setRankings(d.rankings || []); setTotal(d.total_analyzed || 0); }
      else setError(d.error || 'Failed');
    } catch (e) { setError('Network error'); }
    setLoading(false);
  };

  const urgencyColor: Record<string, string> = { Critical: '#ED4245', High: '#F5A623', Medium: '#FEE75C', Low: '#57F287' };

  return (
    <div>
      <div style={{ background: '#0d0d1a', border: '1px solid #5865F230', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.6' }}>
          This tool analyzes all <strong style={{ color: '#fff' }}>pending/open cases</strong> and ranks them by urgency, deadline, and violation severity. Run it to prioritize your team's workload.
        </div>
      </div>

      <button onClick={run} disabled={loading}
        style={{ ...S.btn, background: loading ? '#333' : '#5865F2', color: '#fff', marginBottom: '20px' }}>
        {loading ? '⏳ Analyzing all pending cases...' : '📊 Run Bulk Case Analysis'}
      </button>

      {error && <div style={{ background: '#ED424520', border: '1px solid #ED424540', borderRadius: '8px', padding: '10px', color: '#ED4245', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
      {total > 0 && <div style={{ color: '#666', fontSize: '12px', marginBottom: '14px' }}>Analyzed {total} case(s)</div>}

      {rankings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rankings.map((r, i) => {
            const uc = urgencyColor[r.urgency] || '#666';
            return (
              <div key={r.case_id || i} style={{ background: '#111', border: `1px solid ${uc}33`, borderRadius: '10px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${uc}22`, border: `2px solid ${uc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: uc, fontSize: '14px', flexShrink: 0 }}>
                  {r.priority_rank || i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Case #{r.case_id}</span>
                    <span style={{ background: `${uc}22`, color: uc, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{r.urgency}</span>
                    <span style={{ color: '#555', fontSize: '11px' }}>~{r.estimated_hours}h estimated</span>
                  </div>
                  <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '4px' }}><strong>Action:</strong> {r.recommended_action}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{r.reason}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ImageAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onPick = (f: File | null) => {
    setFile(f); setResult(null); setError('');
    if (!f) { setPreview(''); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const r = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type || 'image/png' }),
      });
      const d = await r.json();
      if (r.ok) setResult(d.analysis || d);
      else setError(d.error || 'Failed');
    } catch (e: any) { setError(e?.message || 'Network error'); }
    setLoading(false);
  };

  const severityColor: Record<string, string> = {
    Critical: '#ED4245', High: '#F5A623', Medium: '#FEE75C', Low: '#57F287',
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={S.label}>Upload Violation Notice Screenshot</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
            style={{ ...S.input, padding: '8px', cursor: 'pointer' }}
          />
        </div>
        {preview && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '6px' }} />
          </div>
        )}
        <button onClick={analyze} disabled={loading || !file}
          style={{ ...S.btn, background: loading ? '#333' : '#5865F2', color: '#fff', opacity: !file ? 0.5 : 1 }}>
          {loading ? '⏳ Analyzing image...' : '🖼️ Analyze Image'}
        </button>
      </div>

      {error && <div style={{ background: '#ED424520', border: '1px solid #ED424540', borderRadius: '8px', padding: '10px', color: '#ED4245', fontSize: '13px', marginTop: '12px' }}>{error}</div>}

      {result && (
        <div style={S.result}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: '#111', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Severity</div>
              <div style={{ color: severityColor[result.severity] || '#666', fontWeight: '700', fontSize: '14px' }}>{result.severity || '—'}</div>
            </div>
            <div style={{ background: '#111', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Appeal Likelihood</div>
              <div style={{ color: '#57F287', fontWeight: '700', fontSize: '14px' }}>{result.appeal_likelihood || '—'}</div>
            </div>
          </div>
          {result.detected && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>What Was Detected</div>
              <div style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.6 }}>{result.detected}</div>
            </div>
          )}
          {result.policy_section && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Policy Section</div>
              <div style={{ color: '#FEE75C', fontSize: '13px', lineHeight: 1.6 }}>📋 {result.policy_section}</div>
            </div>
          )}
          {result.recommendation && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Recommended Next Step</div>
              <div style={{ color: '#57F287', fontSize: '13px', lineHeight: 1.6 }}>💡 {result.recommendation}</div>
            </div>
          )}
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
            style={{ position: 'absolute', top: '12px', right: '12px', background: '#1a1a2a', border: '1px solid #5865F230', color: '#5865F2', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
            📋 Copy JSON
          </button>
        </div>
      )}
    </div>
  );
}

function PolicyExplainer() {
  const [form, setForm] = useState({ violation_type: '', policy_text: '' });
  const [result, setResult] = useState('');
  const [affectedCases, setAffectedCases] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const explain = async () => {
    setLoading(true); setError(''); setResult(''); setAffectedCases(null);
    try {
      const r = await fetch('/api/ai/policy-explainer', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) { setResult(d.explanation || ''); setAffectedCases(d.affected_cases ?? null); }
      else setError(d.error || 'Failed');
    } catch (e) { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={S.label}>Violation Type (for database lookup)</label>
          <select style={S.select} value={form.violation_type} onChange={(e) => setForm({ ...form, violation_type: e.target.value })}>
            <option value="">Select type...</option>
            {VIOLATION_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Or paste policy text directly (optional)</label>
          <textarea style={{ ...S.input, resize: 'vertical', minHeight: '100px', lineHeight: '1.6' }} placeholder="Paste TikTok policy text here for detailed explanation..." value={form.policy_text} onChange={(e) => setForm({ ...form, policy_text: e.target.value })} />
        </div>
        <button onClick={explain} disabled={loading || (!form.violation_type && !form.policy_text.trim())}
          style={{ ...S.btn, background: loading ? '#333' : '#5865F2', color: '#fff', opacity: (!form.violation_type && !form.policy_text.trim()) ? 0.5 : 1 }}>
          {loading ? '⏳ Explaining...' : '📖 Explain Policy'}
        </button>
      </div>

      {error && <div style={{ background: '#ED424520', border: '1px solid #ED424540', borderRadius: '8px', padding: '10px', color: '#ED4245', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
      {affectedCases !== null && (
        <div style={{ background: '#5865F220', border: '1px solid #5865F240', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#5865F2', marginTop: '12px' }}>
          📊 <strong>{affectedCases}</strong> case(s) in your database match this violation type
        </div>
      )}
      {result && <ResultBox result={result} label="Policy Explanation" />}
    </div>
  );
}

export default function AITools() {
  const [activeTab, setActiveTab] = useState<Tab>('appeal-writer');
  const tab = TABS.find(t => t.id === activeTab)!;

  return (
    <div style={S.page}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 6px' }}>AI Tools</h1>
      <p style={{ color: '#555', fontSize: '13px', margin: '0 0 24px' }}>Powered by Groq — ultra-fast AI assistance for your case management workflow</p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ ...S.btn, background: activeTab === t.id ? '#5865F2' : '#1a1a1a', color: activeTab === t.id ? '#fff' : '#666', border: `1px solid ${activeTab === t.id ? '#5865F2' : '#333'}`, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{tab.icon}</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px' }}>{tab.label}</div>
              <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>{tab.desc}</div>
            </div>
          </div>
        </div>

        {activeTab === 'appeal-writer' && <AppealWriter />}
        {activeTab === 'violation-analyzer' && <ViolationAnalyzer />}
        {activeTab === 'image-analyzer' && <ImageAnalyzer />}
        {activeTab === 'bulk-ranker' && <BulkRanker />}
        {activeTab === 'policy-explainer' && <PolicyExplainer />}
      </div>
    </div>
  );
}

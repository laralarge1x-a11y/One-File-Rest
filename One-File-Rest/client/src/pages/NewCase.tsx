import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard, useToast } from '../components/customer';
import { useAuth } from '../hooks/useAuth';

const VIOLATION_TYPES = [
  { value: 'banned_account',    label: 'Banned Account',    icon: '🚫' },
  { value: 'suspended_account', label: 'Suspended Account', icon: '⏸️' },
  { value: 'commission_frozen', label: 'Commission Frozen', icon: '🧊' },
  { value: 'shop_restricted',   label: 'Shop Restricted',   icon: '🛒' },
  { value: 'content_violation', label: 'Content Violation', icon: '⚠️' },
  { value: 'other',             label: 'Other',             icon: '❓' },
];

const PLANS = [
  {
    value: 'basic_guard',
    name: 'Basic Guard',
    price: 49,
    cadence: 'one-time',
    color: '#5865F2',
    features: ['Single appeal handled by our team', 'Discord support during business hours', 'Basic compliance scan'],
    recommended: false,
  },
  {
    value: 'fortnightly_defense',
    name: 'Fortnightly Defense',
    price: 99,
    cadence: '/ 2 weeks',
    color: '#57F287',
    features: ['Up to 3 appeals per cycle', 'Priority Discord support', 'Weekly compliance reports', 'AI-drafted appeals'],
    recommended: true,
  },
  {
    value: 'proshield_creator',
    name: 'ProShield Creator',
    price: 249,
    cadence: '/ month',
    color: '#FFD700',
    features: ['Unlimited appeals', 'Dedicated case manager', 'Real-time policy alerts', 'Account audit & coaching', 'White-glove onboarding'],
    recommended: false,
  },
  {
    value: 'choose_later',
    name: "I'll choose later",
    price: 0,
    cadence: 'free intake',
    color: '#888888',
    features: ['Submit your case now', 'Pick a plan after our team reviews it', 'No charge until you confirm a plan'],
    recommended: false,
  },
];

interface ViolationItem {
  files: { id: string; name: string; size: number; dataUrl: string; type: string }[];
  description: string;
}

interface WizardData {
  // step 1
  accountUsername: string;
  violationType: string;
  appealDeadline: string;
  violationCount: number;
  violations: ViolationItem[];
  // step 2 - purchase
  purchase: {
    wasPurchased: boolean | null;
    accountPurchaseDate: string;
    changesMade: string;
    timeAfterPurchase: string;
  };
  // step 3 - prior appeals
  previousAppeals: {
    appealedBefore: boolean | null;
    previousScript: string;
  };
  // step 4 - verification
  verification: {
    verifiedBySelf: boolean | null;
    notes: string;
  };
  // step 5 - metrics
  metrics: {
    faceVideos: number;
    totalGMV: number;
    commissionFrozenAmount: number;
    accountsUnderDocs: number;
  };
  // step 6 - plan
  selectedPlan: string;
}

const STORAGE_KEY = 'newcase-wizard-v2';

const empty = (): WizardData => ({
  accountUsername: '', violationType: '', appealDeadline: '',
  violationCount: 1,
  violations: [{ files: [], description: '' }],
  purchase: { wasPurchased: null, accountPurchaseDate: '', changesMade: '', timeAfterPurchase: '' },
  previousAppeals: { appealedBefore: null, previousScript: '' },
  verification: { verifiedBySelf: null, notes: '' },
  metrics: { faceVideos: 0, totalGMV: 0, commissionFrozenAmount: 0, accountsUnderDocs: 0 },
  selectedPlan: '',
});

const STEPS = [
  { key: 'violations', label: 'Violations' },
  { key: 'purchase',   label: 'Purchase' },
  { key: 'appeals',    label: 'Prior Appeals' },
  { key: 'verify',     label: 'Verification' },
  { key: 'metrics',    label: 'Metrics' },
  { key: 'plan',       label: 'Plan' },
  { key: 'review',     label: 'Review' },
];

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function NewCase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const currentPlan = user?.plan || null;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<WizardData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...empty(), ...JSON.parse(raw) };
    } catch {}
    return empty();
  });

  // Autosave (strip large screenshot data URLs — they're transient and can
  // easily blow past the localStorage 5–10MB quota, which would silently
  // stop autosave for the rest of the wizard).
  useEffect(() => {
    try {
      const safe = {
        ...data,
        violations: data.violations.map((v) => ({
          ...v,
          files: v.files.map(({ id, name, size, type }) => ({
            id, name, size, type, dataUrl: '',
          })),
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch { /* quota exceeded — autosave skipped */ }
  }, [data]);

  const update = <K extends keyof WizardData>(k: K, v: WizardData[K]) => setData((d) => ({ ...d, [k]: v }));
  const updateNested = <G extends 'purchase' | 'previousAppeals' | 'verification' | 'metrics'>(
    group: G, patch: Partial<WizardData[G]>,
  ) => setData((d) => ({ ...d, [group]: { ...d[group], ...patch } }));

  const setViolationCount = (n: number) => {
    const count = Math.max(1, Math.min(10, n));
    setData((d) => {
      const next = [...d.violations];
      while (next.length < count) next.push({ files: [], description: '' });
      while (next.length > count) next.pop();
      return { ...d, violationCount: count, violations: next };
    });
  };

  const updateViolation = (i: number, patch: Partial<ViolationItem>) => {
    setData((d) => {
      const next = [...d.violations];
      next[i] = { ...next[i], ...patch };
      return { ...d, violations: next };
    });
  };

  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB per file (data-URL + JSON envelope must fit server's 10 MB limit)
  const addFiles = async (i: number, list: File[]) => {
    const accepted = list.filter((f) => f.size <= MAX_UPLOAD_BYTES).slice(0, 8);
    if (list.some((f) => f.size > MAX_UPLOAD_BYTES)) toast('A file exceeded the 4 MB upload limit', 'error');
    const converted = await Promise.all(accepted.map(async (f) => ({
      id: `${Date.now()}-${f.name}-${Math.random()}`,
      name: f.name, size: f.size, type: f.type,
      dataUrl: await fileToDataUrl(f),
    })));
    updateViolation(i, { files: [...data.violations[i].files, ...converted].slice(0, 8) });
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!data.accountUsername.trim()) e.accountUsername = 'Required';
      if (!data.violationType) e.violationType = 'Pick a violation type';
      if (!data.appealDeadline) e.appealDeadline = 'Required';
      data.violations.forEach((v, i) => {
        if (!v.description.trim()) e[`v${i}_desc`] = 'Describe this violation';
      });
    }
    if (s === 1 && data.purchase.wasPurchased === null) e.wasPurchased = 'Please answer';
    if (s === 2 && data.previousAppeals.appealedBefore === null) e.appealedBefore = 'Please answer';
    if (s === 3 && data.verification.verifiedBySelf === null) e.verifiedBySelf = 'Please answer';
    if (s === 5 && !data.selectedPlan) e.selectedPlan = 'Choose a plan to continue';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!validate(0)) { setStep(0); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/cases', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountUsername: data.accountUsername,
          violationType: data.violationType,
          violationDescription: data.violations.map((v, i) => `Violation ${i + 1}: ${v.description}`).join('\n\n'),
          appealDeadline: data.appealDeadline,
          totalGMV: data.metrics.totalGMV || 0,
          faceVideosPosted: data.metrics.faceVideos || 0,
          commissionFrozen: (data.metrics.commissionFrozenAmount || 0) > 0,
          commissionFrozenAmount: data.metrics.commissionFrozenAmount || 0,
          accountPurchaseDate: data.purchase.accountPurchaseDate || null,
          selectedPlan: data.selectedPlan || null,
          wizard: {
            ...data,
            violations: data.violations.map((v) => ({
              description: v.description,
              screenshots: v.files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
            })),
          },
        }),
      });
      if (!r.ok) throw new Error('Failed to create case');
      const newCase = await r.json();

      // Upload screenshots as evidence (data URLs). Surface failures so files
      // are not silently dropped — file storage is a known follow-up.
      const allFiles = data.violations.flatMap((v, vi) => v.files.map((f) => ({ ...f, vi })));
      const results = await Promise.all(allFiles.map(async (f) => {
        try {
          const ev = await fetch('/api/evidence', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              case_id: newCase.id,
              file_url: f.dataUrl,
              file_name: f.name,
              file_type: f.type,
              description: `Violation ${f.vi + 1} screenshot`,
            }),
          });
          return { ok: ev.ok, name: f.name };
        } catch {
          return { ok: false, name: f.name };
        }
      }));
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        toast(`${failed.length} of ${results.length} screenshot(s) failed to upload: ${failed.map((f) => f.name).join(', ')}`, 'error');
      }

      setSuccess(true);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      toast('Case submitted successfully', 'success');
      setTimeout(() => navigate(`/cases/${newCase.id}`), 1100);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create case', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrap" style={{ maxWidth: 820 }}>
      <button onClick={() => navigate('/dashboard')} style={{
        marginBottom: 18, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
      }}>← Back to Dashboard</button>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Submit a New Case</h1>
      <p style={{ margin: '6px 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Walk us through the violation. Your progress saves automatically.
      </p>

      <GlassCard noHover style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
          {STEPS.map((s, i) => {
            const active = i === step, done = i < step || success;
            return (
              <React.Fragment key={s.key}>
                <button onClick={() => i < step && setStep(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                  background: 'transparent', border: 'none', cursor: i < step ? 'pointer' : 'default',
                  padding: 4,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-glass)',
                    border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: (done || active) ? '#fff' : 'var(--text-muted)',
                  }}>{done ? '✓' : i + 1}</div>
                  <span className="step-label" style={{
                    fontSize: 12, fontWeight: 600,
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, minWidth: 12, background: i < step ? 'var(--success)' : 'var(--border)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <style>{`@media (max-width: 640px) { .step-label { display: none; } }`}</style>
      </GlassCard>

      <GlassCard noHover style={{ padding: 24, minHeight: 400 }}>
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && (
              <Section title="Violation Details" subtitle="Tell us about your TikTok account and what happened.">
                <Field label="TikTok Account Username *" error={errors.accountUsername}>
                  <input className="field" value={data.accountUsername}
                    onChange={(e) => update('accountUsername', e.target.value)}
                    placeholder="@username" />
                </Field>
                <Field label="Violation Type *" error={errors.violationType}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    {VIOLATION_TYPES.map((v) => {
                      const active = data.violationType === v.value;
                      return (
                        <button key={v.value} type="button" onClick={() => update('violationType', v.value)} style={{
                          padding: '10px 14px', borderRadius: 10,
                          background: active ? 'rgba(88,101,242,0.15)' : 'var(--bg-glass)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                          color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                        }}>
                          <span style={{ fontSize: 18 }}>{v.icon}</span>{v.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Appeal Deadline *" error={errors.appealDeadline}>
                  <input className="field" type="datetime-local" value={data.appealDeadline}
                    onChange={(e) => update('appealDeadline', e.target.value)} />
                </Field>
                <Field label="Number of Violations">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => setViolationCount(data.violationCount - 1)} className="btn-ghost" style={{ width: 38, height: 38 }}>−</button>
                    <div style={{ minWidth: 50, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>{data.violationCount}</div>
                    <button type="button" onClick={() => setViolationCount(data.violationCount + 1)} className="btn-ghost" style={{ width: 38, height: 38 }}>+</button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>(1–10)</span>
                  </div>
                </Field>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
                  {data.violations.map((v, i) => (
                    <ViolationBlock key={i} index={i} value={v}
                      error={errors[`v${i}_desc`]}
                      onChange={(p) => updateViolation(i, p)}
                      onAddFiles={(files) => addFiles(i, files)}
                      onRemoveFile={(fid) => updateViolation(i, { files: v.files.filter((f) => f.id !== fid) })}
                    />
                  ))}
                </div>
              </Section>
            )}

            {step === 1 && (
              <Section title="Purchase Information" subtitle="Was this account purchased, or did you build it yourself?">
                <YesNo label="Was this account purchased?" value={data.purchase.wasPurchased} error={errors.wasPurchased}
                  onChange={(b) => updateNested('purchase', { wasPurchased: b })} />
                {data.purchase.wasPurchased && (
                  <>
                    <Field label="Date of Purchase">
                      <input className="field" type="date" value={data.purchase.accountPurchaseDate}
                        onChange={(e) => updateNested('purchase', { accountPurchaseDate: e.target.value })} />
                    </Field>
                    <Field label="Time on Account After Purchase">
                      <input className="field" placeholder="e.g. 6 months" value={data.purchase.timeAfterPurchase}
                        onChange={(e) => updateNested('purchase', { timeAfterPurchase: e.target.value })} />
                    </Field>
                    <Field label="Changes Made to the Account">
                      <textarea className="field" rows={4} placeholder="Describe niche changes, content style changes, etc."
                        value={data.purchase.changesMade}
                        onChange={(e) => updateNested('purchase', { changesMade: e.target.value })} />
                    </Field>
                  </>
                )}
              </Section>
            )}

            {step === 2 && (
              <Section title="Previous Appeals" subtitle="Have you already tried to appeal this violation?">
                <YesNo label="Have you appealed this before?" value={data.previousAppeals.appealedBefore} error={errors.appealedBefore}
                  onChange={(b) => updateNested('previousAppeals', { appealedBefore: b })} />
                {data.previousAppeals.appealedBefore && (
                  <Field label="Previous Appeal — what did you say?">
                    <textarea className="field" rows={6} placeholder="Paste the appeal you submitted, or summarize it..."
                      value={data.previousAppeals.previousScript}
                      onChange={(e) => updateNested('previousAppeals', { previousScript: e.target.value })} />
                  </Field>
                )}
              </Section>
            )}

            {step === 3 && (
              <Section title="Account Verification" subtitle="Has TikTok verified your identity on this account?">
                <YesNo label="Have you verified the account with TikTok yourself?"
                  value={data.verification.verifiedBySelf} error={errors.verifiedBySelf}
                  onChange={(b) => updateNested('verification', { verifiedBySelf: b })} />
                <Field label="Notes (optional)">
                  <textarea className="field" rows={3} placeholder="Any context about ID verification, document state, etc."
                    value={data.verification.notes}
                    onChange={(e) => updateNested('verification', { notes: e.target.value })} />
                </Field>
              </Section>
            )}

            {step === 4 && (
              <Section title="Account Metrics" subtitle="Help us prioritize and craft the strongest appeal.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <Field label="Number of Face Videos Posted">
                    <input className="field" type="number" min={0} value={data.metrics.faceVideos}
                      onChange={(e) => updateNested('metrics', { faceVideos: parseInt(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Total GMV (USD, monthly)">
                    <input className="field" type="number" min={0} value={data.metrics.totalGMV}
                      onChange={(e) => updateNested('metrics', { totalGMV: parseFloat(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Accounts Currently Under Documents">
                    <input className="field" type="number" min={0} value={data.metrics.accountsUnderDocs}
                      onChange={(e) => updateNested('metrics', { accountsUnderDocs: parseInt(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Commission Frozen (USD amount)">
                    <input className="field" type="number" min={0} step="0.01"
                      placeholder="0 if commission is not frozen"
                      value={data.metrics.commissionFrozenAmount}
                      onChange={(e) => updateNested('metrics', { commissionFrozenAmount: parseFloat(e.target.value) || 0 })} />
                  </Field>
                </div>
              </Section>
            )}

            {step === 5 && (
              <Section title="Choose Your Plan" subtitle="Pick the package that matches your needs. You can change later from settings.">
                {currentPlan && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(87,242,135,0.08)', border: '1px solid rgba(87,242,135,0.3)',
                    color: 'var(--text-primary)', fontSize: 13, display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                  }}>
                    <span>
                      <strong style={{ color: '#57F287' }}>Current plan:</strong>{' '}
                      {PLANS.find((p) => p.value === currentPlan)?.name || currentPlan}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      Your selection here only flags this case — it won't change your active plan.
                    </span>
                  </div>
                )}
                {errors.selectedPlan && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{errors.selectedPlan}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  {PLANS.map((p) => {
                    const active = data.selectedPlan === p.value;
                    const isCurrent = currentPlan === p.value;
                    return (
                      <button key={p.value} type="button" onClick={() => update('selectedPlan', p.value)}
                        style={{
                          textAlign: 'left', padding: 18, borderRadius: 14,
                          background: active ? `${p.color}14` : 'var(--bg-glass)',
                          border: `2px solid ${active ? p.color : 'var(--border)'}`,
                          position: 'relative', cursor: 'pointer',
                          transition: 'var(--transition)',
                        }}>
                        {p.recommended && !isCurrent && (
                          <div style={{
                            position: 'absolute', top: -10, right: 14,
                            background: p.color, color: '#000', fontSize: 10, fontWeight: 800,
                            padding: '3px 10px', borderRadius: 999, letterSpacing: 0.4,
                          }}>RECOMMENDED</div>
                        )}
                        {isCurrent && (
                          <div style={{
                            position: 'absolute', top: -10, right: 14,
                            background: '#57F287', color: '#000', fontSize: 10, fontWeight: 800,
                            padding: '3px 10px', borderRadius: 999, letterSpacing: 0.4,
                          }}>YOUR PLAN</div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{p.name}</div>
                        <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>${p.price}<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>{p.cadence}</span></div>
                        <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {p.features.map((f) => (
                            <li key={f} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                              <span style={{ color: p.color }}>✓</span>{f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { update('selectedPlan', 'choose_later'); setStep(6); }}
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--text-muted)',
                      fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >Skip for now — I'll choose later</button>
                </div>
              </Section>
            )}

            {step === 6 && (
              <Section title="Review & Submit" subtitle="One last check before we kick off your case.">
                <ReviewRow label="Account" value={`@${data.accountUsername}`} edit={() => setStep(0)} />
                <ReviewRow label="Violation" value={VIOLATION_TYPES.find((v) => v.value === data.violationType)?.label || '—'} edit={() => setStep(0)} />
                <ReviewRow label="Deadline" value={data.appealDeadline ? new Date(data.appealDeadline).toLocaleString() : '—'} edit={() => setStep(0)} />
                <ReviewRow label="# of Violations" value={String(data.violationCount)} edit={() => setStep(0)} />
                <ReviewRow label="Total Screenshots" value={String(data.violations.reduce((a, v) => a + v.files.length, 0))} edit={() => setStep(0)} />
                <ReviewRow label="Purchased?" value={data.purchase.wasPurchased == null ? '—' : data.purchase.wasPurchased ? 'Yes' : 'No'} edit={() => setStep(1)} />
                <ReviewRow label="Appealed Before?" value={data.previousAppeals.appealedBefore == null ? '—' : data.previousAppeals.appealedBefore ? 'Yes' : 'No'} edit={() => setStep(2)} />
                <ReviewRow label="Verified by Self?" value={data.verification.verifiedBySelf == null ? '—' : data.verification.verifiedBySelf ? 'Yes' : 'No'} edit={() => setStep(3)} />
                <ReviewRow label="Total GMV" value={`$${data.metrics.totalGMV.toLocaleString()}`} edit={() => setStep(4)} />
                <ReviewRow label="Plan" value={PLANS.find((p) => p.value === data.selectedPlan)?.name || 'Not selected'} edit={() => setStep(5)} />

                {success && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ marginTop: 20, padding: 20, borderRadius: 14, background: 'rgba(87,242,135,0.10)', border: '1px solid rgba(87,242,135,0.3)', textAlign: 'center', color: 'var(--success)' }}>
                    <div style={{ fontSize: 28 }}>✓</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>Case submitted</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Redirecting to your case…</div>
                  </motion.div>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>

        <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
          {step > 0 && <button onClick={prev} className="btn-ghost" disabled={submitting}>← Back</button>}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 && <button onClick={next} className="btn-primary">Continue →</button>}
          {step === STEPS.length - 1 && !success && (
            <button onClick={submit} disabled={submitting} className="btn-primary" style={{ minWidth: 160 }}>
              {submitting ? <span className="spin-dot" style={{ color: '#fff' }} /> : 'Submit Case'}
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{title}</h3>
      {subtitle && <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-secondary)' }}>{subtitle}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      {children}
      {error && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
}

function YesNo({ label, value, onChange, error }: { label: string; value: boolean | null; onChange: (b: boolean) => void; error?: string }) {
  return (
    <Field label={label} error={error}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[true, false].map((b) => (
          <button key={String(b)} type="button" onClick={() => onChange(b)} style={pillStyle(value === b)}>
            {b ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </Field>
  );
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
  background: active ? 'var(--accent)' : 'var(--bg-glass)',
  color: active ? '#fff' : 'var(--text-primary)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  cursor: 'pointer', transition: 'var(--transition)',
});

function ViolationBlock({
  index, value, error, onChange, onAddFiles, onRemoveFile,
}: {
  index: number;
  value: ViolationItem;
  error?: string;
  onChange: (p: Partial<ViolationItem>) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: 'var(--bg-glass)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
        Violation {index + 1}
      </div>
      <textarea
        className="field" rows={3}
        placeholder="What did TikTok flag? Paste the message they sent if you have it."
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}

      <div
        onDrop={(e) => { e.preventDefault(); setDrag(false); onAddFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onClick={() => document.getElementById(`file-${index}`)?.click()}
        style={{
          marginTop: 10, padding: '20px 14px', borderRadius: 10,
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
          background: drag ? 'rgba(88,101,242,0.06)' : 'transparent',
          textAlign: 'center', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 13,
        }}>
        📎 Drop screenshots or click to browse · {value.files.length}/8
        <input id={`file-${index}`} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={(e) => onAddFiles(Array.from(e.target.files || []))} />
      </div>
      {value.files.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
          {value.files.map((f) => (
            <div key={f.id} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <img src={f.dataUrl} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={(e) => { e.stopPropagation(); onRemoveFile(f.id); }} style={{
                position: 'absolute', top: 4, right: 4,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none',
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ label, value, edit }: { label: string; value: string; edit: () => void }) {
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: 'var(--bg-glass)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
      <button onClick={edit} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Edit</button>
    </div>
  );
}

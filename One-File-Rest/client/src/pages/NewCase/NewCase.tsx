import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, Button, Input, Badge } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCreateCase, useUploadEvidence } from '../../hooks/queries/useCases';
import { useToast } from '../../components/customer/Toast';
import { ChevronRight, ChevronLeft, Upload, Check, AlertCircle, Save } from 'lucide-react';

const VIOLATION_TYPES = [
  { value: 'banned_account', label: 'Banned Account', icon: '🚫', color: '#ED4245' },
  { value: 'suspended_account', label: 'Suspended Account', icon: '⏸️', color: '#FAA61A' },
  { value: 'commission_frozen', label: 'Commission Frozen', icon: '🧊', color: '#3BA9FF' },
  { value: 'shop_restricted', label: 'Shop Restricted', icon: '🛒', color: '#9B6BFF' },
  { value: 'content_violation', label: 'Content Violation', icon: '⚠️', color: '#FEE75C' },
  { value: 'other', label: 'Other', icon: '❓', color: '#888' },
];

const PLANS = [
  { value: 'basic_guard', name: 'Basic Guard', price: 49, cadence: 'one-time', color: '#5865F2', features: ['Single appeal', 'Discord support', 'Basic compliance scan'], recommended: false },
  { value: 'fortnightly_defense', name: 'Fortnightly Defense', price: 99, cadence: '/ 2 weeks', color: '#57F287', features: ['Up to 3 appeals/cycle', 'Priority Discord support', 'Weekly compliance reports', 'AI-drafted appeals'], recommended: true },
  { value: 'proshield_creator', name: 'ProShield Creator', price: 249, cadence: '/ month', color: '#FFD700', features: ['Unlimited appeals', 'Dedicated case manager', 'Real-time policy alerts', 'Account audit & coaching'], recommended: false },
  { value: 'choose_later', name: "I'll choose later", price: 0, cadence: 'free', color: '#888', features: ['Submit now', 'Pick a plan later'], recommended: false },
];

const STEPS = [
  { key: 'violations', label: 'Violations' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'appeals', label: 'Prior Appeals' },
  { key: 'verify', label: 'Verification' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'plan', label: 'Plan' },
  { key: 'review', label: 'Review' },
];

interface ViolationItem { files: Array<{ id: string; name: string; size: number; dataUrl: string; type: string }>; description: string; }
interface WizardData {
  accountUsername: string; violationType: string; appealDeadline: string; violationCount: number;
  violations: ViolationItem[];
  purchase: { wasPurchased: boolean | null; accountPurchaseDate: string; changesMade: string; timeAfterPurchase: string };
  previousAppeals: { appealedBefore: boolean | null; previousScript: string };
  verification: { verifiedBySelf: boolean | null; notes: string };
  metrics: { faceVideos: number; totalGMV: number; commissionFrozenAmount: number; accountsUnderDocs: number };
  selectedPlan: string;
}

const STORAGE_KEY = 'newcase-wizard-v2';
const empty = (): WizardData => ({
  accountUsername: '', violationType: '', appealDeadline: '', violationCount: 1,
  violations: [{ files: [], description: '' }],
  purchase: { wasPurchased: null, accountPurchaseDate: '', changesMade: '', timeAfterPurchase: '' },
  previousAppeals: { appealedBefore: null, previousScript: '' },
  verification: { verifiedBySelf: null, notes: '' },
  metrics: { faceVideos: 0, totalGMV: 0, commissionFrozenAmount: 0, accountsUnderDocs: 0 },
  selectedPlan: '',
});

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
  const createCase = useCreateCase();
  const uploadEvidence = useUploadEvidence();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<WizardData>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return { ...empty(), ...JSON.parse(raw) }; } catch {}
    return empty();
  });

  useEffect(() => {
    try {
      const safe = { ...data, violations: data.violations.map((v) => ({ ...v, files: v.files.map(({ id, name, size, type }) => ({ id, name, size, type, dataUrl: '' })) })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {}
  }, [data]);

  const update = <K extends keyof WizardData>(k: K, v: WizardData[K]) => setData((d) => ({ ...d, [k]: v }));
  const setViolationCount = (n: number) => {
    const count = Math.max(1, Math.min(10, n));
    setData((d) => {
      const next = [...d.violations];
      while (next.length < count) next.push({ files: [], description: '' });
      while (next.length > count) next.pop();
      return { ...d, violationCount: count, violations: next };
    });
  };

  const updateViolation = (i: number, patch: Partial<ViolationItem>) => setData((d) => {
    const next = [...d.violations]; next[i] = { ...next[i], ...patch }; return { ...d, violations: next };
  });

  const addFiles = async (i: number, list: File[]) => {
    const accepted = list.filter((f) => f.size <= 4 * 1024 * 1024).slice(0, 8);
    if (list.some((f) => f.size > 4 * 1024 * 1024)) toast('Files over 4 MB skipped', 'error');
    const converted = await Promise.all(accepted.map(async (f) => ({
      id: `${Date.now()}-${f.name}`, name: f.name, size: f.size, type: f.type,
      dataUrl: await fileToDataUrl(f),
    })));
    updateViolation(i, { files: [...data.violations[i].files, ...converted].slice(0, 8) });
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!data.accountUsername.trim()) e.accountUsername = 'Required';
      if (!data.violationType) e.violationType = 'Pick a type';
      if (!data.appealDeadline) e.appealDeadline = 'Required';
    }
    if (s === 1 && data.purchase.wasPurchased === null) e.wasPurchased = 'Please answer';
    if (s === 2 && data.previousAppeals.appealedBefore === null) e.appealedBefore = 'Please answer';
    if (s === 3 && data.verification.verifiedBySelf === null) e.verifiedBySelf = 'Please answer';
    if (s === 5 && !data.selectedPlan) e.selectedPlan = 'Choose a plan';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!validate(0)) { setStep(0); return; }
    setSubmitting(true);
    try {
      const r = await createCase.mutateAsync({
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
        wizard: { ...data, violations: data.violations.map((v) => ({ description: v.description, screenshots: v.files.map((f) => ({ name: f.name, size: f.size, type: f.type })) })) },
      });
      const allFiles = data.violations.flatMap((v, vi) => v.files.map((f) => ({ ...f, vi })));
      await Promise.all(allFiles.map(async (f) => {
        try { await uploadEvidence.mutateAsync({ case_id: r.id, file_url: f.dataUrl, file_name: f.name, file_type: f.type, description: `Violation ${f.vi + 1}` }); } catch {}
      }));
      setSuccess(true);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      toast('Case submitted successfully!', 'success');
      setTimeout(() => navigate(`/cases/${r.id}`), 1100);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create case', 'error');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="page-wrap" style={{ maxWidth: 820 }}>
      <button onClick={() => navigate('/dashboard')} className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>← Back to Dashboard</button>
      <h1 className="text-[28px] font-extrabold m-0" style={{ letterSpacing: -0.5 }}>Submit a New Case</h1>
      <p className="text-sm text-[var(--text-secondary)] mt-1 mb-5">Walk us through the violation. Your progress saves automatically.</p>

      <Card noHover className="!p-4 mb-5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = i === step; const done = i < step || success;
            return (
              <React.Fragment key={s.key}>
                <button onClick={() => i < step && setStep(i)} className="flex items-center gap-1.5 shrink-0 bg-transparent border-none p-1"
                  disabled={i >= step && !success}
                >
                  <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                    style={{
                      background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-glass)',
                      border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                      color: (done || active) ? '#fff' : 'var(--text-muted)',
                    }}
                  >{done ? <Check size={10} /> : i + 1}</div>
                  <span className="text-[11px] font-semibold hidden sm:inline" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="flex-1 h-px min-w-[8px]" style={{ background: i < step ? 'var(--success)' : 'var(--border)' }} />}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      <Card noHover className="!p-6 min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <Section title="Violation Details" subtitle="Tell us about your TikTok account and what happened.">
                <Field label="TikTok Username *" error={errors.accountUsername}>
                  <input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] p-3 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-glow)] transition-all"
                    value={data.accountUsername} onChange={(e) => update('accountUsername', e.target.value)} placeholder="@username" />
                </Field>
                <Field label="Violation Type *" error={errors.violationType}>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                    {VIOLATION_TYPES.map((v) => (
                      <button key={v.value} type="button" onClick={() => update('violationType', v.value)}
                        className="p-2.5 rounded-xl text-left flex items-center gap-2 text-sm font-medium transition-all"
                        style={{
                          background: data.violationType === v.value ? `${v.color}18` : 'var(--bg-glass)',
                          border: `1px solid ${data.violationType === v.value ? v.color : 'var(--border)'}`,
                          color: 'var(--text-primary)',
                        }}
                      ><span className="text-lg">{v.icon}</span>{v.label}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Appeal Deadline *" error={errors.appealDeadline}>
                  <input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] p-3 text-sm focus:border-[var(--accent)] transition-all" type="datetime-local"
                    value={data.appealDeadline} onChange={(e) => update('appealDeadline', e.target.value)} />
                </Field>
                <Field label="Number of Violations">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setViolationCount(data.violationCount - 1)}
                      className="w-9 h-9 rounded-lg bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-center text-sm font-bold">−</button>
                    <span className="text-lg font-bold min-w-[40px] text-center">{data.violationCount}</span>
                    <button type="button" onClick={() => setViolationCount(data.violationCount + 1)}
                      className="w-9 h-9 rounded-lg bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-center text-sm font-bold">+</button>
                    <span className="text-xs text-[var(--text-muted)]">(1–10)</span>
                  </div>
                </Field>
                {data.violations.map((v, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[var(--bg-glass)] border border-[var(--border)]">
                    <div className="text-xs font-bold mb-2" style={{ color: 'var(--accent)' }}>Violation {i + 1}</div>
                    <textarea className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] p-3 text-sm resize-none focus:border-[var(--accent)] transition-all"
                      rows={3} placeholder="What did TikTok flag?" value={v.description}
                      onChange={(e) => updateViolation(i, { description: e.target.value })} />
                    {errors[`v${i}_desc`] && <p className="text-xs text-[var(--danger)] mt-1">{errors[`v${i}_desc`]}</p>}
                    <div className="mt-2 p-4 rounded-xl border-2 border-dashed text-center cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      onDrop={(e) => { e.preventDefault(); addFiles(i, Array.from(e.dataTransfer.files)); }}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => document.getElementById(`file-${i}`)?.click()}
                    >
                      <Upload size={16} className="mx-auto mb-1" /> Drop screenshots or click · {v.files.length}/8
                      <input id={`file-${i}`} type="file" multiple accept="image/*" className="hidden"
                        onChange={(e) => addFiles(i, Array.from(e.target.files || []))} />
                    </div>
                    {v.files.length > 0 && (
                      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1.5">
                        {v.files.map((f) => (
                          <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-card)] border border-[var(--border)]">
                            <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); updateViolation(i, { files: v.files.filter((x) => x.id !== f.id) }); }}
                              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center border-none cursor-pointer">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}
            {step === 1 && (
              <Section title="Purchase Information" subtitle="Was this account purchased?">
                <YesNo label="Was this account purchased?" value={data.purchase.wasPurchased} error={errors.wasPurchased}
                  onChange={(b) => setData((d) => ({ ...d, purchase: { ...d.purchase, wasPurchased: b } }))} />
                {data.purchase.wasPurchased && (
                  <>
                    <Field label="Date of Purchase"><input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" type="date" value={data.purchase.accountPurchaseDate} onChange={(e) => setData((d) => ({ ...d, purchase: { ...d.purchase, accountPurchaseDate: e.target.value } }))} /></Field>
                    <Field label="Time on Account After Purchase"><input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" placeholder="e.g. 6 months" value={data.purchase.timeAfterPurchase} onChange={(e) => setData((d) => ({ ...d, purchase: { ...d.purchase, timeAfterPurchase: e.target.value } }))} /></Field>
                    <Field label="Changes Made"><textarea className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" rows={4} placeholder="Describe changes made to the account" value={data.purchase.changesMade} onChange={(e) => setData((d) => ({ ...d, purchase: { ...d.purchase, changesMade: e.target.value } }))} /></Field>
                  </>
                )}
              </Section>
            )}
            {step === 2 && (
              <Section title="Previous Appeals" subtitle="Have you already tried to appeal?">
                <YesNo label="Have you appealed before?" value={data.previousAppeals.appealedBefore} error={errors.appealedBefore}
                  onChange={(b) => setData((d) => ({ ...d, previousAppeals: { ...d.previousAppeals, appealedBefore: b } }))} />
                {data.previousAppeals.appealedBefore && (
                  <Field label="Previous Appeal Text"><textarea className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" rows={6} placeholder="Paste your previous appeal..." value={data.previousAppeals.previousScript} onChange={(e) => setData((d) => ({ ...d, previousAppeals: { ...d.previousAppeals, previousScript: e.target.value } }))} /></Field>
                )}
              </Section>
            )}
            {step === 3 && (
              <Section title="Account Verification" subtitle="Has TikTok verified your identity?">
                <YesNo label="Verified by yourself?" value={data.verification.verifiedBySelf} error={errors.verifiedBySelf}
                  onChange={(b) => setData((d) => ({ ...d, verification: { ...d.verification, verifiedBySelf: b } }))} />
                <Field label="Notes (optional)"><textarea className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" rows={3} placeholder="Any context about ID verification..." value={data.verification.notes} onChange={(e) => setData((d) => ({ ...d, verification: { ...d.verification, notes: e.target.value } }))} /></Field>
              </Section>
            )}
            {step === 4 && (
              <Section title="Account Metrics" subtitle="Help us prioritize your case.">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                  <Field label="Face Videos Posted"><input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" type="number" min={0} value={data.metrics.faceVideos} onChange={(e) => setData((d) => ({ ...d, metrics: { ...d.metrics, faceVideos: parseInt(e.target.value) || 0 } }))} /></Field>
                  <Field label="Total GMV (USD/month)"><input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" type="number" min={0} value={data.metrics.totalGMV} onChange={(e) => setData((d) => ({ ...d, metrics: { ...d.metrics, totalGMV: parseFloat(e.target.value) || 0 } }))} /></Field>
                  <Field label="Accounts Under Docs"><input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" type="number" min={0} value={data.metrics.accountsUnderDocs} onChange={(e) => setData((d) => ({ ...d, metrics: { ...d.metrics, accountsUnderDocs: parseInt(e.target.value) || 0 } }))} /></Field>
                  <Field label="Commission Frozen ($)"><input className="w-full bg-[var(--bg-glass)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-sm" type="number" min={0} value={data.metrics.commissionFrozenAmount} onChange={(e) => setData((d) => ({ ...d, metrics: { ...d.metrics, commissionFrozenAmount: parseFloat(e.target.value) || 0 } }))} /></Field>
                </div>
              </Section>
            )}
            {step === 5 && (
              <Section title="Choose Your Plan" subtitle="Pick the package that matches your needs.">
                {errors.selectedPlan && <p className="text-xs text-[var(--danger)] mb-3">{errors.selectedPlan}</p>}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                  {PLANS.map((p) => {
                    const active = data.selectedPlan === p.value;
                    return (
                      <button key={p.value} type="button" onClick={() => update('selectedPlan', p.value)}
                        className="text-left p-4 rounded-xl relative transition-all"
                        style={{
                          background: active ? `${p.color}14` : 'var(--bg-glass)',
                          border: `2px solid ${active ? p.color : 'var(--border)'}`,
                        }}
                      >
                        {p.recommended && <div className="absolute -top-2.5 right-3 text-[9px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: p.color, color: '#000' }}>RECOMMENDED</div>}
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: p.color }}>{p.name}</div>
                        <div className="text-2xl font-extrabold mt-1">${p.price}<span className="text-xs text-[var(--text-muted)] font-normal ml-1">{p.cadence}</span></div>
                        <ul className="mt-2 space-y-1 list-none p-0">
                          {p.features.map((f) => (
                            <li key={f} className="flex gap-1.5 text-xs text-[var(--text-secondary)]"><span style={{ color: p.color }}>✓</span>{f}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => { update('selectedPlan', 'choose_later'); setStep(6); }}
                  className="mt-3 text-xs underline text-[var(--text-muted)] bg-transparent border-none cursor-pointer">Skip — I'll choose later</button>
              </Section>
            )}
            {step === 6 && (
              <Section title="Review & Submit" subtitle="One last check before we submit.">
                <ReviewRow label="Account" value={`@${data.accountUsername}`} onEdit={() => setStep(0)} />
                <ReviewRow label="Violation" value={VIOLATION_TYPES.find((v) => v.value === data.violationType)?.label || '—'} onEdit={() => setStep(0)} />
                <ReviewRow label="Deadline" value={data.appealDeadline ? new Date(data.appealDeadline).toLocaleString() : '—'} onEdit={() => setStep(0)} />
                <ReviewRow label="# Violations" value={String(data.violationCount)} onEdit={() => setStep(0)} />
                <ReviewRow label="Screenshots" value={String(data.violations.reduce((a, v) => a + v.files.length, 0))} onEdit={() => setStep(0)} />
                <ReviewRow label="Purchased?" value={data.purchase.wasPurchased == null ? '—' : data.purchase.wasPurchased ? 'Yes' : 'No'} onEdit={() => setStep(1)} />
                <ReviewRow label="Appealed Before?" value={data.previousAppeals.appealedBefore == null ? '—' : data.previousAppeals.appealedBefore ? 'Yes' : 'No'} onEdit={() => setStep(2)} />
                <ReviewRow label="Verified?" value={data.verification.verifiedBySelf == null ? '—' : data.verification.verifiedBySelf ? 'Yes' : 'No'} onEdit={() => setStep(3)} />
                <ReviewRow label="GMV" value={`$${data.metrics.totalGMV.toLocaleString()}`} onEdit={() => setStep(4)} />
                <ReviewRow label="Plan" value={PLANS.find((p) => p.value === data.selectedPlan)?.name || 'Not selected'} onEdit={() => setStep(5)} />
                {success && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="mt-5 p-5 rounded-xl text-center border" style={{ background: 'rgba(87,242,135,0.08)', borderColor: 'rgba(87,242,135,0.3)' }}>
                    <Check size={28} className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
                    <div className="font-bold" style={{ color: 'var(--success)' }}>Case submitted!</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">Redirecting...</div>
                  </motion.div>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2.5 mt-7">
          {step > 0 && <Button variant="secondary" onClick={prev} disabled={submitting}><ChevronLeft size={14} /> Back</Button>}
          <div className="flex-1" />
          {step < STEPS.length - 1 && <Button onClick={next}>Continue <ChevronRight size={14} /></Button>}
          {step === STEPS.length - 1 && !success && (
            <Button onClick={submit} loading={submitting} className="min-w-[140px]">
              {submitting ? 'Submitting...' : 'Submit Case'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <div><h3 className="text-lg font-bold m-0 mb-1">{title}</h3>{subtitle && <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">{subtitle}</p>}<div className="space-y-3.5">{children}</div></div>;
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</div>{children}{error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}</div>;
}
function YesNo({ label, value, onChange, error }: { label: string; value: boolean | null; onChange: (b: boolean) => void; error?: string }) {
  return <Field label={label} error={error}><div className="flex gap-2">{[true, false].map((b) => (
    <button key={String(b)} type="button" onClick={() => onChange(b)}
      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: value === b ? 'var(--accent)' : 'var(--bg-glass)',
        color: value === b ? '#fff' : 'var(--text-primary)',
        border: `1px solid ${value === b ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >{b ? 'Yes' : 'No'}</button>
  ))}</div></Field>;
}
function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return <div className="p-3 rounded-xl bg-[var(--bg-glass)] border border-[var(--border)] flex items-center justify-between gap-3">
    <div className="min-w-0 flex-1"><div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div><div className="text-sm text-[var(--text-primary)] mt-0.5 truncate">{value}</div></div>
    <button onClick={onEdit} className="text-xs font-semibold bg-transparent border-none cursor-pointer" style={{ color: 'var(--accent)' }}>Edit</button>
  </div>;
}
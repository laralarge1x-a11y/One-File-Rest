import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard, useToast } from '../components/customer';

const VIOLATION_TYPES = [
  { value: 'banned_account',     label: 'Banned Account',     icon: '🚫' },
  { value: 'suspended_account',  label: 'Suspended Account',  icon: '⏸️' },
  { value: 'commission_frozen',  label: 'Commission Frozen',  icon: '🧊' },
  { value: 'shop_restricted',    label: 'Shop Restricted',    icon: '🛒' },
  { value: 'content_violation',  label: 'Content Violation',  icon: '⚠️' },
  { value: 'other',              label: 'Other',              icon: '❓' },
];

interface FormData {
  accountUsername: string;
  violationType: string;
  platform: 'tiktok' | 'tiktok_shop';
  violationDescription: string;
  appealDeadline: string;
  totalGMV: string;
}

interface UploadFile { id: string; file: File; }

const FloatingInput: React.FC<{
  label: string; name: string; value: string; type?: string;
  onChange: (v: string) => void; required?: boolean; error?: string; maxLength?: number;
}> = ({ label, name, value, type = 'text', onChange, required, error, maxLength }) => (
  <div style={{ position: 'relative', marginBottom: 4 }}>
    <input
      id={name} name={name} type={type} value={value} required={required} maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder=" "
      className={`field floating ${error ? 'shake' : ''}`}
      style={{
        paddingTop: 22, paddingBottom: 8,
        borderColor: error ? 'var(--danger)' : undefined,
      }}
    />
    <label htmlFor={name} style={{
      position: 'absolute', left: 14,
      top: value ? 8 : 16,
      fontSize: value ? 11 : 14,
      color: value ? 'var(--text-muted)' : 'var(--text-secondary)',
      pointerEvents: 'none', transition: 'all 0.2s ease',
      letterSpacing: value ? 0.4 : 0,
      textTransform: value ? 'uppercase' : 'none',
      fontWeight: value ? 600 : 400,
    }}>{label}{required ? ' *' : ''}</label>
    {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
    <style>{`
      .field.floating:focus + label { top: 8px; font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
    `}</style>
  </div>
);

export default function NewCase() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [data, setData] = useState<FormData>({
    accountUsername: '',
    violationType: '',
    platform: 'tiktok_shop',
    violationDescription: '',
    appealDeadline: '',
    totalGMV: '',
  });

  const update = (k: keyof FormData, v: string) => setData((d) => ({ ...d, [k]: v }));

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!data.accountUsername.trim()) e.accountUsername = 'Required';
    if (!data.violationType) e.violationType = 'Pick a violation type';
    if (!data.appealDeadline) e.appealDeadline = 'Required';
    if (data.violationDescription.length > 1000) e.violationDescription = 'Max 1000 characters';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => Math.min(2, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const list = Array.from(e.dataTransfer.files);
    addFiles(list);
  };
  const addFiles = (list: File[]) => {
    const remaining = Math.max(0, 10 - files.length);
    const oversized = list.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length) toast(`${oversized[0].name} is over 10 MB`, 'error');
    const accepted = list.filter((f) => f.size <= 10 * 1024 * 1024).slice(0, remaining);
    const next = accepted.map((f) => ({ id: `${Date.now()}-${f.name}-${Math.random()}`, file: f }));
    setFiles((prev) => [...prev, ...next]);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/cases', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountUsername: data.accountUsername,
          violationType: data.violationType,
          violationDescription: data.violationDescription,
          appealDeadline: data.appealDeadline,
          totalGMV: parseFloat(data.totalGMV) || 0,
          faceVideosPosted: 0,
          commissionFrozen: false,
          accountPurchaseDate: null,
        }),
      });
      if (!r.ok) throw new Error('Failed to create case');
      const newCase = await r.json();
      setSuccess(true);
      toast('Case submitted successfully', 'success');
      setTimeout(() => navigate(`/cases/${newCase.id}`), 1100);
    } catch (e: any) {
      toast(e.message || 'Could not create case', 'error');
      setSubmitting(false);
    }
  };

  const STEPS = ['Case Details', 'Evidence', 'Review'];

  return (
    <div className="page-wrap" style={{ maxWidth: 760 }}>
      <button onClick={() => navigate('/dashboard')} style={{
        marginBottom: 18, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
      }}>← Back to Dashboard</button>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Submit a New Case</h1>
      <p style={{ margin: '6px 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Tell us about your TikTok violation and our team will start working on the appeal.
      </p>

      <GlassCard noHover style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step || success;
            return (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <motion.div
                    animate={{
                      background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-glass)',
                      borderColor: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)',
                    }}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      color: (done || active) ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </motion.div>
                  <span className="step-label" style={{
                    fontSize: 13, fontWeight: 600,
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 2, position: 'relative', minWidth: 20 }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: i < step ? '100%' : '0%' }}
                      transition={{ duration: 0.4 }}
                      style={{ position: 'absolute', inset: 0, background: 'var(--success)', borderRadius: 2 }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <style>{`
          @media (max-width: 540px) {
            .step-label { display: none; }
          }
        `}</style>
      </GlassCard>

      <GlassCard noHover style={{ padding: 24, minHeight: 360 }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
            >
              <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Case Details</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <FloatingInput
                  label="TikTok Account Username" name="accountUsername"
                  value={data.accountUsername} onChange={(v) => update('accountUsername', v)}
                  required error={errors.accountUsername}
                />

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, letterSpacing: 0.4 }}>Platform</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'tiktok', label: 'TikTok' },
                      { value: 'tiktok_shop', label: 'TikTok Shop' },
                    ].map((p) => (
                      <button key={p.value} onClick={() => update('platform', p.value)} type="button" style={{
                        flex: 1, height: 42, borderRadius: 10,
                        background: data.platform === p.value ? 'var(--accent)' : 'var(--bg-glass)',
                        border: `1px solid ${data.platform === p.value ? 'var(--accent)' : 'var(--border)'}`,
                        color: data.platform === p.value ? '#fff' : 'var(--text-primary)',
                        fontWeight: 600, fontSize: 13, transition: 'var(--transition)',
                      }}>{p.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, letterSpacing: 0.4 }}>Violation Type *</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    {VIOLATION_TYPES.map((v) => {
                      const active = data.violationType === v.value;
                      return (
                        <button key={v.value} type="button" onClick={() => update('violationType', v.value)} style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: active ? 'rgba(88,101,242,0.15)' : 'var(--bg-glass)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 10,
                          color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                          transition: 'var(--transition)',
                        }}>
                          <span style={{ fontSize: 18 }}>{v.icon}</span>{v.label}
                        </button>
                      );
                    })}
                  </div>
                  {errors.violationType && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{errors.violationType}</div>}
                </div>

                <FloatingInput
                  label="Appeal Deadline" name="appealDeadline" type="datetime-local"
                  value={data.appealDeadline} onChange={(v) => update('appealDeadline', v)}
                  required error={errors.appealDeadline}
                />

                <div style={{ position: 'relative' }}>
                  <textarea
                    value={data.violationDescription}
                    onChange={(e) => update('violationDescription', e.target.value)}
                    placeholder="Describe what happened, when you got the notice, and any details TikTok provided..."
                    maxLength={1000}
                    className={`field ${errors.violationDescription ? 'shake' : ''}`}
                    style={{ minHeight: 120, resize: 'vertical', paddingRight: 70 }}
                  />
                  <div style={{ position: 'absolute', right: 12, bottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    {data.violationDescription.length}/1000
                  </div>
                </div>

                <FloatingInput
                  label="Total GMV (Monthly USD, optional)" name="totalGMV" type="number"
                  value={data.totalGMV} onChange={(v) => update('totalGMV', v)}
                />
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Evidence</h3>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
                Pick screenshots of the violation notice, ban screen, or any related documents (up to 10).
                Once your case is created, our team will reach out in your Discord channel where you can attach these files securely.
              </p>

              <button
                type="button"
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => document.getElementById('hidden-file')?.click()}
                aria-label="Browse files to attach as evidence"
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  padding: '40px 20px', borderRadius: 'var(--radius-lg)',
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  background: dragOver ? 'rgba(88,101,242,0.06)' : 'var(--bg-glass)',
                  textAlign: 'center', transition: 'var(--transition)',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Drag files here or click to browse</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  Images, PDFs, documents · {files.length}/10 uploaded
                </div>
                <input id="hidden-file" type="file" multiple style={{ display: 'none' }}
                  accept="image/*,application/pdf,.doc,.docx"
                  onChange={(e) => addFiles(Array.from(e.target.files || []))}
                />
              </button>

              {files.length > 0 && (
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {files.map((f) => (
                    <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                        background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12,
                      }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 8,
                        background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>
                        {f.file.type.startsWith('image/') ? '🖼️' : f.file.type.includes('pdf') ? '📄' : '📎'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {(f.file.size / 1024).toFixed(0)} KB · Selected
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((x) => x.id !== f.id)); }} style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'var(--bg-card)', color: 'var(--text-muted)',
                        fontSize: 14,
                      }}>×</button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step3"
              initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
            >
              <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Review & Submit</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ReviewRow label="Account" value={`@${data.accountUsername}`} onEdit={() => setStep(0)} />
                <ReviewRow label="Platform" value={data.platform === 'tiktok_shop' ? 'TikTok Shop' : 'TikTok'} onEdit={() => setStep(0)} />
                <ReviewRow label="Violation" value={VIOLATION_TYPES.find((v) => v.value === data.violationType)?.label || '—'} onEdit={() => setStep(0)} />
                <ReviewRow label="Appeal Deadline" value={data.appealDeadline ? new Date(data.appealDeadline).toLocaleString() : '—'} onEdit={() => setStep(0)} />
                <ReviewRow label="Description" value={data.violationDescription || '—'} onEdit={() => setStep(0)} multiline />
                <ReviewRow label="Evidence Files" value={files.length === 0 ? 'None attached' : `${files.length} file(s) attached`} onEdit={() => setStep(1)} />
              </div>

              {success && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{
                    marginTop: 24, padding: 24, borderRadius: 'var(--radius-lg)',
                    background: 'rgba(87,242,135,0.10)', border: '1px solid rgba(87,242,135,0.30)',
                    textAlign: 'center', color: 'var(--success)',
                  }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ margin: '0 auto', display: 'block' }}>
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="none" />
                    <motion.path d="M20 32 L29 41 L44 24"
                      stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </svg>
                  <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>Case submitted</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Redirecting...</div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={prev} className="btn-ghost" disabled={submitting}>← Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step < 2 && (
            <button onClick={next} className="btn-primary">Continue →</button>
          )}
          {step === 2 && !success && (
            <button onClick={submit} disabled={submitting} className="btn-primary" style={{ minWidth: 160 }}>
              {submitting ? <span className="spin-dot" style={{ color: '#fff' }} /> : 'Submit Case'}
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function ReviewRow({ label, value, onEdit, multiline }: { label: string; value: string; onEdit: () => void; multiline?: boolean }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: 'var(--bg-glass)', border: '1px solid var(--border)',
      display: 'flex', alignItems: multiline ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>{label}</div>
        <div style={{
          marginTop: 4, fontSize: 14, color: 'var(--text-primary)',
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: multiline ? 'visible' : 'hidden', textOverflow: 'ellipsis',
        }}>{value}</div>
      </div>
      <button onClick={onEdit} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>Edit</button>
    </div>
  );
}

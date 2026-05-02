import React, { useEffect, useState } from 'react';

interface UserScore {
  caseId: number;
  accountUsername: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
}

const GRADE_COLOR: Record<string, string> = {
  A: '#57F287', B: '#7BD389', C: '#FEE75C', D: '#F5A623', F: '#ED4245',
};

const TREND_ICON: Record<string, string> = {
  improving: '↗',
  stable: '→',
  declining: '↘',
};

export default function ComplianceWidget({ discordId }: { discordId?: string }) {
  const [scores, setScores] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!discordId) { setLoading(false); return; }
    fetch(`/api/compliance/user/${discordId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setScores(d || []))
      .catch(() => setScores([]))
      .finally(() => setLoading(false));
  }, [discordId]);

  if (loading) return null;

  // Aggregate average grade
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + Number(b.score || 0), 0) / scores.length : null;
  const overallGrade = avg === null ? null : avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'F';

  return (
    <div style={{
      background: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 18,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Compliance Score
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {scores.length === 0 ? 'No active cases yet' : `${scores.length} case${scores.length === 1 ? '' : 's'} tracked`}
          </div>
        </div>
        {overallGrade && (
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: GRADE_COLOR[overallGrade] + '20',
            border: `3px solid ${GRADE_COLOR[overallGrade]}`,
            color: GRADE_COLOR[overallGrade],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800,
          }}>{overallGrade}</div>
        )}
      </div>
      {scores.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scores.slice(0, 4).map((s) => (
            <div key={s.caseId} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', background: 'rgba(255,255,255,0.02)',
              borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: GRADE_COLOR[s.grade] + '15',
                color: GRADE_COLOR[s.grade], fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>{s.grade}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{s.accountUsername || `Case #${s.caseId}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {Number(s.score).toFixed(0)}/100 • {TREND_ICON[s.trend]} {s.trend}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

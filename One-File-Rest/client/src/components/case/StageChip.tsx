import React from 'react';
import { getStageMeta, statusToStage, STAGE_BY_ID, type StageId } from '@shared/stages';

interface Props {
  /** Canonical stage id only — for legacy values, use `status`. */
  stage?: StageId | null;
  /** Legacy `cases.status` value (translated via shared/stages.ts). */
  status?: string | null;
  size?: 'xs' | 'sm' | 'md';
  /** Show the long label ("Resolved — Won") vs short ("Won"). */
  long?: boolean;
}

/**
 * Single-source-of-truth pill for case stages. Renders identically in the
 * customer dashboard, admin queue, kanban cards, search results, and the
 * case detail header — no other status pill should be added.
 */
export default function StageChip({ stage, status, size = 'md', long = false }: Props) {
  // Prefer the canonical stage id when supplied AND it's actually one of the
  // known seven. Otherwise translate from the legacy status. We never
  // silently fall back to "Intake" — an unrecognised stage id is logged so
  // the offending caller can be fixed instead of being masked.
  let id: StageId;
  if (stage && STAGE_BY_ID[stage]) {
    id = stage;
  } else {
    if (stage && import.meta.env?.DEV) {
      console.warn('[StageChip] Unknown stage id:', stage, '— falling back via status.');
    }
    id = statusToStage(status || undefined);
  }
  const meta = getStageMeta(id);
  const padY = size === 'xs' ? 2 : size === 'sm' ? 4 : 6;
  const padX = size === 'xs' ? 8 : size === 'sm' ? 10 : 12;
  const fs = size === 'xs' ? 10 : size === 'sm' ? 11 : 12;
  const dotSize = size === 'xs' ? 6 : 8;
  return (
    <span
      title={meta.description}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: size === 'xs' ? 5 : 7,
        padding: `${padY}px ${padX}px`, borderRadius: 999,
        background: `${meta.color}15`, border: `1px solid ${meta.color}33`,
        color: meta.color, fontWeight: 600, fontSize: fs, lineHeight: 1, whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        display: 'inline-block', width: dotSize, height: dotSize, borderRadius: '50%',
        background: meta.color, boxShadow: `0 0 6px ${meta.glow}`,
      }} />
      {long ? meta.label : meta.short}
    </span>
  );
}

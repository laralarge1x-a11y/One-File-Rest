import PDFDocument from 'pdfkit';
import pool from '../db/client.js';
import { Response } from 'express';

export async function streamCasePdf(caseId: number, res: Response) {
  const caseRes = await pool.query(
    `SELECT c.*, u.discord_username, u.email, u.plan, s.name AS staff_name
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
      WHERE c.id = $1`,
    [caseId]
  );
  if (caseRes.rows.length === 0) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  const c = caseRes.rows[0];

  const [msgs, ev, tl, ob, notes, score] = await Promise.all([
    pool.query('SELECT * FROM messages WHERE case_id = $1 ORDER BY created_at ASC', [caseId]),
    pool.query('SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at ASC', [caseId]),
    pool.query('SELECT * FROM case_timeline WHERE case_id = $1 ORDER BY id ASC', [caseId]),
    pool.query('SELECT * FROM onboarding_data WHERE case_id = $1 LIMIT 1', [caseId]),
    pool.query('SELECT n.*, u.discord_username AS staff_username FROM internal_notes n LEFT JOIN users u ON n.staff_discord_id = u.discord_id WHERE n.case_id = $1 ORDER BY n.created_at ASC', [caseId]),
    pool.query('SELECT * FROM compliance_scores WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1', [caseId]),
  ]);

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Case #${caseId}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fillColor('#5865F2').fontSize(20).text('Elite Tok Club', { continued: false });
  doc.fillColor('#888').fontSize(10).text('TikTok Shop Violation Recovery — Case Report', { continued: false });
  doc.moveDown(0.5);
  doc.strokeColor('#cccccc').moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown(0.8);

  // Title
  doc.fillColor('#000').fontSize(18).text(`Case #${c.id} — ${c.account_username || 'Unknown account'}`);
  doc.fontSize(11).fillColor('#444').text(`Status: ${c.status}    Priority: ${c.priority}    Outcome: ${c.outcome || 'pending'}`);
  doc.text(`Client: ${c.discord_username}    Plan: ${c.plan || '—'}    Specialist: ${c.staff_name || 'Unassigned'}`);
  doc.text(`Created: ${new Date(c.created_at).toLocaleString()}    Updated: ${new Date(c.updated_at).toLocaleString()}`);
  if (c.appeal_deadline) doc.text(`Appeal deadline: ${new Date(c.appeal_deadline).toLocaleString()}`);
  doc.moveDown(0.8);

  function section(title: string) {
    doc.moveDown(0.4);
    doc.fillColor('#5865F2').fontSize(13).text(title);
    doc.strokeColor('#5865F2').moveTo(48, doc.y + 2).lineTo(547, doc.y + 2).stroke();
    doc.moveDown(0.4);
    doc.fillColor('#000').fontSize(10);
  }

  section('Violation');
  doc.text(`Type: ${c.violation_type || '—'}`);
  if (c.violation_description) doc.moveDown(0.2).text(c.violation_description, { align: 'left' });

  if (score.rows[0]) {
    section('Compliance Score');
    const s = score.rows[0];
    doc.text(`Grade ${s.grade} (${Number(s.score).toFixed(1)}/100)  •  Trend: ${s.trend}`);
  }

  if (ob.rows[0]) {
    section('Onboarding Data');
    const o = ob.rows[0];
    doc.text(`Account purchase date: ${o.account_purchase_date || '—'}`);
    doc.text(`Shop verification date: ${o.shop_verification_date || '—'}`);
    doc.text(`Face videos posted: ${o.face_videos_posted ?? '—'}`);
    doc.text(`Total GMV: ${o.total_gmv ? `$${o.total_gmv}` : '—'}`);
    doc.text(`Commission frozen: ${o.commission_frozen ? 'Yes' : 'No'}`);
  }

  if (tl.rows.length > 0) {
    section('Case Timeline');
    for (const t of tl.rows) {
      doc.text(`• ${t.stage_name} — ${t.stage_status}${t.completed_at ? ` (${new Date(t.completed_at).toLocaleString()})` : ''}`);
    }
  }

  if (ev.rows.length > 0) {
    section(`Evidence (${ev.rows.length})`);
    for (const e of ev.rows) {
      doc.text(`• ${e.file_name || e.file_type || 'file'}${e.description ? ` — ${e.description}` : ''}`);
      if (e.file_url) doc.fillColor('#5865F2').text(`   ${e.file_url}`, { link: e.file_url, underline: true }).fillColor('#000');
    }
  }

  if (msgs.rows.length > 0) {
    section(`Messages (${msgs.rows.length})`);
    for (const m of msgs.rows) {
      const who = m.sender_type === 'client' ? 'Client' : m.sender_type === 'staff' ? 'Staff' : m.sender_type;
      doc.fillColor('#666').fontSize(9).text(`[${new Date(m.created_at).toLocaleString()}] ${who}`);
      doc.fillColor('#000').fontSize(10).text(m.content || '');
      doc.moveDown(0.2);
      if (doc.y > 750) doc.addPage();
    }
  }

  if (notes.rows.length > 0) {
    section('Internal Notes');
    for (const n of notes.rows) {
      doc.fillColor('#666').fontSize(9).text(`[${new Date(n.created_at).toLocaleString()}] ${n.staff_username || ''}`);
      doc.fillColor('#000').fontSize(10).text(n.note);
      doc.moveDown(0.2);
    }
  }

  doc.moveDown(1);
  doc.fillColor('#888').fontSize(8).text(
    `Generated ${new Date().toLocaleString()}  •  Elite Tok Club Portal`,
    { align: 'center' }
  );

  doc.end();
}

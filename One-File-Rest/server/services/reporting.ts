import { Pool } from 'pg';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';

export class ReportingService {
  constructor(private pool: Pool) {}

  // Generate monthly report
  async generateMonthlyReport(userDiscordId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won_cases,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied_cases,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_cases,
        AVG(EXTRACT(DAY FROM (updated_at - created_at))) as avg_resolution_days,
        ARRAY_AGG(id) as case_ids
      FROM cases
      WHERE user_discord_id = $1
      AND created_at >= $2
      AND created_at < $3`,
      [userDiscordId, startDate, endDate]
    );

    const data = result.rows[0];
    const caseIds = data.case_ids || [];

    // Get compliance scores for cases
    const complianceResult = await this.pool.query(
      `SELECT AVG(score) as avg_score, AVG(CAST(grade AS INTEGER)) as avg_grade
       FROM compliance_scores
       WHERE case_id = ANY($1)`,
      [caseIds]
    );

    const reportData = {
      month,
      year,
      generatedAt: new Date(),
      summary: {
        totalCases: data.total_cases,
        wonCases: data.won_cases,
        deniedCases: data.denied_cases,
        pendingCases: data.pending_cases,
        winRate: data.total_cases > 0 ? (data.won_cases / data.total_cases * 100).toFixed(2) : 0,
        avgResolutionDays: data.avg_resolution_days ? parseFloat(data.avg_resolution_days).toFixed(1) : 0,
      },
      compliance: {
        avgScore: complianceResult.rows[0]?.avg_score || 0,
        avgGrade: complianceResult.rows[0]?.avg_grade || 'N/A',
      },
      caseIds,
    };

    // Save report to database
    const reportResult = await this.pool.query(
      `INSERT INTO reports (user_discord_id, report_type, title, data, format, generated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, file_url`,
      [
        userDiscordId,
        'monthly',
        `Monthly Report - ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        JSON.stringify(reportData),
        'json',
        new Date(),
      ]
    );

    return reportResult.rows[0];
  }

  // Generate quarterly report
  async generateQuarterlyReport(userDiscordId: string, quarter: number, year: number) {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth, 0);

    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won_cases,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied_cases,
        COUNT(CASE WHEN outcome = 'won' THEN 1 END) as successful_appeals,
        ARRAY_AGG(id) as case_ids
      FROM cases
      WHERE user_discord_id = $1
      AND created_at >= $2
      AND created_at < $3`,
      [userDiscordId, startDate, endDate]
    );

    const data = result.rows[0];
    const caseIds = data.case_ids || [];

    // Get trend data
    const trendResult = await this.pool.query(
      `SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as cases_count,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won_count
      FROM cases
      WHERE user_discord_id = $1
      AND created_at >= $2
      AND created_at < $3
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month`,
      [userDiscordId, startDate, endDate]
    );

    const reportData = {
      quarter,
      year,
      generatedAt: new Date(),
      summary: {
        totalCases: data.total_cases,
        wonCases: data.won_cases,
        deniedCases: data.denied_cases,
        successfulAppeals: data.successful_appeals,
        winRate: data.total_cases > 0 ? (data.won_cases / data.total_cases * 100).toFixed(2) : 0,
      },
      monthlyTrend: trendResult.rows,
      caseIds,
    };

    const reportResult = await this.pool.query(
      `INSERT INTO reports (user_discord_id, report_type, title, data, format, generated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, file_url`,
      [
        userDiscordId,
        'quarterly',
        `Quarterly Report - Q${quarter} ${year}`,
        JSON.stringify(reportData),
        'json',
        new Date(),
      ]
    );

    return reportResult.rows[0];
  }

  // Generate custom report
  async generateCustomReport(
    userDiscordId: string,
    title: string,
    filters: any,
    sections: string[]
  ) {
    let query = `SELECT * FROM cases WHERE user_discord_id = $1`;
    const params: any[] = [userDiscordId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(new Date(filters.startDate));
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(new Date(filters.endDate));
      paramIndex++;
    }

    if (filters.violationType) {
      query += ` AND violation_type = $${paramIndex}`;
      params.push(filters.violationType);
      paramIndex++;
    }

    const casesResult = await this.pool.query(query, params);
    const cases = casesResult.rows;

    const reportData: any = {
      title,
      generatedAt: new Date(),
      filters,
      sections,
      caseCount: cases.length,
      cases: [],
    };

    // Build report based on selected sections
    if (sections.includes('summary')) {
      reportData.summary = {
        totalCases: cases.length,
        wonCases: cases.filter((c: any) => c.status === 'won').length,
        deniedCases: cases.filter((c: any) => c.status === 'denied').length,
        pendingCases: cases.filter((c: any) => c.status === 'pending').length,
      };
    }

    if (sections.includes('details')) {
      reportData.cases = cases.map((c: any) => ({
        id: c.id,
        accountUsername: c.account_username,
        violationType: c.violation_type,
        status: c.status,
        outcome: c.outcome,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
    }

    if (sections.includes('compliance')) {
      const complianceResult = await this.pool.query(
        `SELECT * FROM compliance_scores WHERE case_id = ANY($1)`,
        [cases.map((c: any) => c.id)]
      );
      reportData.compliance = complianceResult.rows;
    }

    const reportResult = await this.pool.query(
      `INSERT INTO reports (user_discord_id, report_type, title, data, format, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [userDiscordId, 'custom', title, JSON.stringify(reportData), 'json']
    );

    return reportResult.rows[0];
  }

  // Export cases to CSV
  async exportCasesToCSV(userDiscordId: string, caseIds: number[]) {
    const result = await this.pool.query(
      `SELECT * FROM cases WHERE user_discord_id = $1 AND id = ANY($2)`,
      [userDiscordId, caseIds]
    );

    const cases = result.rows;
    const fileName = `cases_export_${Date.now()}.csv`;
    const filePath = path.join('/tmp', fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'account_username', title: 'Account Username' },
        { id: 'violation_type', title: 'Violation Type' },
        { id: 'status', title: 'Status' },
        { id: 'outcome', title: 'Outcome' },
        { id: 'created_at', title: 'Created At' },
        { id: 'updated_at', title: 'Updated At' },
      ],
    });

    await csvWriter.writeRecords(cases);

    const fileSize = fs.statSync(filePath).size;

    // Log export
    await this.pool.query(
      `INSERT INTO export_logs (user_discord_id, case_ids, export_type, format, record_count, file_size_bytes, file_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userDiscordId, caseIds, 'manual', 'csv', cases.length, fileSize, filePath]
    );

    return { filePath, fileName, recordCount: cases.length, fileSize };
  }

  // Export cases to PDF
  async exportCasesToPDF(userDiscordId: string, caseIds: number[]) {
    const result = await this.pool.query(
      `SELECT * FROM cases WHERE user_discord_id = $1 AND id = ANY($2)`,
      [userDiscordId, caseIds]
    );

    const cases = result.rows;
    const fileName = `cases_export_${Date.now()}.pdf`;
    const filePath = path.join('/tmp', fileName);

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text('Case Export Report', { align: 'center' });
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(11).text(`Total Cases: ${cases.length}`);
    doc.text(`Won Cases: ${cases.filter((c: any) => c.status === 'won').length}`);
    doc.text(`Denied Cases: ${cases.filter((c: any) => c.status === 'denied').length}`);
    doc.moveDown();

    // Cases table
    doc.fontSize(14).text('Cases Details', { underline: true });
    doc.moveDown(0.5);

    cases.forEach((caseItem: any, index: number) => {
      doc.fontSize(10).text(`Case #${index + 1}: ${caseItem.account_username}`, { underline: true });
      doc.fontSize(9);
      doc.text(`Violation Type: ${caseItem.violation_type}`);
      doc.text(`Status: ${caseItem.status}`);
      doc.text(`Outcome: ${caseItem.outcome || 'Pending'}`);
      doc.text(`Created: ${new Date(caseItem.created_at).toLocaleDateString()}`);
      doc.moveDown(0.5);
    });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        const fileSize = fs.statSync(filePath).size;
        this.pool.query(
          `INSERT INTO export_logs (user_discord_id, case_ids, export_type, format, record_count, file_size_bytes, file_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userDiscordId, caseIds, 'manual', 'pdf', cases.length, fileSize, filePath]
        ).then(() => {
          resolve({ filePath, fileName, recordCount: cases.length, fileSize });
        }).catch(reject);
      });
      stream.on('error', reject);
    });
  }

  // Schedule recurring report
  async scheduleReport(userDiscordId: string, reportConfig: any) {
    const { reportType, title, cronExpression, format } = reportConfig;

    const result = await this.pool.query(
      `INSERT INTO reports (user_discord_id, report_type, title, format, is_scheduled, schedule_cron, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [userDiscordId, reportType, title, format, true, cronExpression]
    );

    // Schedule the cron job
    cron.schedule(cronExpression, async () => {
      try {
        if (reportType === 'monthly') {
          const now = new Date();
          await this.generateMonthlyReport(userDiscordId, now.getMonth() + 1, now.getFullYear());
        } else if (reportType === 'quarterly') {
          const now = new Date();
          const quarter = Math.ceil((now.getMonth() + 1) / 3);
          await this.generateQuarterlyReport(userDiscordId, quarter, now.getFullYear());
        }
      } catch (error) {
        console.error('Error generating scheduled report:', error);
      }
    });

    return result.rows[0];
  }

  // Get user reports
  async getUserReports(userDiscordId: string, limit: number = 20, offset: number = 0) {
    const result = await this.pool.query(
      `SELECT id, report_type, title, format, generated_at, created_at
       FROM reports
       WHERE user_discord_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userDiscordId, limit, offset]
    );

    return result.rows;
  }

  // Get report details
  async getReportDetails(reportId: number, userDiscordId: string) {
    const result = await this.pool.query(
      `SELECT * FROM reports WHERE id = $1 AND user_discord_id = $2`,
      [reportId, userDiscordId]
    );

    if (result.rows.length === 0) {
      throw new Error('Report not found');
    }

    return result.rows[0];
  }

  // Delete report
  async deleteReport(reportId: number, userDiscordId: string) {
    const result = await this.pool.query(
      `DELETE FROM reports WHERE id = $1 AND user_discord_id = $2 RETURNING id`,
      [reportId, userDiscordId]
    );

    if (result.rows.length === 0) {
      throw new Error('Report not found');
    }

    return { success: true };
  }
}

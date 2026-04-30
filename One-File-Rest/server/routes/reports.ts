import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ReportingService } from '../services/reporting';
import { authenticateUser } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const generateMonthlyReportSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
});

const generateQuarterlyReportSchema = z.object({
  quarter: z.number().min(1).max(4),
  year: z.number().min(2020).max(2100),
});

const generateCustomReportSchema = z.object({
  title: z.string().min(1).max(300),
  filters: z.object({
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    violationType: z.string().optional(),
  }).optional(),
  sections: z.array(z.string()).optional(),
});

const exportCasesSchema = z.object({
  caseIds: z.array(z.number()),
  format: z.enum(['csv', 'pdf', 'json']),
});

const scheduleReportSchema = z.object({
  reportType: z.enum(['monthly', 'quarterly', 'custom']),
  title: z.string().min(1).max(300),
  cronExpression: z.string(),
  format: z.enum(['pdf', 'csv', 'json']),
});

export function initReportsRoutes(pool: Pool) {
  const reportingService = new ReportingService(pool);

  // Generate monthly report
  router.post('/monthly', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = generateMonthlyReportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { month, year } = validation.data;
      const userDiscordId = (req as any).user.discord_id;

      const report = await reportingService.generateMonthlyReport(userDiscordId, month, year);

      res.json({
        success: true,
        report,
        message: `Monthly report for ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} generated successfully`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate quarterly report
  router.post('/quarterly', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = generateQuarterlyReportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { quarter, year } = validation.data;
      const userDiscordId = (req as any).user.discord_id;

      const report = await reportingService.generateQuarterlyReport(userDiscordId, quarter, year);

      res.json({
        success: true,
        report,
        message: `Quarterly report for Q${quarter} ${year} generated successfully`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate custom report
  router.post('/custom', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = generateCustomReportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { title, filters, sections } = validation.data;
      const userDiscordId = (req as any).user.discord_id;

      const report = await reportingService.generateCustomReport(
        userDiscordId,
        title,
        filters || {},
        sections || ['summary', 'details']
      );

      res.json({
        success: true,
        report,
        message: 'Custom report generated successfully',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export cases to CSV/PDF
  router.post('/export', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = exportCasesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { caseIds, format } = validation.data;
      const userDiscordId = (req as any).user.discord_id;

      let result;
      if (format === 'csv') {
        result = await reportingService.exportCasesToCSV(userDiscordId, caseIds);
      } else if (format === 'pdf') {
        result = await reportingService.exportCasesToPDF(userDiscordId, caseIds);
      } else {
        return res.status(400).json({ error: 'Unsupported format' });
      }

      res.json({
        success: true,
        export: result,
        message: `Cases exported to ${format.toUpperCase()} successfully`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Schedule recurring report
  router.post('/schedule', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = scheduleReportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const userDiscordId = (req as any).user.discord_id;
      const report = await reportingService.scheduleReport(userDiscordId, validation.data);

      res.json({
        success: true,
        report,
        message: 'Report scheduled successfully',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user reports
  router.get('/', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userDiscordId = (req as any).user.discord_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const reports = await reportingService.getUserReports(userDiscordId, limit, offset);

      res.json({
        success: true,
        reports,
        count: reports.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get report details
  router.get('/:reportId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const userDiscordId = (req as any).user.discord_id;

      const report = await reportingService.getReportDetails(parseInt(reportId), userDiscordId);

      res.json({
        success: true,
        report,
      });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  // Delete report
  router.delete('/:reportId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const userDiscordId = (req as any).user.discord_id;

      await reportingService.deleteReport(parseInt(reportId), userDiscordId);

      res.json({
        success: true,
        message: 'Report deleted successfully',
      });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  return router;
}

export default router;

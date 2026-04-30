import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { CompliancePredictionService } from '../services/compliance-prediction';
import { authenticateUser } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const predictScoreSchema = z.object({
  caseId: z.number(),
});

const getBenchmarksSchema = z.object({
  violationType: z.string().optional(),
});

export function initComplianceRoutes(pool: Pool) {
  const complianceService = new CompliancePredictionService(pool);

  // Predict compliance score
  router.post('/predict', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = predictScoreSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { caseId } = validation.data;
      const prediction = await complianceService.predictComplianceScore(caseId);

      res.json({
        success: true,
        prediction,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get compliance history
  router.get('/history/:caseId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

      const history = await complianceService.getComplianceHistory(parseInt(caseId), limit);

      res.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get trend analysis
  router.get('/trends/:caseId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const trends = await complianceService.getTrendAnalysis(parseInt(caseId));

      res.json({
        success: true,
        trends,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recommendations
  router.get('/recommendations/:caseId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const insights = await complianceService.generateInsights(parseInt(caseId));

      res.json({
        success: true,
        insights,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get benchmarks
  router.get('/benchmarks', authenticateUser, async (req: Request, res: Response) => {
    try {
      const violationType = req.query.violationType as string | undefined;
      const benchmarks = await complianceService.getComplianceBenchmarks(violationType);

      res.json({
        success: true,
        benchmarks,
        count: benchmarks.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Compare with benchmarks
  router.get('/comparison/:caseId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const comparison = await complianceService.compareWithBenchmarks(parseInt(caseId));

      res.json({
        success: true,
        comparison,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update benchmarks (admin only)
  router.post('/benchmarks/update', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userRole = (req as any).user.role;
      if (userRole !== 'owner' && userRole !== 'case_manager') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { violationType, benchmarkData } = req.body;
      const updated = await complianceService.updateBenchmarks(violationType, benchmarkData);

      res.json({
        success: true,
        benchmark: updated,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default router;

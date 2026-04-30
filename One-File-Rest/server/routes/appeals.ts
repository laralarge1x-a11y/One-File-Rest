import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AppealVersioningService } from '../services/appeal-versioning';
import { authenticateUser } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createVersionSchema = z.object({
  caseId: z.number(),
  appealContent: z.string().min(10).max(10000),
  arguments: z.array(z.string()).optional(),
  evidenceIds: z.array(z.number()).optional(),
  changeSummary: z.string().optional(),
});

const compareVersionsSchema = z.object({
  caseId: z.number(),
  version1Id: z.number(),
  version2Id: z.number(),
});

const saveLearningsSchema = z.object({
  caseId: z.number(),
  whatWorked: z.string().optional(),
  whatDidntWork: z.string().optional(),
  keyInsights: z.string().optional(),
  recommendationsForFuture: z.string().optional(),
});

const submitVersionSchema = z.object({
  caseId: z.number(),
  versionId: z.number(),
});

export function initAppealRoutes(pool: Pool) {
  const appealService = new AppealVersioningService(pool);

  // Create new appeal version
  router.post('/versions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const validation = createVersionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { caseId, appealContent, arguments: args, evidenceIds, changeSummary } = validation.data;
      const userDiscordId = (req as any).user.discord_id;

      const version = await appealService.createAppealVersion(
        caseId,
        appealContent,
        args || [],
        evidenceIds || [],
        userDiscordId,
        changeSummary
      );

      res.json({
        success: true,
        version,
        message: `Appeal version ${version.version_number} created successfully`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all appeal versions
  router.get('/:caseId/versions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const versions = await appealService.getAppealVersions(parseInt(caseId));

      res.json({
        success: true,
        versions,
        count: versions.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific appeal version
  router.get('/:caseId/versions/:versionId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId, versionId } = req.params;
      const version = await appealService.getAppealVersion(parseInt(caseId), parseInt(versionId));

      res.json({
        success: true,
        version,
      });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  // Compare two versions
  router.post('/:caseId/compare', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const validation = compareVersionsSchema.safeParse({
        caseId: parseInt(caseId),
        ...req.body,
      });

      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { version1Id, version2Id } = validation.data;
      const comparison = await appealService.compareAppealVersions(
        parseInt(caseId),
        version1Id,
        version2Id
      );

      res.json({
        success: true,
        comparison,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get appeal history
  router.get('/:caseId/history', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const history = await appealService.getAppealHistory(parseInt(caseId), limit);

      res.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save appeal learnings
  router.post('/:caseId/learnings', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const validation = saveLearningsSchema.safeParse({
        caseId: parseInt(caseId),
        ...req.body,
      });

      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { whatWorked, whatDidntWork, keyInsights, recommendationsForFuture } = validation.data;
      const userDiscordId = (req as any).user.discord_id;

      const learning = await appealService.saveAppealLearnings(
        parseInt(caseId),
        whatWorked || '',
        whatDidntWork || '',
        keyInsights || '',
        recommendationsForFuture || '',
        userDiscordId
      );

      res.json({
        success: true,
        learning,
        message: 'Learnings saved successfully',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get appeal learnings
  router.get('/:caseId/learnings', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const learnings = await appealService.getAppealLearnings(parseInt(caseId));

      res.json({
        success: true,
        learnings,
        count: learnings.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Find similar appeals
  router.get('/:caseId/similar', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

      const similar = await appealService.findSimilarAppeals(parseInt(caseId), limit);

      res.json({
        success: true,
        similar,
        count: similar.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Submit appeal version
  router.post('/:caseId/submit', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { versionId } = req.body;
      const userDiscordId = (req as any).user.discord_id;

      const validation = submitVersionSchema.safeParse({
        caseId: parseInt(caseId),
        versionId,
      });

      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const submitted = await appealService.submitAppealVersion(
        parseInt(caseId),
        versionId,
        userDiscordId
      );

      res.json({
        success: true,
        version: submitted,
        message: 'Appeal submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Archive appeal version
  router.post('/:caseId/versions/:versionId/archive', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId, versionId } = req.params;
      const archived = await appealService.archiveAppealVersion(parseInt(caseId), parseInt(versionId));

      res.json({
        success: true,
        version: archived,
        message: 'Appeal version archived',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get active appeal version
  router.get('/:caseId/active', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const active = await appealService.getActiveAppealVersion(parseInt(caseId));

      res.json({
        success: true,
        version: active,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get version timeline
  router.get('/:caseId/timeline', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const timeline = await appealService.getVersionTimeline(parseInt(caseId));

      res.json({
        success: true,
        timeline,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rollback to previous version
  router.post('/:caseId/rollback', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { targetVersionId } = req.body;
      const userDiscordId = (req as any).user.discord_id;

      const rolledBack = await appealService.rollbackToVersion(
        parseInt(caseId),
        targetVersionId,
        userDiscordId
      );

      res.json({
        success: true,
        version: rolledBack,
        message: 'Successfully rolled back to previous version',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default router;

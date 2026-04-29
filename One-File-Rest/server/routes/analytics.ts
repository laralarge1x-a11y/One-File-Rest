import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { analyticsQuerySchema, validateQuery } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/analytics - Get analytics dashboard data
 */
router.get('/', validateQuery(analyticsQuerySchema), async (req: Request, res: Response) => {
  try {
    const validatedQuery = (req as any).validatedQuery;
    const { startDate, endDate, metric, groupBy } = validatedQuery;
    const discordId = req.user?.discord_id;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get user's cases
    const casesResult = await pool.query(
      `SELECT * FROM cases WHERE user_discord_id = $1 AND created_at BETWEEN $2 AND $3`,
      [discordId, start, end]
    );

    const cases = casesResult.rows;

    // Calculate metrics
    const totalCases = cases.length;
    const wonCases = cases.filter(c => c.outcome === 'won').length;
    const deniedCases = cases.filter(c => c.outcome === 'denied').length;
    const pendingCases = cases.filter(c => !c.outcome).length;

    const winRate = totalCases > 0 ? Math.round((wonCases / totalCases) * 100) : 0;

    // Get average resolution time
    const resolvedCases = cases.filter(c => c.outcome);
    const avgResolutionTime = resolvedCases.length > 0
      ? Math.round(
          resolvedCases.reduce((sum, c) => {
            const created = new Date(c.created_at).getTime();
            const updated = new Date(c.updated_at).getTime();
            return sum + (updated - created);
          }, 0) / resolvedCases.length / (1000 * 60 * 60 * 24)
        )
      : 0;

    // Get violation type breakdown
    const violationBreakdown = cases.reduce((acc, c) => {
      acc[c.violation_type] = (acc[c.violation_type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Get status breakdown
    const statusBreakdown = cases.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    res.json({
      period: {
        start,
        end
      },
      summary: {
        totalCases,
        wonCases,
        deniedCases,
        pendingCases,
        winRate: `${winRate}%`,
        avgResolutionTime: `${avgResolutionTime} days`
      },
      breakdown: {
        byViolationType: violationBreakdown,
        byStatus: statusBreakdown
      },
      cases
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/admin - Get admin analytics (staff only)
 */
router.get('/admin', async (req: Request, res: Response) => {
  try {
    // Get all cases
    const casesResult = await pool.query(`SELECT * FROM cases`);
    const cases = casesResult.rows;

    // Get all users
    const usersResult = await pool.query(`SELECT COUNT(*) as count FROM users`);
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Get active subscriptions
    const subsResult = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`
    );
    const activeSubscriptions = parseInt(subsResult.rows[0].count);

    // Calculate metrics
    const totalCases = cases.length;
    const wonCases = cases.filter(c => c.outcome === 'won').length;
    const deniedCases = cases.filter(c => c.outcome === 'denied').length;
    const winRate = totalCases > 0 ? Math.round((wonCases / totalCases) * 100) : 0;

    // Get top violation types
    const violationBreakdown = cases.reduce((acc, c) => {
      acc[c.violation_type] = (acc[c.violation_type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const topViolations = Object.entries(violationBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    res.json({
      platform: {
        totalUsers,
        activeSubscriptions,
        totalCases
      },
      performance: {
        totalCases,
        wonCases,
        deniedCases,
        winRate: `${winRate}%`
      },
      topViolations: Object.fromEntries(topViolations)
    });
  } catch (err) {
    console.error('Error fetching admin analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;

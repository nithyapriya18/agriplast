import { Request, Response } from 'express';
import { usageTrackingService } from '../services/usageTracking';

/**
 * Get usage summary for a user
 * Query params: userId (required), startDate, endDate
 */
export async function getUsageSummary(req: Request, res: Response) {
  try {
    const { userId, startDate, endDate } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const summary = await usageTrackingService.getTotalUsage(userId, start, end);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    res.status(500).json({
      error: 'Failed to fetch usage summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get detailed usage logs for a user
 * Query params: userId (required), startDate, endDate, projectId, operationType, limit
 */
export async function getUsageLogs(req: Request, res: Response) {
  try {
    const { userId, startDate, endDate, projectId, operationType } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const logs = await usageTrackingService.getUserUsage(userId, {
      startDate: start,
      endDate: end,
      projectId: projectId as string | undefined,
      operationType: operationType as string | undefined,
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    res.status(500).json({
      error: 'Failed to fetch usage logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get aggregated usage statistics
 * Query params: userId (required), startDate, endDate, groupBy
 */
export async function getAggregatedStats(req: Request, res: Response) {
  try {
    const { userId, startDate, endDate, groupBy } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const stats = await usageTrackingService.getAggregatedStats(userId, {
      startDate: start,
      endDate: end,
      groupBy: groupBy as 'day' | 'project' | 'operation' | undefined,
    });

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching aggregated stats:', error);
    res.status(500).json({
      error: 'Failed to fetch aggregated stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

import express from 'express';
import {
  getUsageSummary,
  getUsageLogs,
  getAggregatedStats,
} from '../controllers/usageController';

export const usageRouter = express.Router();

// Get usage summary for a user
usageRouter.get('/summary', getUsageSummary);

// Get detailed usage logs
usageRouter.get('/logs', getUsageLogs);

// Get aggregated statistics
usageRouter.get('/stats', getAggregatedStats);

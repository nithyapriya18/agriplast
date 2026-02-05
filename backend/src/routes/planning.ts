import { Router } from 'express';
import { createPlan, updatePlan, loadPlanIntoMemory, getJobStatus } from '../controllers/planningController';

export const planningRouter = Router();

// Create a new polyhouse plan
planningRouter.post('/create', createPlan);

// Get job status (for async processing)
planningRouter.get('/status/:jobId', getJobStatus);

// Update an existing plan
planningRouter.put('/update', updatePlan);

// Load an existing plan into memory for chat (used when opening saved projects)
planningRouter.post('/load', loadPlanIntoMemory);

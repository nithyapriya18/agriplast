import { Router } from 'express';
import { createPlan, updatePlan, loadPlanIntoMemory } from '../controllers/planningController';

export const planningRouter = Router();

// Create a new polyhouse plan
planningRouter.post('/create', createPlan);

// Update an existing plan
planningRouter.put('/update', updatePlan);

// Load an existing plan into memory for chat (used when opening saved projects)
planningRouter.post('/load', loadPlanIntoMemory);

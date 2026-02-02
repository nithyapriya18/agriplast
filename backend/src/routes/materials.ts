import { Router } from 'express';
import { getMaterials } from '../controllers/materialsController';

export const materialsRouter = Router();

// Get available materials catalog
materialsRouter.get('/', getMaterials);

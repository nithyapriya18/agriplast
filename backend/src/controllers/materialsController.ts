import { Request, Response } from 'express';
import { materialsCatalog } from '../data/materials';

/**
 * Get available materials catalog
 */
export async function getMaterials(req: Request, res: Response) {
  try {
    res.json({
      materials: materialsCatalog,
    });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({
      error: 'Failed to fetch materials',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

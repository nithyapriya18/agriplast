import { Router } from 'express';
import { Request, Response } from 'express';

export const settingsRouter = Router();

/**
 * Get user settings
 */
settingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Return default settings for now
    // In production, fetch from database
    res.json({
      polyhouse_gap: 2.0,
      max_side_length: 100.0,
      min_side_length: 8.0,
      min_corner_distance: 4.0,
      gutter_width: 2.0,
      block_width: 8.0,
      block_height: 4.0,
      safety_buffer: 1.0,
      max_land_area: 10000.0,
      placement_strategy: 'balanced',
      solar_orientation_enabled: true,
      avoid_water: true,
      consider_slope: false,
      max_slope: 15.0,
      land_leveling_override: false,
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

/**
 * Update user settings
 */
settingsRouter.put('/', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    
    // In production, save to database
    // For now, just return success
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

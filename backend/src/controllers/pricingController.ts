import { Request, Response } from 'express';
import { pricingService, UserPricingSettings } from '../services/pricingService';
import { DEFAULT_PRICING, PricingConfiguration } from '../data/pricingConfig';

/**
 * Get default pricing configuration (catalog)
 */
export async function getDefaultPricing(req: Request, res: Response) {
  try {
    res.json({
      pricing: DEFAULT_PRICING,
      description: 'Default Agriplast pricing catalog with economy, standard, and premium tiers',
    });
  } catch (error) {
    console.error('Error fetching default pricing:', error);
    res.status(500).json({
      error: 'Failed to fetch default pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get user's active pricing configuration
 */
export async function getUserPricing(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { pricing, settings } = await pricingService.getUserPricing(userId);

    res.json({
      pricing,
      settings: {
        pricingTier: settings.pricingTier,
        serviceChargePercentage: settings.serviceChargePercentage,
        profitMarginPercentage: settings.profitMarginPercentage,
        gstPercentage: settings.gstPercentage,
        transportationCostPerKm: settings.transportationCostPerKm,
        installationLaborRate: settings.installationLaborRate,
      },
      customPricing: settings.customPricing || pricing, // Return custom or merged pricing
    });
  } catch (error) {
    console.error('Error fetching user pricing:', error);
    res.status(500).json({
      error: 'Failed to fetch user pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update user's pricing configuration
 */
export async function updateUserPricing(req: Request, res: Response) {
  try {
    const { userId, updates } = req.body as {
      userId: string;
      updates: Partial<UserPricingSettings>;
    };

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!updates) {
      return res.status(400).json({ error: 'updates object is required' });
    }

    const success = await pricingService.updateUserPricing(userId, updates);

    if (success) {
      res.json({ success: true, message: 'Pricing updated successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update pricing' });
    }
  } catch (error) {
    console.error('Error updating user pricing:', error);
    res.status(500).json({
      error: 'Failed to update user pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Reset user pricing to defaults
 */
export async function resetPricingToDefaults(req: Request, res: Response) {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const success = await pricingService.resetToDefaults(userId);

    if (success) {
      res.json({ success: true, message: 'Pricing reset to defaults successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to reset pricing' });
    }
  } catch (error) {
    console.error('Error resetting pricing:', error);
    res.status(500).json({
      error: 'Failed to reset pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

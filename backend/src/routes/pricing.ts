import express from 'express';
import {
  getDefaultPricing,
  getUserPricing,
  updateUserPricing,
  resetPricingToDefaults,
} from '../controllers/pricingController';

export const pricingRouter = express.Router();

// Get default pricing catalog
pricingRouter.get('/defaults', getDefaultPricing);

// Get user's active pricing configuration
pricingRouter.get('/user', getUserPricing);

// Update user's pricing configuration
pricingRouter.post('/user/update', updateUserPricing);

// Reset user pricing to defaults
pricingRouter.post('/user/reset', resetPricingToDefaults);

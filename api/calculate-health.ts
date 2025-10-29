import type { VercelRequest, VercelResponse } from '@vercel/node';
import { calculatePositionMetrics } from './tools/calculate-health.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      collateral_amount,
      collateral_token,
      leverage,
      target_apy,
      liquidation_threshold,
      borrow_apy
    } = req.body;

    // Validate required parameters
    if (!collateral_amount || !collateral_token || !leverage || !target_apy) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['collateral_amount', 'collateral_token', 'leverage', 'target_apy']
      });
    }

    // Calculate position metrics
    const metrics = await calculatePositionMetrics({
      collateral_amount,
      collateral_token,
      leverage,
      target_apy,
      liquidation_threshold, // Optional - real LT from credit manager
      borrow_apy, // Optional - real borrow APY from pool
    });

    return res.status(200).json(metrics);

  } catch (error: any) {
    console.error('Health calculation API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message || 'Unknown error',
    });
  }
}

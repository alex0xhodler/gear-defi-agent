// Tool implementation: calculate_position_metrics
// Calculates health factor, liquidation price, and projected returns for leveraged positions

import { getTokenPriceUSD } from '../utils/price-oracle.js';

export interface PositionMetrics {
  healthFactor: number;
  liquidationPrice: number;
  collateralValueUSD: number;
  debtValueUSD: number;
  projectedMonthlyReturn: number;
  projectedYearlyReturn: number;
  borrowingCostAPY: number;
  netAPY: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  recommendations: string[];
}

export async function calculatePositionMetrics(params: {
  collateral_amount: number;
  collateral_token: string;
  leverage: number;
  target_apy: number;
  liquidation_threshold?: number; // Real LT from credit manager (0-1 scale)
  borrow_apy?: number; // Real borrow APY from pool
}): Promise<PositionMetrics> {
  const { collateral_amount, collateral_token, leverage, target_apy, liquidation_threshold, borrow_apy } = params;

  // Validate inputs
  if (collateral_amount <= 0) {
    throw new Error('Collateral amount must be positive');
  }
  if (leverage < 1 || leverage > 10) {
    throw new Error('Leverage must be between 1x and 10x');
  }

  const token = collateral_token.toUpperCase();

  // Use real Gearbox price oracle
  const tokenPrice = await getTokenPriceUSD(token);
  const collateralValueUSD = collateral_amount * tokenPrice;

  // Calculate debt amount (leverage = collateral + debt / collateral)
  // E.g., 3x leverage = 3 = (collateral + debt) / collateral
  // So debt = collateral * (leverage - 1)
  const debtValueUSD = collateralValueUSD * (leverage - 1);
  const totalPositionValue = collateralValueUSD + debtValueUSD;

  // Use real liquidation threshold from credit manager, or fallback to 80%
  const ltv = liquidation_threshold || 0.80;
  console.log(`📊 Using liquidation threshold for ${token}: ${(ltv * 100).toFixed(1)}%`);

  // Health Factor = (Collateral * LTV) / Debt
  // If HF < 1, position is liquidatable
  const healthFactor = debtValueUSD > 0 ? (collateralValueUSD * ltv) / debtValueUSD : 999;

  // Liquidation price = current price * (1 - (1 - 1/HF) / (1 - 1/leverage))
  // Simplified: liquidation occurs when collateral value drops such that HF = 1
  const liquidationPrice = tokenPrice * (1 / healthFactor) * ltv;

  // Calculate returns using real borrow APY
  const borrowAPY = borrow_apy || 5.0; // Use real borrow APY from pool
  console.log(`💸 Using borrow APY for ${token}: ${borrowAPY.toFixed(2)}%`);

  const grossYieldAPY = target_apy * leverage; // Leveraged yield
  const borrowCostAPY = borrowAPY * (leverage - 1); // Borrow cost on debt portion
  const netAPY = grossYieldAPY - borrowCostAPY;

  const projectedYearlyReturn = (collateralValueUSD * netAPY) / 100;
  const projectedMonthlyReturn = projectedYearlyReturn / 12;

  // Risk assessment
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (healthFactor >= 1.5) riskLevel = 'low';
  else if (healthFactor >= 1.3) riskLevel = 'medium';
  else if (healthFactor >= 1.1) riskLevel = 'high';
  else riskLevel = 'critical';

  // Generate warnings
  const warnings: string[] = [];
  if (healthFactor < 1.2) {
    warnings.push(`⚠️ CRITICAL: Health factor ${healthFactor.toFixed(2)} is dangerously low. High liquidation risk!`);
  } else if (healthFactor < 1.3) {
    warnings.push(`⚠️ WARNING: Health factor ${healthFactor.toFixed(2)} is low. Consider reducing leverage.`);
  }

  if (leverage > 5) {
    warnings.push(`High leverage (${leverage.toFixed(1)}x) amplifies both gains and losses.`);
  }

  if (netAPY < 0) {
    warnings.push(`❌ Negative net APY (${netAPY.toFixed(2)}%). Borrowing costs exceed yield!`);
  }

  if (liquidationPrice > tokenPrice * 0.8) {
    warnings.push(`Liquidation price ($${liquidationPrice.toFixed(2)}) is only ${(((tokenPrice - liquidationPrice) / tokenPrice) * 100).toFixed(1)}% below current price.`);
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (healthFactor < 1.3) {
    const saferLeverage = Math.max(1, leverage * 0.7);
    recommendations.push(`Reduce leverage to ${saferLeverage.toFixed(1)}x for health factor >1.5`);
  }

  if (netAPY > 20) {
    recommendations.push(`Exceptional ${netAPY.toFixed(1)}% net APY! Monitor closely for sustainability.`);
  } else if (netAPY > 10) {
    recommendations.push(`Strong ${netAPY.toFixed(1)}% net APY. Good risk-adjusted returns.`);
  } else if (netAPY > 5) {
    recommendations.push(`Moderate ${netAPY.toFixed(1)}% net APY. Consider if worth the liquidation risk.`);
  }

  if (healthFactor >= 1.5) {
    recommendations.push('✅ Healthy position with good safety margin. You can weather moderate price swings.');
  }

  return {
    healthFactor,
    liquidationPrice,
    collateralValueUSD,
    debtValueUSD,
    projectedMonthlyReturn,
    projectedYearlyReturn,
    borrowingCostAPY: borrowCostAPY,
    netAPY,
    riskLevel,
    warnings,
    recommendations,
  };
}

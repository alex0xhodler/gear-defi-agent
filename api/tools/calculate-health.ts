// Tool implementation: calculate_position_metrics
// Calculates health factor, liquidation price, and projected returns for leveraged positions

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

// Token liquidation thresholds (Gearbox V3 typical values)
const LIQUIDATION_THRESHOLDS: Record<string, number> = {
  USDC: 0.95, // 95% LTV (very safe)
  USDT: 0.95,
  DAI: 0.95,
  WETH: 0.85, // 85% LTV
  wstETH: 0.83, // 83% LTV
  WBTC: 0.80, // 80% LTV
};

// Borrowing APY rates (approximate Gearbox rates)
const BORROW_RATES: Record<string, number> = {
  USDC: 4.5,
  USDT: 4.2,
  DAI: 4.8,
  WETH: 3.5,
  wstETH: 3.2,
  WBTC: 5.0,
};

// Get token price (simplified - in production use oracle)
async function getTokenPrice(symbol: string): Promise<number> {
  const prices: Record<string, number> = {
    USDC: 1,
    USDT: 1,
    DAI: 1,
    WETH: 3000,
    wstETH: 3500,
    WBTC: 60000,
  };

  return prices[symbol.toUpperCase()] || 1;
}

export async function calculatePositionMetrics(params: {
  collateral_amount: number;
  collateral_token: string;
  leverage: number;
  target_apy: number;
}): Promise<PositionMetrics> {
  const { collateral_amount, collateral_token, leverage, target_apy } = params;

  // Validate inputs
  if (collateral_amount <= 0) {
    throw new Error('Collateral amount must be positive');
  }
  if (leverage < 1 || leverage > 10) {
    throw new Error('Leverage must be between 1x and 10x');
  }

  const token = collateral_token.toUpperCase();
  const tokenPrice = await getTokenPrice(token);
  const collateralValueUSD = collateral_amount * tokenPrice;

  // Calculate debt amount (leverage = collateral + debt / collateral)
  // E.g., 3x leverage = 3 = (collateral + debt) / collateral
  // So debt = collateral * (leverage - 1)
  const debtValueUSD = collateralValueUSD * (leverage - 1);
  const totalPositionValue = collateralValueUSD + debtValueUSD;

  // Get liquidation threshold for this token
  const ltv = LIQUIDATION_THRESHOLDS[token] || 0.80;

  // Health Factor = (Collateral * LTV) / Debt
  // If HF < 1, position is liquidatable
  const healthFactor = debtValueUSD > 0 ? (collateralValueUSD * ltv) / debtValueUSD : 999;

  // Liquidation price = current price * (1 - (1 - 1/HF) / (1 - 1/leverage))
  // Simplified: liquidation occurs when collateral value drops such that HF = 1
  const liquidationPrice = tokenPrice * (1 / healthFactor) * ltv;

  // Calculate returns
  const borrowAPY = BORROW_RATES[token] || 5.0;
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

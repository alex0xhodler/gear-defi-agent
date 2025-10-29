// Tool implementation: query_farm_opportunities
// Fetches real yield data from Gearbox Protocol SDK

import { getGearboxSDK } from '../utils/gearbox-sdk.js';

export interface GearboxOpportunity {
  // Core fields
  id: string;
  title: string;
  chain: string;
  strategy: string;
  projAPY: number;
  collateralAPY: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  leverage: number;
  estimatedGas: number;

  // Gearbox-specific fields
  poolAddress: string;
  creditManagerAddress: string;
  underlyingToken: string;
  supportedCollateral: string[];
  liquidationThreshold: number; // LTV as percentage

  // Leverage calculation metadata
  minLeverage: number;
  maxLeverage: number;
  borrowAPY: number; // For recalculating projAPY on leverage change
}

export async function queryFarmOpportunities(params: {
  asset: string;
  min_apy?: number;
  risk_tolerance?: 'low' | 'medium' | 'high';
  max_leverage?: number;
}): Promise<GearboxOpportunity[]> {
  try {
    // Initialize SDK
    const sdk = await getGearboxSDK();
    const markets = sdk.marketRegister.markets;

    console.log('🔍 Querying Gearbox markets for:', params.asset);

    // Step 1: Filter markets by asset - ONLY match pool underlying token
    const relevantMarkets = markets.filter(market => {
      // Check if pool underlying matches (e.g., USDC pool, WETH pool)
      const poolToken = sdk.tokensMeta.get(market.pool.pool.underlying);
      const poolSymbol = poolToken?.symbol || '';

      // Match the pool's underlying token to the requested asset
      return poolSymbol.toUpperCase().includes(params.asset.toUpperCase());
    });

    console.log(`✅ Found ${relevantMarkets.length} relevant markets`);

    // Step 2: Transform markets into opportunities
    const opportunities: GearboxOpportunity[] = [];

    for (const market of relevantMarkets) {
      const poolToken = sdk.tokensMeta.get(market.pool.pool.underlying);
      const underlyingSymbol = poolToken?.symbol || 'Unknown';

      for (const cm of market.creditManagers) {
        // Calculate base supply APY (27 decimals)
        const supplyAPY = Number(market.pool.pool.supplyRate) / 1e25;

        // Get quota rate for main collateral token (additional yield)
        const mainCollateral = cm.creditManager.collateralTokens[0];
        const quotaData = market.pool.pqk.quotas.get(mainCollateral);
        const quotaRate = quotaData?.rate ? Number(quotaData.rate) / 10000 : 0;

        // Borrow APY = supply + quota
        const borrowAPY = supplyAPY + quotaRate;

        // Calculate leverage range
        const ltValues = Object.values(cm.creditManager.liquidationThresholds);
        const maxLT = Math.max(...ltValues) / 10000;
        const minLeverage = 1; // 1x = no leverage
        const absoluteMaxLeverage = Math.floor(1 / (1 - maxLT * 0.8)); // 80% of max for safety
        const maxLeverage = Math.min(absoluteMaxLeverage, 10); // Cap at 10x

        // Default leverage: use user's preference or optimal (safe) leverage
        const defaultLeverage = Math.min(
          params.max_leverage || maxLeverage,
          maxLeverage
        );

        // Projected APY with leverage: (supplyAPY * leverage) - (borrowAPY * (leverage - 1))
        const projAPY = supplyAPY * defaultLeverage - borrowAPY * (defaultLeverage - 1);

        // Filter by minimum APY
        if (projAPY < (params.min_apy || 0)) {
          continue;
        }

        // Calculate TVL (convert from wei to USD)
        const poolDecimals = poolToken?.decimals || 6;
        const tvl = Number(market.pool.pool.expectedLiquidity) / Math.pow(10, poolDecimals);

        // Assess risk
        const risk = assessRisk(projAPY, tvl, defaultLeverage);

        // Filter by risk tolerance
        if (!matchesRiskTolerance(risk, params.risk_tolerance)) {
          continue;
        }

        // Get supported collateral symbols
        const supportedCollateral = cm.creditManager.collateralTokens.map((addr: string) => {
          const token = sdk.tokensMeta.get(addr);
          return token?.symbol || addr;
        });

        opportunities.push({
          id: `${market.pool.pool.address}-${cm.creditManager.address}`,
          title: `${underlyingSymbol} ${cm.name || 'Credit Manager'}`,
          chain: sdk.networkType, // 'Mainnet', 'Arbitrum', etc.
          strategy: `Gearbox ${cm.name || 'Farming'}`,
          projAPY: Number(projAPY.toFixed(2)),
          collateralAPY: Number(supplyAPY.toFixed(2)),
          tvl: Number(tvl.toFixed(0)),
          risk,
          leverage: defaultLeverage,
          estimatedGas: estimateGas(sdk.networkType),

          // Gearbox-specific
          poolAddress: market.pool.pool.address,
          creditManagerAddress: cm.creditManager.address,
          underlyingToken: market.pool.pool.underlying,
          underlyingSymbol: underlyingSymbol, // Add symbol for balance fetching
          supportedCollateral,
          liquidationThreshold: Number((maxLT * 100).toFixed(1)),

          // Leverage calculation metadata
          minLeverage,
          maxLeverage,
          borrowAPY: Number(borrowAPY.toFixed(2)),
        });
      }
    }

    // Sort by APY and return top 3
    const sorted = opportunities
      .sort((a, b) => b.projAPY - a.projAPY)
      .slice(0, 3);

    console.log(`📊 Returning ${sorted.length} opportunities`);

    return sorted;

  } catch (error) {
    console.error('❌ Error querying Gearbox SDK:', error);

    // Return empty array instead of fallback
    return [];
  }
}

function assessRisk(apy: number, tvl: number, leverage: number): 'low' | 'medium' | 'high' {
  // High risk: >5x leverage or >30% APY
  if (leverage > 5 || apy > 30) return 'high';

  // Medium risk: 3-5x leverage or 20-30% APY or low TVL
  if (leverage > 3 || apy > 20 || tvl < 10_000_000) return 'medium';

  // Low risk: everything else
  return 'low';
}

function matchesRiskTolerance(risk: string, tolerance?: string): boolean {
  if (!tolerance || tolerance === 'high') return true;
  if (tolerance === 'medium') return risk !== 'high';
  return risk === 'low';
}

function estimateGas(chain: string): number {
  const gasEstimates: Record<string, number> = {
    Mainnet: 15,
    Arbitrum: 2,
    Optimism: 2,
    Base: 1,
    BNB: 3,
  };
  return gasEstimates[chain] || 10;
}

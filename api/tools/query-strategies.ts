// Tool implementation: query_farm_opportunities
// Fetches real yield data from Gearbox Protocol SDK

import { getGearboxSDK } from '../utils/gearbox-sdk.js';
import { getCurrentGasPrice, estimateGasUnits } from '../utils/gas-estimator.js';
import { getTokenPriceUSD } from '../utils/price-oracle.js';

export interface GearboxOpportunity {
  // Strategy type classification
  strategyType: 'passive_lending' | 'leveraged_credit_account';

  // Core fields
  id: string;
  title: string;
  chain: string;
  strategy: string;
  projAPY: number;
  collateralAPY: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';

  // Gearbox-specific fields
  poolAddress: string;
  underlyingToken: string;
  underlyingSymbol: string; // Token symbol (e.g., 'GHO', 'USDC')
  supportedCollateral: string[];

  // Optional fields (only for leveraged strategies)
  leverage?: number;
  estimatedGas?: number;
  creditManagerAddress?: string;
  liquidationThreshold?: number; // Max LTV as percentage (for display)
  liquidationThresholds?: Record<string, number>; // Per-token LTs (symbol => LT in 0-1 scale)
  minLeverage?: number;
  maxLeverage?: number;
  borrowAPY?: number; // For recalculating projAPY on leverage change
}

export async function queryFarmOpportunities(params: {
  asset: string;
  min_apy?: number;
  risk_tolerance?: 'low' | 'medium' | 'high';
  max_leverage?: number;
}): Promise<GearboxOpportunity[]> {
  try {
    // Determine chain based on asset
    const chainId = params.asset.toUpperCase() === 'USDT0' ? 146 : undefined; // 146 = Plasma

    // Initialize SDK for the appropriate chain
    const sdk = await getGearboxSDK(chainId);
    const markets = sdk.marketRegister.markets;

    console.log('🔍 Querying Gearbox markets for:', params.asset, chainId ? `(chain: ${chainId})` : '(mainnet)');

    // Fetch gas price once for all opportunities (parallel optimization)
    const gasPriceGwei = await getCurrentGasPrice();
    const ethPrice = await getTokenPriceUSD('WETH');

    // Calculate gas cost in USD
    const gasUnits = estimateGasUnits('openAccount');
    const gasCostUSD = Math.round((Number(gasUnits) * gasPriceGwei * ethPrice) / 1e9);
    console.log(`⛽ Estimated gas cost: ${gasUnits.toString()} units × ${gasPriceGwei.toFixed(2)} gwei = $${gasCostUSD}`);

    // Step 1: Filter markets by asset - ONLY match pool underlying token
    const relevantMarkets = markets.filter(market => {
      // Check if pool underlying matches (e.g., USDC pool, WETH pool)
      const poolToken = sdk.tokensMeta.get(market.pool.pool.underlying);
      const poolSymbol = poolToken?.symbol || '';

      // Match the pool's underlying token to the requested asset
      return poolSymbol.toUpperCase().includes(params.asset.toUpperCase());
    });

    console.log(`✅ Found ${relevantMarkets.length} relevant markets for ${params.asset}`);

    // Step 2: Transform markets into opportunities
    const opportunities: GearboxOpportunity[] = [];

    for (const market of relevantMarkets) {
      const poolToken = sdk.tokensMeta.get(market.pool.pool.underlying);
      const underlyingSymbol = poolToken?.symbol || 'Unknown';
      const poolDecimals = poolToken?.decimals || 6;

      // Calculate base supply APY (27 decimals)
      const supplyAPY = Number(market.pool.pool.supplyRate) / 1e25;

      // Calculate TVL (convert from wei to USD)
      const tvl = Number(market.pool.pool.expectedLiquidity) / Math.pow(10, poolDecimals);

      // Create friendly pool name (e.g., "GHO V3", "USDC V3")
      const poolVersion = "V3"; // Gearbox V3
      const friendlyTitle = `${underlyingSymbol} ${poolVersion}`;

      // 1. ALWAYS create passive lending opportunity
      opportunities.push({
        id: `${market.pool.pool.address}-lending`,
        title: friendlyTitle, // ← Friendly name
        chain: sdk.networkType,
        strategy: `Passive Lending`,
        strategyType: 'passive_lending',
        projAPY: Number(supplyAPY.toFixed(2)),
        collateralAPY: Number(supplyAPY.toFixed(2)),
        tvl: Number(tvl.toFixed(0)),
        risk: 'low', // Lending is always low risk
        poolAddress: market.pool.pool.address,
        underlyingToken: market.pool.pool.underlying,
        underlyingSymbol,
        supportedCollateral: [underlyingSymbol], // Can only deposit the underlying token
      });

      console.log(`✅ Added passive lending pool: ${friendlyTitle} @ ${supplyAPY.toFixed(2)}% APY`);

      /*
      // COMMENTED OUT: Leveraged credit account strategies
      // Focusing on passive lending only for simpler UX

      // 2. Generate leveraged opportunities for each credit manager
      for (const cm of market.creditManagers) {
        // Get quota rate for main collateral token
        const mainCollateral = cm.creditManager.collateralTokens[0];
        const quotaData = market.pool.pqk.quotas.get(mainCollateral);
        const quotaRate = quotaData?.rate ? Number(quotaData.rate) / 10000 : 0;
        const borrowAPY = supplyAPY + quotaRate;

        // Calculate leverage range
        const ltValues = Array.from(cm.creditManager.liquidationThresholds.values());
        if (ltValues.length === 0) {
          console.log(`⏭️  Skipping ${underlyingSymbol} ${cm.name}: no liquidation thresholds`);
          continue;
        }

        const maxLT = Math.max(...ltValues.map(v => Number(v))) / 10000;

        // Validate liquidation threshold
        if (maxLT <= 0 || maxLT >= 1) {
          console.log(`⏭️  Skipping ${underlyingSymbol} ${cm.name}: invalid LT=${maxLT}`);
          continue;
        }

        const minLeverage = 1;
        const absoluteMaxLeverage = Math.floor(1 / (1 - maxLT * 0.8));

        // Skip if leverage is invalid or too low
        if (!isFinite(absoluteMaxLeverage) || absoluteMaxLeverage < 1.5) {
          console.log(`⏭️  Skipping ${underlyingSymbol} ${cm.name}: maxLeverage=${absoluteMaxLeverage} (too low)`);
          continue;
        }

        const maxLeverage = Math.min(absoluteMaxLeverage, 15); // Allow up to 15x

        // Use optimal leverage (80% of max for safety) or user preference
        const optimalLeverage = Math.min(
          params.max_leverage || (maxLeverage * 0.8),
          maxLeverage
        );

        // Calculate leveraged APY at optimal leverage
        const projAPY = supplyAPY * optimalLeverage - borrowAPY * (optimalLeverage - 1);

        console.log(`📊 ${underlyingSymbol} ${cm.name}: ${projAPY.toFixed(2)}% APY @ ${optimalLeverage.toFixed(1)}x leverage (max: ${maxLeverage}x)`);

        // Filter by minimum APY
        if (params.min_apy && projAPY < params.min_apy) {
          console.log(`⏭️  Skipping ${underlyingSymbol} ${cm.name}: APY ${projAPY.toFixed(2)}% below minimum ${params.min_apy}%`);
          continue;
        }

        // Calculate risk for leveraged position
        const risk = assessRisk(projAPY, tvl, optimalLeverage);

        // Filter by risk tolerance
        if (!matchesRiskTolerance(risk, params.risk_tolerance)) {
          console.log(`⏭️  Skipping ${underlyingSymbol} ${cm.name}: risk ${risk} doesn't match tolerance ${params.risk_tolerance}`);
          continue;
        }

        // Get supported collateral
        const supportedCollateral = cm.creditManager.collateralTokens.map((addr: string) => {
          const token = sdk.tokensMeta.get(addr);
          return token?.symbol || addr;
        });

        // Build per-token liquidation thresholds
        const perTokenLTs: Record<string, number> = {};
        for (const tokenAddr of cm.creditManager.collateralTokens) {
          const token = sdk.tokensMeta.get(tokenAddr);
          const ltBigInt = cm.creditManager.liquidationThresholds.get(tokenAddr);
          if (token && ltBigInt !== undefined) {
            perTokenLTs[token.symbol] = Number(ltBigInt) / 10000;
          }
        }

        console.log(`📊 Liquidation thresholds for ${underlyingSymbol} ${cm.name}:`, perTokenLTs);

        opportunities.push({
          id: `${market.pool.pool.address}-${cm.creditManager.address}`,
          title: `${underlyingSymbol} ${cm.name || 'Leveraged'}`,
          chain: sdk.networkType,
          strategy: `Gearbox ${cm.name || 'Credit Manager'}`,
          strategyType: 'leveraged_credit_account',
          projAPY: Number(projAPY.toFixed(2)),
          collateralAPY: Number(supplyAPY.toFixed(2)),
          tvl: Number(tvl.toFixed(0)),
          risk,
          leverage: optimalLeverage,
          estimatedGas: gasCostUSD,
          poolAddress: market.pool.pool.address,
          creditManagerAddress: cm.creditManager.address,
          underlyingToken: market.pool.pool.underlying,
          underlyingSymbol,
          supportedCollateral,
          liquidationThreshold: Number((maxLT * 100).toFixed(1)),
          liquidationThresholds: perTokenLTs,
          minLeverage,
          maxLeverage,
          borrowAPY: Number(borrowAPY.toFixed(2)),
        });

        console.log(`✅ Added leveraged strategy: ${underlyingSymbol} ${cm.name} @ ${projAPY.toFixed(2)}% APY (${optimalLeverage.toFixed(1)}x leverage)`);
      }
      */
      // END OF COMMENTED OUT SECTION
    }

    // Return ALL passive lending pools sorted by APY (no limit)
    const sorted = opportunities
      .sort((a, b) => b.projAPY - a.projAPY);

    console.log(`📊 Returning ${sorted.length} passive lending pools sorted by APY:`);
    sorted.forEach(opp => {
      console.log(`  - ${opp.title}: ${opp.projAPY}% APY`);
    });

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

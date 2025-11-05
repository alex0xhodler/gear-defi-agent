/**
 * Opportunity Preview Utility
 * Quickly fetches current best APYs for detected assets
 * Used during onboarding to show "what you're missing" moment
 */

const { queryFarmOpportunities } = require('../query-opportunities');

/**
 * Get current best APY for a specific asset
 * @param {string} asset - Asset symbol (USDC, wstETH, etc.)
 * @returns {Promise<Object>} Best opportunity or null
 */
async function getBestCurrentAPY(asset) {
  try {
    // Query opportunities for this asset with no filters
    const opportunities = await queryFarmOpportunities({
      asset: asset,
      min_apy: 0, // Get all, find the best
    });

    if (!opportunities || opportunities.length === 0) {
      return null;
    }

    // Sort by highest APY
    opportunities.sort((a, b) => {
      const apyA = a.projAPY || a.apy || 0;
      const apyB = b.projAPY || b.apy || 0;
      return apyB - apyA;
    });

    const best = opportunities[0];
    const bestAPY = best.projAPY || best.apy || 0;

    return {
      asset,
      apy: bestAPY,
      protocol: best.strategy || best.pool_name || 'Unknown',
      chain: best.chain || 'Ethereum',
      poolAddress: best.pool_address,
      chainId: best.chain_id || 1,
    };
  } catch (error) {
    console.error(`⚠️  Error fetching best APY for ${asset}:`, error.message);
    return null;
  }
}

/**
 * Get current best rates for multiple assets
 * @param {Array<string>} assets - Array of asset symbols
 * @returns {Promise<Array>} Array of best rates
 */
async function getBestCurrentRates(assets) {
  try {
    console.log(`   📊 Fetching current best rates for: ${assets.join(', ')}`);

    const promises = assets.map(asset => getBestCurrentAPY(asset));
    const results = await Promise.all(promises);

    // Filter out null results
    const validResults = results.filter(r => r !== null);

    console.log(`   ✅ Found ${validResults.length}/${assets.length} current opportunities`);

    return validResults;
  } catch (error) {
    console.error('❌ Error fetching best rates:', error.message);
    return [];
  }
}

/**
 * Calculate potential monthly earnings
 * @param {number} valueUSD - Asset value in USD
 * @param {number} apy - Annual percentage yield
 * @returns {number} Monthly earnings in USD
 */
function calculateMonthlyEarnings(valueUSD, apy) {
  return (valueUSD * (apy / 100)) / 12;
}

/**
 * Get opportunity previews for wallet analysis
 * Combines asset info with current best rates
 * @param {Array} suggestedAssets - From wallet analyzer
 * @returns {Promise<Object>} Preview with total potential earnings
 */
async function getOpportunityPreviews(suggestedAssets) {
  try {
    // Extract asset names
    const assetNames = suggestedAssets.map(sa => sa.asset);

    // Fetch current best rates
    const bestRates = await getBestCurrentRates(assetNames);

    // Combine with asset values
    const previews = suggestedAssets.map(suggestedAsset => {
      const bestRate = bestRates.find(r => r.asset === suggestedAsset.asset);

      if (!bestRate) {
        return {
          asset: suggestedAsset.asset,
          valueUSD: suggestedAsset.valueUSD,
          currentAPY: null,
          protocol: null,
          monthlyEarnings: 0,
        };
      }

      const monthlyEarnings = calculateMonthlyEarnings(suggestedAsset.valueUSD, bestRate.apy);

      return {
        asset: suggestedAsset.asset,
        valueUSD: suggestedAsset.valueUSD,
        currentAPY: bestRate.apy,
        protocol: bestRate.protocol,
        chain: bestRate.chain,
        poolAddress: bestRate.poolAddress,
        chainId: bestRate.chainId,
        monthlyEarnings,
      };
    });

    // Calculate total potential monthly earnings
    const totalMonthlyEarnings = previews.reduce((sum, p) => sum + p.monthlyEarnings, 0);

    return {
      previews,
      totalMonthlyEarnings,
    };
  } catch (error) {
    console.error('❌ Error generating opportunity previews:', error.message);
    return {
      previews: [],
      totalMonthlyEarnings: 0,
    };
  }
}

module.exports = {
  getBestCurrentAPY,
  getBestCurrentRates,
  calculateMonthlyEarnings,
  getOpportunityPreviews,
};

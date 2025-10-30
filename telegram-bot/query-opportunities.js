/**
 * Opportunity querying for Telegram bot
 * Real integration with Gearbox Protocol API
 */

const config = require('./config');

// Cache for APY data to reduce API calls
const apyCache = new Map();
const CACHE_DURATION = config.monitoring.apyCacheDuration;

/**
 * Fetch opportunities from Gearbox Protocol API
 * @param {Object} params - Query parameters { asset, min_apy, max_leverage, risk_tolerance }
 * @returns {Promise<Array>} Array of opportunities
 */
async function queryFarmOpportunities(params) {
  console.log(`   🔍 Querying opportunities for ${params.asset}...`);

  // Use mock data if development flag is set
  if (config.development.useMockData) {
    return queryMockOpportunities(params);
  }

  try {
    // Fetch real opportunities from Gearbox API
    const opportunities = await fetchRealOpportunities(params);
    console.log(`   ✅ Found ${opportunities.length} opportunities for ${params.asset}`);
    return opportunities;
  } catch (error) {
    console.error(`   ❌ Error fetching opportunities:`, error.message);
    // Fallback to mock data on error
    console.log(`   ⚠️ Falling back to mock data`);
    return queryMockOpportunities(params);
  }
}

/**
 * Fetch real opportunities from Gearbox API
 */
async function fetchRealOpportunities(params) {
  const opportunities = [];

  // Gearbox Protocol has pools on both Ethereum and Plasma
  const chains = ['ethereum', 'plasma'];

  for (const chainKey of chains) {
    const chainConfig = config.blockchain.chains[chainKey];
    const pools = config.pools[chainKey];

    // Filter pools by asset
    const relevantPools = pools.filter(pool =>
      pool.token.toUpperCase() === params.asset.toUpperCase()
    );

    for (const pool of relevantPools) {
      try {
        // Fetch APY data for this pool
        const apyData = await fetchPoolAPY(pool.address, chainConfig.id);

        if (!apyData || apyData.supplyAPY === null) {
          console.log(`   ⚠️ No APY data for ${pool.name} on ${chainConfig.name}`);
          continue;
        }

        // Create opportunity object
        const opportunity = {
          id: `${pool.token.toLowerCase()}_${chainKey}_${pool.address.slice(2, 8)}`,
          pool_address: pool.address,
          pool_name: pool.name,
          strategy: `${pool.name} on ${chainConfig.name}`,
          chain: chainConfig.name,
          chain_id: chainConfig.id,
          projAPY: apyData.supplyAPY,
          apy: apyData.supplyAPY,
          leverage: 1, // Non-leveraged by default
          maxLeverage: apyData.maxLeverage || 1,
          healthFactor: null, // Not applicable for non-leveraged
          tvl: apyData.tvl || 0,
          risk: determineRiskLevel(apyData.supplyAPY, 1),
          underlying_token: pool.token,
          decimals: pool.decimals,
        };

        // Apply filters
        if (params.min_apy && opportunity.apy < params.min_apy) {
          continue;
        }

        if (params.max_leverage && opportunity.leverage > params.max_leverage) {
          continue;
        }

        if (params.risk_tolerance) {
          const targetRisk = capitalizeFirstLetter(params.risk_tolerance.toLowerCase());
          if (opportunity.risk !== targetRisk) {
            continue;
          }
        }

        opportunities.push(opportunity);
      } catch (error) {
        console.error(`   ❌ Error processing pool ${pool.name}:`, error.message);
      }
    }
  }

  // Sort by APY descending
  opportunities.sort((a, b) => b.apy - a.apy);

  return opportunities;
}

/**
 * Fetch APY data for a specific pool
 * Uses caching to reduce API calls
 */
async function fetchPoolAPY(poolAddress, chainId) {
  const cacheKey = `${chainId}-${poolAddress}`;
  const cached = apyCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Determine API URL based on chain
    const chainConfig = chainId === 1
      ? config.blockchain.chains.ethereum
      : config.blockchain.chains.plasma;

    // Fetch from Gearbox API
    const response = await fetch(`${chainConfig.gearboxApiUrl}/pools/${poolAddress}`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    // Extract APY data (adjust based on actual API response structure)
    const apyData = {
      supplyAPY: parseFloat(data.apy || data.supplyAPY || 0),
      borrowAPY: parseFloat(data.borrowAPY || 0),
      maxLeverage: parseInt(data.maxLeverage || 1),
      tvl: parseFloat(data.tvl || 0),
    };

    // Cache the result
    apyCache.set(cacheKey, {
      data: apyData,
      timestamp: Date.now(),
    });

    return apyData;
  } catch (error) {
    console.error(`   ❌ Error fetching APY for pool ${poolAddress}:`, error.message);
    return null;
  }
}

/**
 * Determine risk level based on APY and leverage
 */
function determineRiskLevel(apy, leverage) {
  // Higher APY and leverage = higher risk
  const riskScore = (apy / 10) + (leverage * 2);

  if (riskScore < 5) return 'Low';
  if (riskScore < 12) return 'Medium';
  return 'High';
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Mock data fallback for testing
 */
async function queryMockOpportunities(params) {
  console.log(`   🧪 Using mock data for ${params.asset}...`)

  const mockOpportunities = {
    'USDC': [
      {
        id: 'usdc_curve_1',
        pool_address: '0x1234...5678',
        pool_name: 'Curve USDC Pool',
        strategy: 'Curve + Gearbox',
        chain: 'Ethereum',
        projAPY: 8.5,
        apy: 8.5,
        leverage: 2,
        maxLeverage: 3,
        healthFactor: 1.8,
        tvl: 45000000,
        risk: 'Medium'
      },
      {
        id: 'usdc_yearn_1',
        pool_address: '0xabcd...efgh',
        pool_name: 'Yearn USDC Vault',
        strategy: 'Yearn + Gearbox',
        chain: 'Ethereum',
        projAPY: 7.2,
        apy: 7.2,
        leverage: 1.5,
        maxLeverage: 2,
        healthFactor: 2.1,
        tvl: 32000000,
        risk: 'Low'
      }
    ],
    'USDT': [
      {
        id: 'usdt_aave_1',
        pool_address: '0x9876...5432',
        pool_name: 'Aave USDT Pool',
        strategy: 'Aave + Gearbox',
        chain: 'Ethereum',
        projAPY: 7.8,
        apy: 7.8,
        leverage: 2.5,
        maxLeverage: 3,
        healthFactor: 1.6,
        tvl: 28000000,
        risk: 'Medium'
      }
    ],
    'WETH': [
      {
        id: 'weth_lido_1',
        pool_address: '0xdef0...1234',
        pool_name: 'Lido stETH Pool',
        strategy: 'Lido + Gearbox',
        chain: 'Ethereum',
        projAPY: 9.5,
        apy: 9.5,
        leverage: 3,
        maxLeverage: 4,
        healthFactor: 1.5,
        tvl: 120000000,
        risk: 'High'
      }
    ],
    'wstETH': [
      {
        id: 'wsteth_curve_1',
        pool_address: '0x5678...abcd',
        pool_name: 'Curve wstETH Pool',
        strategy: 'Curve + Lido + Gearbox',
        chain: 'Ethereum',
        projAPY: 10.2,
        apy: 10.2,
        leverage: 3.5,
        maxLeverage: 5,
        healthFactor: 1.4,
        tvl: 85000000,
        risk: 'High'
      }
    ],
    'USDT0': [
      {
        id: 'usdt0_plasma_1',
        pool_address: '0x76309a9a56309104518847bba321c261b7b4a43f',
        pool_name: 'Invariant Group Plasma',
        strategy: 'Plasma + Gearbox',
        chain: 'Plasma',
        projAPY: 15.8,
        apy: 15.8,
        leverage: 5,
        maxLeverage: 10,
        healthFactor: 1.2,
        tvl: 5000000,
        risk: 'High'
      },
      {
        id: 'usdt0_plasma_2',
        pool_address: '0x53e4e9b8766969c43895839cc9c673bb6bc8ac97',
        pool_name: 'Edge UltraYield Plasma',
        strategy: 'Edge + Gearbox',
        chain: 'Plasma',
        projAPY: 18.5,
        apy: 18.5,
        leverage: 8,
        maxLeverage: 10,
        healthFactor: 1.1,
        tvl: 3500000,
        risk: 'High'
      }
    ]
  };

  // Get opportunities for the requested asset
  let opportunities = mockOpportunities[params.asset] || [];

  // Filter by minimum APY if specified
  if (params.min_apy) {
    opportunities = opportunities.filter(opp => opp.apy >= params.min_apy);
  }

  // Filter by max leverage if specified
  if (params.max_leverage) {
    opportunities = opportunities.filter(opp => opp.leverage <= params.max_leverage);
  }

  // Filter by risk tolerance if specified
  if (params.risk_tolerance) {
    const riskMap = { low: 'Low', medium: 'Medium', high: 'High' };
    const targetRisk = riskMap[params.risk_tolerance.toLowerCase()];
    if (targetRisk) {
      opportunities = opportunities.filter(opp => opp.risk === targetRisk);
    }
  }

  // Sort by APY descending
  opportunities.sort((a, b) => b.apy - a.apy);

  console.log(`   ✅ Found ${opportunities.length} opportunities for ${params.asset}`);

  return opportunities;
}

module.exports = {
  queryFarmOpportunities,
  fetchPoolAPY, // Export for use by position-scanner
};

/**
 * Simplified opportunity querying for Telegram bot
 * Standalone implementation without TypeScript dependencies
 */

// Mock data for testing - replace with real API calls later
async function queryFarmOpportunities(params) {
  console.log(`   🔍 Querying opportunities for ${params.asset}...`);

  // TODO: Implement real API call to Gearbox
  // For now, return mock data based on asset

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

module.exports = { queryFarmOpportunities };

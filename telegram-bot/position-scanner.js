/**
 * Position Scanner for Gearbox Pools
 * Detects user positions across Ethereum mainnet and Plasma chain
 * Now with real blockchain integration using viem and dynamic pool discovery
 */

const { fetchPoolAPY } = require('./query-opportunities');
const blockchain = require('./utils/blockchain');
const config = require('./config');
const database = require('./database');

/**
 * Get all pools to scan (from database cache + static config)
 */
async function getPoolsToScan() {
  const poolsByChain = {};

  try {
    // Get pools from database cache (discovered by pool-fetcher)
    const cachedPools = await database.getCachedPools(true); // active only

    for (const pool of cachedPools) {
      if (!poolsByChain[pool.chain_id]) {
        poolsByChain[pool.chain_id] = [];
      }
      poolsByChain[pool.chain_id].push({
        address: pool.pool_address,
        name: pool.pool_name,
        token: pool.underlying_token,
        decimals: 18, // Default, will be fetched on-chain if needed
      });
    }
  } catch (error) {
    console.log(`   ⚠️  Could not load pools from cache: ${error.message}`);
  }

  // Fallback: Add static Plasma pools if not in cache
  if (!poolsByChain[9745] || poolsByChain[9745].length === 0) {
    poolsByChain[9745] = config.pools.Plasma || [];
  }

  return poolsByChain;
}

/**
 * Scan user wallet for Gearbox pool positions
 * @param {string} walletAddress - User's wallet address
 * @returns {Array} Array of detected positions
 */
async function scanWalletPositions(walletAddress) {
  console.log(`🔍 Scanning wallet ${walletAddress.slice(0, 10)}... for Gearbox positions`);

  const positions = [];

  // Get all discovered pools from database + static config
  const poolsByChain = await getPoolsToScan();

  // Scan each chain
  for (const [chainId, pools] of Object.entries(poolsByChain)) {
    const chainIdNum = parseInt(chainId);
    console.log(`   Checking ${pools.length} pools on chain ${chainId}...`);

    for (const pool of pools) {
      try {
        // Real balance check using viem
        const sharesBalance = await blockchain.getPoolBalance(
          pool.address,
          walletAddress,
          chainIdNum
        );

        const sharesFloat = parseFloat(sharesBalance);

        // Skip if no balance or below dust threshold
        if (sharesFloat === 0 || sharesFloat < config.positions.dustThreshold) {
          continue;
        }

        console.log(`      ✅ Found position: ${pool.name} (${sharesFloat.toFixed(4)} shares)`);

        // Convert shares to underlying asset value
        const currentValue = await blockchain.convertSharesToAssets(
          pool.address,
          sharesBalance,
          chainIdNum
        );

        // Fetch current APY for this pool
        const apyData = await fetchPoolAPY(pool.address, chainIdNum);
        const currentSupplyAPY = apyData?.supplyAPY || 0;

        // Lending pools only - no leverage detection needed
        positions.push({
          poolAddress: pool.address,
          poolName: pool.name,
          chainId: chainIdNum,
          underlyingToken: pool.token,
          shares: sharesFloat,
          depositedAmount: parseFloat(currentValue), // We don't know initial deposit, use current value
          currentValue: parseFloat(currentValue),
          initialSupplyAPY: currentSupplyAPY, // Assume same as current for new detection
          currentSupplyAPY: currentSupplyAPY,
          initialBorrowAPY: null, // No borrowing in lending pools
          currentBorrowAPY: null,
          netAPY: currentSupplyAPY, // Same as supply APY for lending
          leverage: 1, // No leverage in lending pools
          healthFactor: null, // No health factor for lending deposits
        });

        console.log(`         Value: ${parseFloat(currentValue).toFixed(2)} ${pool.token}, APY: ${currentSupplyAPY.toFixed(2)}%`);

      } catch (error) {
        console.error(`      ❌ Error checking ${pool.name}:`, error.message);
      }
    }
  }

  console.log(`✅ Scan complete: Found ${positions.length} active positions`);
  return positions;
}

module.exports = {
  scanWalletPositions,
  getPoolsToScan,
};

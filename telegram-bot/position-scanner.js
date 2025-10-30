/**
 * Position Scanner for Gearbox Pools
 * Detects user positions across Ethereum mainnet and Plasma chain
 * Now with real blockchain integration using viem
 */

const { fetchPoolAPY } = require('./query-opportunities');
const blockchain = require('./utils/blockchain');
const config = require('./config');

// Use known pools from config
const KNOWN_POOLS = {
  1: config.pools.ethereum,
  9745: config.pools.plasma,
};

/**
 * Scan user wallet for Gearbox pool positions
 * @param {string} walletAddress - User's wallet address
 * @returns {Array} Array of detected positions
 */
async function scanWalletPositions(walletAddress) {
  console.log(`🔍 Scanning wallet ${walletAddress.slice(0, 10)}... for Gearbox positions`);

  const positions = [];

  // Scan each chain
  for (const [chainId, pools] of Object.entries(KNOWN_POOLS)) {
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

        // Check if position is leveraged
        const leverageDetails = await detectLeverageDetails(
          pool.address,
          walletAddress,
          chainIdNum
        );

        // Calculate net APY (supply - borrow costs if leveraged)
        let netAPY = currentSupplyAPY;
        if (leverageDetails.isLeveraged) {
          netAPY = (currentSupplyAPY * leverageDetails.leverage) -
                   (leverageDetails.borrowAPY * (leverageDetails.leverage - 1));
        }

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
          initialBorrowAPY: leverageDetails.borrowAPY,
          currentBorrowAPY: leverageDetails.borrowAPY,
          netAPY: netAPY,
          leverage: leverageDetails.leverage,
          healthFactor: leverageDetails.healthFactor || null,
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

/**
 * Detect if position is leveraged (has borrow)
 * @param {string} poolAddress - Pool address
 * @param {string} userAddress - User address
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} Leverage details {leverage, borrowAPY, healthFactor}
 */
async function detectLeverageDetails(poolAddress, userAddress, chainId) {
  try {
    // Check if user has credit account for this pool
    const creditAccount = await blockchain.getCreditAccount(
      poolAddress,
      userAddress,
      chainId
    );

    if (!creditAccount) {
      // No credit account = non-leveraged position
      return {
        isLeveraged: false,
        leverage: 1,
        borrowAPY: null,
        borrowAmount: 0,
        healthFactor: null,
      };
    }

    // Get health factor for leveraged position
    const healthFactor = await blockchain.getHealthFactor(
      creditAccount.address,
      chainId
    );

    return {
      isLeveraged: true,
      leverage: creditAccount.leverage || 1,
      borrowAPY: creditAccount.borrowAPY || null,
      borrowAmount: creditAccount.borrowAmount || 0,
      healthFactor: healthFactor,
    };
  } catch (error) {
    console.error(`   ⚠️ Error detecting leverage:`, error.message);
    // Fallback: assume non-leveraged
    return {
      isLeveraged: false,
      leverage: 1,
      borrowAPY: null,
      borrowAmount: 0,
      healthFactor: null,
    };
  }
}

module.exports = {
  scanWalletPositions,
  detectLeverageDetails,
  KNOWN_POOLS,
};

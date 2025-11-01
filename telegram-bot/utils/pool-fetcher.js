/**
 * Pool Fetcher - Discovers Gearbox pools across all chains
 * Queries AddressProvider contracts on-chain to get pool addresses
 * Filters by TVL > $1M and returns structured pool data
 */

const { ADDRESS_PROVIDER } = require('@gearbox-protocol/sdk');
const blockchain = require('./blockchain');
const config = require('../config');

// AddressProvider ABI - minimal interface for getting pool list
const ADDRESS_PROVIDER_ABI = [
  {
    name: 'getPoolsListWithFilter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'getPoolsList',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
];

// Pool contract ABI - for getting pool metadata
const POOL_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'asset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'supplyRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
];

// ERC20 ABI for token info
const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
];

/**
 * Fetch pool addresses from AddressProvider contract
 */
async function getPoolAddressesForChain(chainKey, chainConfig) {
  const addressProvider = ADDRESS_PROVIDER[chainKey];

  if (!addressProvider || addressProvider === '0xNOT DEPLOYED') {
    console.log(`   ⏭️  ${chainKey}: Not deployed`);
    return [];
  }

  try {
    const client = blockchain.getClient(chainConfig.id);

    // Try getPoolsList first
    const poolAddresses = await client.readContract({
      address: addressProvider,
      abi: ADDRESS_PROVIDER_ABI,
      functionName: 'getPoolsList',
    });

    console.log(`   ✅ ${chainKey}: Found ${poolAddresses.length} pool addresses`);
    return poolAddresses;
  } catch (error) {
    console.error(`   ❌ ${chainKey}: Error fetching pools - ${error.message}`);
    return [];
  }
}

/**
 * Fetch pool metadata and TVL
 */
async function getPoolDetails(poolAddress, chainId, chainKey) {
  try {
    const client = blockchain.getClient(chainId);

    // Fetch pool data in parallel
    const [name, symbol, decimals, asset, totalAssets, supplyRate] = await Promise.all([
      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'name',
      }).catch(() => 'Unknown Pool'),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'symbol',
        }).catch(() => 'UNKNOWN'),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'decimals',
      }).catch(() => 18),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'asset',
      }).catch(() => null),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'totalAssets',
      }).catch(() => 0n),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'supplyRate',
      }).catch(() => 0n),
    ]);

    // Get underlying token symbol
    let underlyingToken = 'UNKNOWN';
    if (asset) {
      try {
        underlyingToken = await client.readContract({
          address: asset,
          abi: ERC20_ABI,
          functionName: 'symbol',
        });
      } catch (e) {
        // Use pool symbol as fallback
        underlyingToken = symbol.replace(/^d/, ''); // Remove 'd' prefix if present
      }
    }

    // Calculate TVL in native token units
    const tvl = Number(totalAssets) / Math.pow(10, decimals);

    // Calculate APY from supplyRate (RAY format)
    const RAY = BigInt('1000000000000000000000000000'); // 1e27
    const apy = Number((BigInt(supplyRate) * BigInt(10000)) / RAY) / 100;

    return {
      address: poolAddress,
      name,
      symbol,
      chainId,
      chainKey,
      underlyingToken,
      decimals,
      tvl, // In underlying token units
      apy,
      asset,
    };
  } catch (error) {
    console.error(`     ❌ Error fetching pool ${poolAddress.slice(0, 10)}... details:`, error.message);
    return null;
  }
}

/**
 * Fetch all pools from all deployed Gearbox chains
 * @param {number} minTVL - Minimum TVL in USD (default $1M)
 * @returns {Promise<Object>} { pools, newPools, removedPools, chainCount }
 */
async function fetchAllPools(minTVL = 1_000_000) {
  console.log('🔍 Fetching pools from all Gearbox chains...');
  console.log(`   Filter: TVL >= $${(minTVL / 1e6).toFixed(1)}M\n`);

  const allPools = [];
  let chainsScanned = 0;

  // Get deployed chains from ADDRESS_PROVIDER
  const deployedChains = Object.entries(ADDRESS_PROVIDER).filter(
    ([_, address]) => address !== '0xNOT DEPLOYED'
  );

  // Add Plasma manually (not in ADDRESS_PROVIDER but we have pools)
  const plasmaConfig = config.blockchain.chains.Plasma;
  if (plasmaConfig && config.pools.Plasma.length > 0) {
    console.log(`   📋 Plasma: Using ${config.pools.Plasma.length} configured pools`);

    for (const pool of config.pools.Plasma) {
      const details = await getPoolDetails(pool.address, plasmaConfig.id, 'Plasma');
      if (details && details.tvl >= minTVL) {
        allPools.push({
          ...details,
          chainName: plasmaConfig.name,
        });
      }
    }
    chainsScanned++;
  }

  // Fetch from chains with AddressProvider
  for (const [chainKey, addressProvider] of deployedChains) {
    const chainConfig = config.blockchain.chains[chainKey];

    if (!chainConfig) {
      console.log(`   ⏭️  ${chainKey}: No RPC config found`);
      continue;
    }

    console.log(`   🔍 ${chainKey}: Scanning pools...`);

    // Get pool addresses from AddressProvider
    const poolAddresses = await getPoolAddressesForChain(chainKey, chainConfig);

    if (poolAddresses.length === 0) {
      continue;
    }

    chainsScanned++;

    // Fetch details for each pool
    for (const poolAddress of poolAddresses) {
      const details = await getPoolDetails(poolAddress, chainConfig.id, chainKey);

      if (details) {
        console.log(`     💎 ${details.name}: $${details.tvl.toFixed(2)} TVL, ${details.apy.toFixed(2)}% APY`);

        // Filter by minimum TVL
        if (details.tvl >= minTVL) {
          allPools.push({
            ...details,
            chainName: chainConfig.name,
          });
        } else {
          console.log(`        ⏭️  Skipped (TVL < $${(minTVL / 1e6).toFixed(1)}M)`);
        }
      }
    }

    console.log();
  }

  console.log(`✅ Scan complete: ${allPools.length} pools found across ${chainsScanned} chains\n`);

  return {
    pools: allPools,
    newPools: [], // Will be calculated by comparing with database
    removedPools: [], // Will be calculated by comparing with database
    chainCount: chainsScanned,
  };
}

/**
 * Check if pools should be refreshed
 * @returns {Promise<boolean>}
 */
async function shouldRefreshPools() {
  // For now, always refresh on startup
  // TODO: Check database timestamp
  return true;
}

/**
 * Get count of unique chains in pool list
 */
function getChainCount(pools) {
  const chains = new Set(pools.map(p => p.chainId));
  return chains.size;
}

module.exports = {
  fetchAllPools,
  shouldRefreshPools,
  getChainCount,
  getPoolAddressesForChain,
  getPoolDetails,
};

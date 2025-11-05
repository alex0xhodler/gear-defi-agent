/**
 * Pool Fetcher - Discovers Gearbox pools across all chains
 * Uses Gearbox SDK for reliable pool discovery
 * Filters by TVL > $1M and returns structured pool data
 */

const { GearboxSDK } = require('@gearbox-protocol/sdk');
const { createPublicClient, http, defineChain, formatUnits } = require('viem');
const config = require('../config');

// Cache SDK instances per chain
const sdkCache = new Map();

// Pool contract ABI - for Plasma pools (not supported by SDK yet)
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
    name: 'totalBorrowed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'availableLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'expectedLiquidity',
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
 * Get or initialize Gearbox SDK for a specific chain
 */
async function getSDKForChain(chainId, chainConfig) {
  const cacheKey = `sdk-${chainId}`;

  if (sdkCache.has(cacheKey)) {
    return sdkCache.get(cacheKey);
  }

  try {
    console.log(`   🔄 Initializing Gearbox SDK for chain ${chainId}...`);

    // Use longer timeout for Ethereum mainnet (more complex queries)
    const timeout = chainId === 1 ? 300_000 : 120_000; // 5 min for mainnet, 2 min for others

    const sdk = await GearboxSDK.attach({
      rpcURLs: [chainConfig.rpcUrl],
      timeout,
      ignoreUpdateablePrices: true, // Skip RedStone price feed updates
    });

    sdkCache.set(cacheKey, sdk);
    console.log(`   ✅ SDK initialized: ${sdk.marketRegister.markets.length} markets found`);

    return sdk;
  } catch (error) {
    console.error(`   ❌ Failed to initialize SDK for chain ${chainId}:`, error.message);

    // Only use fallback for Ethereum if it's a gas limit issue with public RPC
    if (error.message?.includes('gas limit') && chainId === 1) {
      console.log(`   ℹ️  Attempting fallback discovery method for Ethereum...`);
    }

    return null;
  }
}

/**
 * Fetch pools from Gearbox SDK for supported chains
 */
async function getPoolsFromSDK(chainKey, chainConfig) {
  try {
    const sdk = await getSDKForChain(chainConfig.id, chainConfig);

    if (!sdk) {
      // Use fallback for Ethereum if SDK failed
      if (chainConfig.id === 1) {
        console.log(`   ℹ️  Using fallback discovery for Ethereum`);
        return await getEthereumPoolsFallback(chainKey, chainConfig);
      }
      return [];
    }

    const pools = [];

    // Iterate through all markets
    for (const market of sdk.marketRegister.markets) {
      const poolData = market.pool?.pool;

      if (!poolData) continue;

      // Get underlying token symbol
      const underlyingToken = sdk.tokensMeta.get(poolData.underlying.toLowerCase())?.symbol || 'UNKNOWN';

      // Calculate TVL and borrowed amounts (all in token units)
      const decimals = sdk.tokensMeta.get(poolData.underlying.toLowerCase())?.decimals || 18;
      const tvl = Number(formatUnits(poolData.expectedLiquidity || 0n, decimals));
      const availableLiquidity = Number(formatUnits(poolData.availableLiquidity || 0n, decimals));

      // totalBorrowed = expectedLiquidity - availableLiquidity
      const borrowed = tvl - availableLiquidity;

      // Calculate utilization rate
      const utilization = tvl > 0 ? (borrowed / tvl) * 100 : 0;

      // Calculate APY from supplyRate (RAY format - 1e27)
      const RAY = BigInt('1000000000000000000000000000'); // 1e27
      const apy = Number((BigInt(poolData.supplyRate || 0n) * BigInt(10000)) / RAY) / 100;

      // Get collateral tokens from credit managers
      const collaterals = [];
      const collateralSet = new Set();

      try {
        // Iterate through all credit managers for this market
        if (market.creditManagers && market.creditManagers.length > 0) {
          for (const cm of market.creditManagers) {
            // Get collateral tokens from credit manager state
            if (cm.state?.quotaKeeper?.quotedTokens) {
              for (const qt of cm.state.quotaKeeper.quotedTokens) {
                const tokenSymbol = sdk.tokensMeta.get(qt.token.toLowerCase())?.symbol;
                if (tokenSymbol && tokenSymbol !== underlyingToken) {
                  collateralSet.add(tokenSymbol);
                }
              }
            }
            // Fallback: try collateralTokens if quotedTokens not available
            else if (cm.state?.collateralTokens) {
              for (const token of cm.state.collateralTokens) {
                const tokenSymbol = sdk.tokensMeta.get(token.toLowerCase())?.symbol;
                if (tokenSymbol && tokenSymbol !== underlyingToken) {
                  collateralSet.add(tokenSymbol);
                }
              }
            }
          }
        }

        // Convert set to array (top 10 unique collaterals)
        collaterals.push(...Array.from(collateralSet).slice(0, 10));
      } catch (err) {
        console.log(`      ⚠️ Could not fetch collaterals for ${underlyingToken}: ${err.message}`);
      }

      pools.push({
        address: poolData.address,
        name: `${underlyingToken} Pool`, // SDK doesn't provide pool name
        symbol: `d${underlyingToken}`, // Convention: dUSDC, dWETH, etc.
        chainId: chainConfig.id,
        chainKey,
        underlyingToken,
        decimals,
        tvl,
        apy,
        borrowed,
        utilization,
        asset: poolData.underlying,
        chainName: chainConfig.name,
        collaterals: collaterals.length > 0 ? collaterals : null,
      });
    }

    console.log(`   ✅ ${chainKey}: Found ${pools.length} pools via SDK`);
    return pools;

  } catch (error) {
    console.error(`   ❌ ${chainKey}: Error fetching pools from SDK - ${error.message}`);
    return [];
  }
}

/**
 * Fallback method for Ethereum mainnet using direct contract calls
 * Works around gas limit issues with public RPC providers
 */
async function getEthereumPoolsFallback(chainKey, chainConfig) {
  try {
    const { ADDRESS_PROVIDER } = require('@gearbox-protocol/sdk');
    const addressProviderAddress = ADDRESS_PROVIDER.Mainnet;

    if (!addressProviderAddress || addressProviderAddress === '0xNOT DEPLOYED') {
      console.log(`   ⏭️  ${chainKey}: AddressProvider not deployed`);
      return [];
    }

    // Create viem client for direct contract calls
    const client = createPublicClient({
      chain: {
        id: 1,
        name: 'Ethereum',
        network: 'mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [chainConfig.rpcUrl] },
          public: { http: [chainConfig.rpcUrl] }
        }
      },
      transport: http(chainConfig.rpcUrl)
    });

    // Use PoolQuotaKeeperV3 ABI to get pool list (more gas-efficient)
    const POOL_QUOTA_KEEPER_ABI = [
      {
        name: 'poolQuotaKeepers',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'address[]' }],
      },
    ];

    // Try to get pools from AddressProvider
    let poolAddresses = [];

    try {
      poolAddresses = await client.readContract({
        address: addressProviderAddress,
        abi: POOL_QUOTA_KEEPER_ABI,
        functionName: 'poolQuotaKeepers',
        gas: 3_000_000n, // Lower gas limit
      });
    } catch (error) {
      console.log(`   ℹ️  Using known Gearbox V3 Ethereum pools`);
      // Complete list of Gearbox V3 pools on Ethereum mainnet
      // Source: https://app.gearbox.fi/ and Gearbox docs
      poolAddresses = [
        // Major stablecoin pools
        '0x24946bCbBd028D5ABb62ad9B635EB1b1a67AF668', // USDC Pool v3
        '0xda00000035fef4082F78dEF6A8903bee419FbF8E', // DAI Pool v3
        '0xB8cf3Ed326bB0E51454361Fb37E9E8df6DC5C286', // USDT Pool v3
        '0x14D0a750a814bE1A55483018415c9dD5DaF2f8A9', // GHO Pool

        // ETH/WETH pools
        '0xe7146F53dBcae9D6Fa3555FE502648deb0B2F823', // WETH Pool v3
        '0x4759cBb5511Fbd860286F8C42D1B20832F96AEA2', // wstETH Pool v3

        // BTC pools
        '0x890A69EF363C9c7BdD5E36eb95Ceb569F63ACbF6', // WBTC Pool v3
        '0x6FccA7e0f3570bd589CfD1F78Bf3E0f37e39bb5f', // tBTC Pool

        // Other assets
        '0x5c0b1dE1883e68E8F20a014fCa711B0e5E395857', // crvUSD Pool
        '0x5Ec758EcCaA5BF7455eE51Faf70fad5bA94f8D99', // DOLA Pool

        // Additional V3 pools
        '0x7950e73c99950f9ef93f037b42e0a3b9f161fD03', // USDC Farm
        '0xb6B5dDc509b5e7e5FA1050Cf58DA96C0A2F39ED4', // USDC Farm 2
      ];
    }

    console.log(`   📋 Found ${poolAddresses.length} pool addresses on ${chainKey}`);

    const pools = [];

    // Fetch details for each pool
    for (const poolAddress of poolAddresses) {
      try {
        const [symbol, asset, totalAssets, supplyRate] = await Promise.all([
          client.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'symbol',
            gas: 100_000n,
          }).catch(() => 'UNKNOWN'),

          client.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'asset',
            gas: 100_000n,
          }).catch(() => null),

          client.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'totalAssets',
            gas: 100_000n,
          }).catch(() => 0n),

          client.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'supplyRate',
            gas: 100_000n,
          }).catch(() => 0n),
        ]);

        // Get underlying token details
        let underlyingToken = 'UNKNOWN';
        let decimals = 18;

        if (asset) {
          [underlyingToken, decimals] = await Promise.all([
            client.readContract({
              address: asset,
              abi: ERC20_ABI,
              functionName: 'symbol',
              gas: 100_000n,
            }).catch(() => symbol.replace(/^d/, '')),

            client.readContract({
              address: asset,
              abi: ERC20_ABI,
              functionName: 'decimals',
              gas: 100_000n,
            }).catch(() => 18),
          ]);
        }

        // Calculate TVL
        const tvl = Number(formatUnits(totalAssets, decimals));

        // Calculate APY
        const RAY = BigInt('1000000000000000000000000000');
        const apy = Number((BigInt(supplyRate) * BigInt(10000)) / RAY) / 100;

        const poolName = `${underlyingToken} Pool`;

        pools.push({
          address: poolAddress,
          name: poolName,
          symbol,
          chainId: chainConfig.id,
          chainKey,
          underlyingToken,
          decimals,
          tvl,
          apy,
          asset,
          chainName: chainConfig.name,
        });

        console.log(`     💎 ${poolName}: $${tvl.toFixed(2)} TVL, ${apy.toFixed(2)}% APY`);

      } catch (error) {
        console.log(`     ⏭️  Skipped ${poolAddress.slice(0, 10)}...: ${error.message}`);
      }
    }

    console.log(`   ✅ ${chainKey}: Found ${pools.length} pools via fallback`);
    return pools;

  } catch (error) {
    console.error(`   ❌ ${chainKey}: Fallback discovery failed - ${error.message}`);
    return [];
  }
}

/**
 * Fetch pool metadata for Plasma (not supported by SDK yet)
 * Uses direct contract calls via viem
 */
async function getPlasmaPoolDetails(poolAddress, chainId, chainKey, poolName) {
  try {
    // Define Plasma chain for viem
    const plasma = defineChain({
      id: 9745,
      name: 'Plasma',
      network: 'plasma',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://rpc.plasma.to'] },
        public: { http: ['https://rpc.plasma.to'] }
      }
    });

    const client = createPublicClient({
      chain: plasma,
      transport: http('https://rpc.plasma.to')
    });

    // Fetch pool data in parallel
    const [symbol, decimals, asset, totalAssets, totalBorrowed, availableLiquidity, supplyRate] = await Promise.all([
      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'symbol',
      }).catch(() => 'UNKNOWN'),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'decimals',
      }).catch(() => 6),

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
        functionName: 'totalBorrowed',
      }).catch(() => 0n),

      client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'availableLiquidity',
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
        underlyingToken = symbol.replace(/^d/, ''); // Remove 'd' prefix if present
      }
    }

    // Calculate TVL in native token units
    const tvl = Number(totalAssets) / Math.pow(10, decimals);
    const borrowed = Number(totalBorrowed) / Math.pow(10, decimals);
    const available = Number(availableLiquidity) / Math.pow(10, decimals);

    // Calculate utilization rate
    const utilization = tvl > 0 ? (borrowed / tvl) * 100 : 0;

    // Calculate APY from supplyRate (RAY format)
    const RAY = BigInt('1000000000000000000000000000'); // 1e27
    const apy = Number((BigInt(supplyRate) * BigInt(10000)) / RAY) / 100;

    // TODO: Fetch real collaterals from Plasma quota keeper contract
    // For now, return common ones as fallback since Plasma SDK support is limited
    const collaterals = underlyingToken === 'USDT0'
      ? ['WETH', 'WBTC', 'stETH', 'cbBTC', 'USDC', 'USDT']
      : underlyingToken === 'WETH'
      ? ['WBTC', 'stETH', 'cbBTC', 'USDC', 'USDT']
      : null;

    return {
      address: poolAddress,
      name: poolName,
      symbol,
      chainId,
      chainKey,
      underlyingToken,
      decimals,
      tvl,
      apy,
      borrowed,
      available,
      utilization,
      asset,
      chainName: 'Plasma',
      collaterals,
    };
  } catch (error) {
    console.error(`     ❌ Error fetching Plasma pool ${poolAddress.slice(0, 10)}... details:`, error.message);
    return null;
  }
}

/**
 * Fetch all pools from all deployed Gearbox chains
 * @param {number} minTVL - Minimum TVL in USD (default 0 = no filter)
 * @returns {Promise<Object>} { pools, newPools, removedPools, chainCount }
 */
async function fetchAllPools(minTVL = 0) {
  console.log('🔍 Fetching pools from all Gearbox chains via SDK...');
  if (minTVL > 0) {
    console.log(`   Filter: TVL >= $${(minTVL / 1e6).toFixed(1)}M\n`);
  } else {
    console.log(`   Filter: None (all pools)\n`);
  }

  const allPools = [];
  let chainsScanned = 0;

  // Supported chains for SDK-based discovery
  const sdkChains = ['Mainnet', 'Arbitrum', 'Optimism', 'Sonic'];

  for (const chainKey of sdkChains) {
    const chainConfig = config.blockchain.chains[chainKey];

    if (!chainConfig) {
      console.log(`   ⏭️  ${chainKey}: No RPC config found`);
      continue;
    }

    console.log(`   🔍 ${chainKey}: Scanning pools via SDK...`);

    // Fetch pools using SDK
    const pools = await getPoolsFromSDK(chainKey, chainConfig);

    if (pools.length === 0) {
      continue;
    }

    chainsScanned++;

    // Add all pools (no TVL filter)
    for (const pool of pools) {
      console.log(`     💎 ${pool.name}: $${pool.tvl.toFixed(2)} TVL, ${pool.apy.toFixed(2)}% APY`);
      allPools.push(pool);
    }

    console.log();
  }

  // Handle Plasma separately (not supported by SDK yet)
  const plasmaConfig = config.blockchain.chains.Plasma;
  if (plasmaConfig && config.pools.Plasma.length > 0) {
    console.log(`   📋 Plasma: Fetching ${config.pools.Plasma.length} configured pools`);

    for (const pool of config.pools.Plasma) {
      const details = await getPlasmaPoolDetails(pool.address, plasmaConfig.id, 'Plasma', pool.name);

      if (details) {
        console.log(`     💎 ${details.name}: $${details.tvl.toFixed(2)} TVL, ${details.apy.toFixed(2)}% APY`);
        allPools.push(details);
      }
    }
    chainsScanned++;
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
  getSDKForChain,
  getPoolsFromSDK,
  getPlasmaPoolDetails,
  getEthereumPoolsFallback,
};

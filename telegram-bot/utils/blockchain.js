/**
 * Blockchain utilities for interacting with Gearbox pools
 * Real balance checking using viem for all supported chains:
 * Ethereum, Arbitrum, Optimism, Sonic, Plasma, and Monad
 */

const { createPublicClient, http, parseUnits, formatUnits } = require('viem');
const { mainnet, arbitrum, optimism } = require('viem/chains');
const config = require('../config');

// Custom Plasma chain configuration
const plasmaChain = {
  id: 9745,
  name: 'Plasma',
  network: 'plasma',
  nativeCurrency: {
    name: 'Plasma',
    symbol: 'PLM',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.blockchain.chains.Plasma.rpcUrl],
    },
    public: {
      http: [config.blockchain.chains.Plasma.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Plasma Explorer',
      url: config.blockchain.chains.Plasma.explorerUrl,
    },
  },
};

// Custom Sonic chain configuration
const sonicChain = {
  id: 146,
  name: 'Sonic',
  network: 'sonic',
  nativeCurrency: {
    name: 'Sonic',
    symbol: 'S',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.blockchain.chains.Sonic.rpcUrl],
    },
    public: {
      http: [config.blockchain.chains.Sonic.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Sonic Explorer',
      url: config.blockchain.chains.Sonic.explorerUrl,
    },
  },
};

// Custom Monad chain configuration
const monadChain = {
  id: 143,
  name: 'Monad',
  network: 'monad',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.blockchain.chains.Monad.rpcUrl],
    },
    public: {
      http: [config.blockchain.chains.Monad.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadVision',
      url: config.blockchain.chains.Monad.explorerUrl,
    },
  },
};

// Create viem clients for each chain
const clients = {
  1: createPublicClient({
    chain: mainnet,
    transport: http(config.blockchain.chains.Mainnet.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
  42161: createPublicClient({
    chain: arbitrum,
    transport: http(config.blockchain.chains.Arbitrum.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
  10: createPublicClient({
    chain: optimism,
    transport: http(config.blockchain.chains.Optimism.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
  146: createPublicClient({
    chain: sonicChain,
    transport: http(config.blockchain.chains.Sonic.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
  9745: createPublicClient({
    chain: plasmaChain,
    transport: http(config.blockchain.chains.Plasma.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
  143: createPublicClient({
    chain: monadChain,
    transport: http(config.blockchain.chains.Monad.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
};

/**
 * Get public client for a specific chain
 * @param {number} chainId - Chain ID (1=Ethereum, 42161=Arbitrum, 10=Optimism, 146=Sonic, 9745=Plasma, 143=Monad)
 * @returns {Object} Viem public client
 */
function getClient(chainId) {
  const client = clients[chainId];
  if (!client) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return client;
}

/**
 * Retry wrapper for blockchain calls with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, maxRetries = config.blockchain.rpc.maxRetries, initialDelay = config.blockchain.rpc.retryDelayMs) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`⚠️ Blockchain call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Get pool token balance (shares) for a user
 * @param {string} poolAddress - Gearbox pool contract address
 * @param {string} userAddress - User's wallet address
 * @param {number} chainId - Chain ID (1 for Ethereum, 9745 for Plasma)
 * @returns {Promise<string>} Balance of pool tokens (shares) in human-readable format
 */
async function getPoolBalance(poolAddress, userAddress, chainId) {
  try {
    const client = getClient(chainId);

    return await withRetry(async () => {
      // Get pool token decimals
      const decimals = await client.readContract({
        address: poolAddress,
        abi: [
          {
            name: 'decimals',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'uint8' }],
          },
        ],
        functionName: 'decimals',
      });

      // Get user's pool token balance (shares)
      const balance = await client.readContract({
        address: poolAddress,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [userAddress],
      });

      return formatUnits(balance, decimals);
    });
  } catch (error) {
    console.error(`❌ Error fetching pool balance for ${poolAddress} on chain ${chainId}:`, error.message);
    return '0';
  }
}

/**
 * Convert pool shares to underlying token amount
 * @param {string} poolAddress - Gearbox pool contract address
 * @param {string} shares - Amount of shares
 * @param {number} chainId - Chain ID
 * @returns {Promise<string>} Underlying token amount in human-readable format
 */
async function convertSharesToAssets(poolAddress, shares, chainId) {
  try {
    const client = getClient(chainId);

    return await withRetry(async () => {
      // Get pool token decimals
      const decimals = await client.readContract({
        address: poolAddress,
        abi: [
          {
            name: 'decimals',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'uint8' }],
          },
        ],
        functionName: 'decimals',
      });

      // Convert shares to wei
      const sharesWei = parseUnits(shares, decimals);

      // Call convertToAssets (ERC4626 standard)
      const assets = await client.readContract({
        address: poolAddress,
        abi: [
          {
            name: 'convertToAssets',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'shares', type: 'uint256' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'convertToAssets',
        args: [sharesWei],
      });

      return formatUnits(assets, decimals);
    });
  } catch (error) {
    console.error(`❌ Error converting shares to assets:`, error.message);
    return shares; // Fallback to 1:1 ratio
  }
}

/**
 * Get pool APY from the pool contract using supplyRate()
 * @param {string} poolAddress - Gearbox pool contract address
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} APY data { supplyAPY, borrowAPY, maxLeverage, tvl }
 */
async function getPoolAPY(poolAddress, chainId) {
  try {
    const client = getClient(chainId);

    return await withRetry(async () => {
      // Fetch both APY and TVL in parallel for efficiency
      const [supplyRate, tvlData] = await Promise.all([
        // Call supplyRate() on the pool contract
        // Returns uint256 in RAY format (1e27) representing annual rate
        client.readContract({
          address: poolAddress,
          abi: [
            {
              name: 'supplyRate',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'supplyRate',
        }),
        // Fetch TVL data
        getPoolTVL(poolAddress, chainId).catch(() => ({ tvlFormatted: 0 })),
      ]);

      // Convert RAY (1e27) to percentage
      // supplyRate is already annualized, just need to convert from RAY to percentage
      // APY = (supplyRate / 1e27) * 100
      const supplyRateBigInt = BigInt(supplyRate);
      const RAY = BigInt('1000000000000000000000000000'); // 1e27

      // Multiply by 10000 to preserve precision, then divide by 100 for percentage
      const supplyAPY = Number((supplyRateBigInt * BigInt(10000)) / RAY) / 100;

      console.log(`   ✅ Pool ${poolAddress.slice(0, 10)}... on chain ${chainId}: ${supplyAPY.toFixed(2)}% APY, TVL: $${tvlData.tvlFormatted.toFixed(2)}`);

      return {
        supplyAPY,
        borrowAPY: 0, // Not applicable for lending pools
        maxLeverage: 1, // Lending pools are non-leveraged
        tvl: tvlData.tvlFormatted,
      };
    });
  } catch (error) {
    console.error(`❌ Error fetching pool APY for ${poolAddress} on chain ${chainId}:`, error.message);
    return {
      supplyAPY: null,
      borrowAPY: null,
      maxLeverage: 1,
      tvl: 0,
    };
  }
}

/**
 * Check if user has a credit account (leveraged position) for a pool
 * @param {string} poolAddress - Gearbox pool contract address
 * @param {string} userAddress - User's wallet address
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object|null>} Credit account info or null if no leverage
 */
async function getCreditAccount(poolAddress, userAddress, chainId) {
  try {
    // TODO: Implement credit account detection using Gearbox SDK
    // This requires querying the Credit Manager contract associated with the pool
    // For now, return null (assumes non-leveraged positions)
    return null;
  } catch (error) {
    console.error(`❌ Error checking credit account:`, error.message);
    return null;
  }
}

/**
 * Get health factor for a leveraged position
 * @param {string} creditAccountAddress - Credit account contract address
 * @param {number} chainId - Chain ID
 * @returns {Promise<number|null>} Health factor (1.0 = at liquidation threshold) or null
 */
async function getHealthFactor(creditAccountAddress, chainId) {
  try {
    // TODO: Implement health factor calculation from credit account
    // This involves querying the Credit Facade contract
    return null;
  } catch (error) {
    console.error(`❌ Error fetching health factor:`, error.message);
    return null;
  }
}

/**
 * Get Total Value Locked (TVL) for an ERC4626 pool
 * @param {string} poolAddress - ERC4626 pool contract address
 * @param {number} chainId - Chain ID (1 for Ethereum, 9745 for Plasma)
 * @returns {Promise<Object>} TVL data { tvlRaw, tvlFormatted, underlyingToken, decimals }
 */
async function getPoolTVL(poolAddress, chainId) {
  try {
    const client = getClient(chainId);

    return await withRetry(async () => {
      // Get pool metadata first
      const [decimals, asset, totalAssets] = await Promise.all([
        // Get decimal precision
        client.readContract({
          address: poolAddress,
          abi: [
            {
              name: 'decimals',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint8' }],
            },
          ],
          functionName: 'decimals',
        }),
        // Get underlying token address
        client.readContract({
          address: poolAddress,
          abi: [
            {
              name: 'asset',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'address' }],
            },
          ],
          functionName: 'asset',
        }),
        // Get total assets (TVL in underlying token)
        client.readContract({
          address: poolAddress,
          abi: [
            {
              name: 'totalAssets',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'totalAssets',
        }),
      ]);

      // Format TVL from raw BigInt to human-readable
      const tvlFormatted = formatUnits(totalAssets, decimals);

      console.log(`   ✅ Pool ${poolAddress.slice(0, 10)}... on chain ${chainId}: TVL = $${parseFloat(tvlFormatted).toFixed(2)}`);

      return {
        tvlRaw: totalAssets.toString(),        // BigInt as string
        tvlFormatted: parseFloat(tvlFormatted),// Human-readable number
        underlyingToken: asset,
        decimals: decimals,
      };
    });
  } catch (error) {
    console.error(`❌ Error fetching TVL for ${poolAddress} on chain ${chainId}:`, error.message);
    return {
      tvlRaw: '0',
      tvlFormatted: 0,
      underlyingToken: null,
      decimals: 18,
    };
  }
}

/**
 * Get pool info (name, symbol, underlying token)
 * @param {string} poolAddress - Gearbox pool contract address
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} Pool info { name, symbol, asset, decimals }
 */
async function getPoolInfo(poolAddress, chainId) {
  try {
    const client = getClient(chainId);

    return await withRetry(async () => {
      // Get pool metadata using multicall for efficiency
      const [name, symbol, decimals, asset] = await Promise.all([
        client.readContract({
          address: poolAddress,
          abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'name',
        }),
        client.readContract({
          address: poolAddress,
          abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
          functionName: 'symbol',
        }),
        client.readContract({
          address: poolAddress,
          abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
          functionName: 'decimals',
        }),
        client.readContract({
          address: poolAddress,
          abi: [{ name: 'asset', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
          functionName: 'asset',
        }),
      ]);

      return { name, symbol, asset, decimals };
    });
  } catch (error) {
    console.error(`❌ Error fetching pool info:`, error.message);
    throw error;
  }
}

module.exports = {
  getClient,
  getPoolBalance,
  convertSharesToAssets,
  getPoolAPY,
  getPoolTVL,
  getCreditAccount,
  getHealthFactor,
  getPoolInfo,
  withRetry,
};

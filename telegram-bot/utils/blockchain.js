/**
 * Blockchain utilities for interacting with Gearbox pools
 * Real balance checking using viem for Ethereum and Plasma chains
 */

const { createPublicClient, http, parseUnits, formatUnits } = require('viem');
const { mainnet } = require('viem/chains');
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
      http: [config.blockchain.chains.plasma.rpcUrl],
    },
    public: {
      http: [config.blockchain.chains.plasma.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Plasma Explorer',
      url: config.blockchain.chains.plasma.explorerUrl,
    },
  },
};

// Create viem clients for each chain
const clients = {
  1: createPublicClient({
    chain: mainnet,
    transport: http(config.blockchain.chains.ethereum.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
  9745: createPublicClient({
    chain: plasmaChain,
    transport: http(config.blockchain.chains.plasma.rpcUrl, {
      timeout: config.blockchain.rpc.timeoutMs,
      retryCount: config.blockchain.rpc.maxRetries,
      retryDelay: config.blockchain.rpc.retryDelayMs,
    }),
  }),
};

/**
 * Get public client for a specific chain
 * @param {number} chainId - Chain ID (1 for Ethereum, 9745 for Plasma)
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
 * Get pool APY from the pool contract or Gearbox API
 * @param {string} poolAddress - Gearbox pool contract address
 * @param {number} chainId - Chain ID
 * @returns {Promise<Object>} APY data { supplyAPY, borrowAPY }
 */
async function getPoolAPY(poolAddress, chainId) {
  try {
    // TODO: Implement real APY fetching from Gearbox API or on-chain
    // For now, return placeholder that will be replaced by query-opportunities.js
    return {
      supplyAPY: null,
      borrowAPY: null,
    };
  } catch (error) {
    console.error(`❌ Error fetching pool APY:`, error.message);
    return {
      supplyAPY: null,
      borrowAPY: null,
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
  getCreditAccount,
  getHealthFactor,
  getPoolInfo,
  withRetry,
};

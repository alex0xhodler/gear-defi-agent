/**
 * Shared transaction builder for Gearbox pool operations
 * Pure transaction construction logic (no signing) - works in both browser and Node.js
 *
 * Usage:
 * - Web app: Use wagmi/viem hooks to sign the built transactions
 * - Telegram bot: Use WalletConnect to sign the built transactions
 */

const { parseUnits, formatUnits, maxUint256, encodeFunctionData } = require('viem');

/**
 * ERC20 Token ABI (minimal)
 */
const ERC20_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
];

/**
 * Gearbox Pool (ERC4626) ABI (minimal)
 */
const POOL_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'asset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'depositWithReferral',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'referralCode', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'convertToShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
];

/**
 * Build deposit transactions (approval + deposit)
 * Returns transaction objects ready to be signed
 *
 * @param {Object} params - Parameters
 * @param {Object} params.client - Viem public client for reading blockchain state
 * @param {string} params.poolAddress - Gearbox pool contract address
 * @param {string} params.tokenAddress - ERC20 token to deposit
 * @param {string} params.amount - Human-readable amount (e.g., "100" for 100 USDC)
 * @param {string} params.userAddress - User's wallet address (receiver)
 * @param {number} params.chainId - Chain ID
 * @param {number} params.referralCode - Optional referral code (default 0)
 * @returns {Promise<Object>} Transaction objects ready to sign
 */
async function buildDepositTransactions({
  client,
  poolAddress,
  tokenAddress,
  amount,
  userAddress,
  chainId,
  referralCode = 0,
}) {
  // Step 1: Get token decimals
  const decimals = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  // Step 2: Convert amount to wei
  const amountWei = parseUnits(amount, decimals);

  // Step 3: Check user balance
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  });

  if (balance < amountWei) {
    throw new Error(
      `Insufficient balance. Have: ${formatUnits(balance, decimals)}, Need: ${amount}`
    );
  }

  // Step 4: Check existing allowance
  const currentAllowance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, poolAddress],
  });

  const needsApproval = currentAllowance < amountWei;

  // Step 5: Build approval transaction if needed
  let approvalTx = undefined;
  if (needsApproval) {
    // Encode approve(spender, amount) call
    approvalTx = {
      to: tokenAddress,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, maxUint256], // Infinite approval for gas savings
      }),
      chainId,
    };
  }

  // Step 6: Estimate expected shares (optional, for UI preview)
  let expectedShares = undefined;
  try {
    const shares = await client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'convertToShares',
      args: [amountWei],
    });
    expectedShares = formatUnits(shares, decimals);
  } catch (error) {
    // convertToShares might not be available, skip
    console.warn('Could not estimate expected shares:', error);
  }

  // Step 7: Build deposit transaction
  const depositTx = {
    to: poolAddress,
    data: encodeFunctionData({
      abi: POOL_ABI,
      functionName: 'depositWithReferral',
      args: [amountWei, userAddress, BigInt(referralCode)],
    }),
    chainId,
  };

  return {
    needsApproval,
    approvalTx,
    depositTx,
    expectedShares,
    tokenDecimals: decimals,
    amountWei,
  };
}

/**
 * Build withdraw transaction
 * Withdraws by burning shares and receiving underlying tokens
 *
 * @param {Object} params - Parameters
 * @param {Object} params.client - Viem public client for reading blockchain state
 * @param {string} params.poolAddress - Gearbox pool contract address
 * @param {string} params.shares - Amount of shares to burn (human-readable)
 * @param {string} params.userAddress - User's wallet address
 * @param {number} params.chainId - Chain ID
 * @param {boolean} params.withdrawAll - If true, withdraws all user's shares
 * @returns {Promise<Object>} Transaction object ready to sign
 */
async function buildWithdrawTransaction({
  client,
  poolAddress,
  shares,
  userAddress,
  chainId,
  withdrawAll = false,
}) {
  // Step 1: Get pool token decimals
  const decimals = await client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'decimals',
  });

  // Step 2: Get user's share balance
  const userShares = await client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  });

  if (userShares === 0n) {
    throw new Error('No shares to withdraw');
  }

  // Step 3: Calculate shares to burn
  let sharesWei;
  if (withdrawAll) {
    sharesWei = userShares;
  } else {
    sharesWei = parseUnits(shares, decimals);
    if (sharesWei > userShares) {
      throw new Error(
        `Insufficient shares. Have: ${formatUnits(userShares, decimals)}, Requested: ${shares}`
      );
    }
  }

  // Step 4: Calculate expected assets (for UI preview)
  const expectedAssetsWei = await client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'convertToAssets',
    args: [sharesWei],
  });

  const expectedAssets = formatUnits(expectedAssetsWei, decimals);

  // Step 5: Build redeem transaction
  // Use redeem() instead of withdraw() since we know exact shares amount
  const withdrawTx = {
    to: poolAddress,
    data: encodeFunctionData({
      abi: POOL_ABI,
      functionName: 'redeem',
      args: [sharesWei, userAddress, userAddress],
    }),
    chainId,
  };

  return {
    withdrawTx,
    expectedAssets,
    sharesWei,
    tokenDecimals: decimals,
  };
}

/**
 * Parse shares from deposit transaction receipt
 * Looks for Transfer event where from = 0x0 (mint) and to = userAddress
 *
 * @param {Array} logs - Transaction receipt logs
 * @param {string} userAddress - User's wallet address
 * @param {number} decimals - Token decimals
 * @returns {string} Shares received (human-readable)
 */
function parseSharesFromLogs(logs, userAddress, decimals) {
  const transferEventSignature =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)

  const transferLog = logs.find(
    (log) =>
      log.topics[0] === transferEventSignature &&
      log.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000' && // from 0x0
      log.topics[2]?.toLowerCase().includes(userAddress.toLowerCase().slice(2)) // to user
  );

  if (!transferLog || !transferLog.data) {
    throw new Error('Could not parse shares from transaction logs');
  }

  const sharesWei = BigInt(transferLog.data);
  return formatUnits(sharesWei, decimals);
}

/**
 * Parse assets from withdraw transaction receipt
 * Looks for Transfer event where from = poolAddress and to = userAddress
 *
 * @param {Array} logs - Transaction receipt logs
 * @param {string} poolAddress - Pool contract address
 * @param {string} userAddress - User's wallet address
 * @param {number} decimals - Token decimals
 * @returns {string} Assets received (human-readable)
 */
function parseAssetsFromLogs(logs, poolAddress, userAddress, decimals) {
  const transferEventSignature =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  const transferLog = logs.find(
    (log) =>
      log.topics[0] === transferEventSignature &&
      log.topics[1]?.toLowerCase().includes(poolAddress.toLowerCase().slice(2)) && // from pool
      log.topics[2]?.toLowerCase().includes(userAddress.toLowerCase().slice(2)) // to user
  );

  if (!transferLog || !transferLog.data) {
    throw new Error('Could not parse assets from transaction logs');
  }

  const assetsWei = BigInt(transferLog.data);
  return formatUnits(assetsWei, decimals);
}

/**
 * Estimate gas for a transaction
 * Falls back to hardcoded estimates if estimation fails
 *
 * @param {Object} client - Viem public client
 * @param {Object} tx - Transaction request
 * @param {string} userAddress - User's address (for simulation)
 * @returns {Promise<bigint>} Estimated gas limit
 */
async function estimateGas(client, tx, userAddress) {
  try {
    const gas = await client.estimateGas({
      account: userAddress,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });

    // Add 20% buffer for safety
    return (gas * 120n) / 100n;
  } catch (error) {
    console.warn('Gas estimation failed, using fallback:', error);

    // Fallback gas estimates based on operation
    if (tx.data.startsWith('0x095ea7b3')) {
      // approve()
      return 50_000n;
    } else if (tx.data.startsWith('0x6e553f65')) {
      // depositWithReferral()
      return 150_000n;
    } else if (tx.data.startsWith('0xba087652')) {
      // redeem()
      return 120_000n;
    }

    // Default fallback
    return 200_000n;
  }
}

/**
 * Get gas price estimates for a chain
 *
 * @param {Object} client - Viem public client
 * @returns {Promise<bigint>} Gas price in wei
 */
async function getGasPrice(client) {
  try {
    const gasPrice = await client.getGasPrice();
    return gasPrice;
  } catch (error) {
    console.warn('Gas price fetch failed, using fallback:', error);
    return 20_000_000_000n; // 20 gwei fallback
  }
}

/**
 * Estimate total transaction cost (gas * gasPrice)
 *
 * @param {Object} client - Viem public client
 * @param {Object} tx - Transaction request
 * @param {string} userAddress - User's address
 * @returns {Promise<string>} Cost in ETH (human-readable)
 */
async function estimateTransactionCost(client, tx, userAddress) {
  const [gas, gasPrice] = await Promise.all([
    estimateGas(client, tx, userAddress),
    getGasPrice(client),
  ]);

  const costWei = gas * gasPrice;
  return formatUnits(costWei, 18); // ETH has 18 decimals
}

// Export everything
module.exports = {
  buildDepositTransactions,
  buildWithdrawTransaction,
  parseSharesFromLogs,
  parseAssetsFromLogs,
  estimateGas,
  getGasPrice,
  estimateTransactionCost,
  ERC20_ABI,
  POOL_ABI,
};

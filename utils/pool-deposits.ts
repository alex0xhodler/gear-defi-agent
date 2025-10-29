// Real Gearbox pool deposit transactions (approve + depositWithReferral)
// Based on Tenderly trace analysis of successful Plasma deposits

import type { Address } from 'viem';

/**
 * Callbacks for deposit transaction lifecycle
 */
export interface DepositCallbacks {
  onApprovalPending?: (txHash: string) => void;
  onApprovalConfirmed?: (txHash: string) => void;
  onDepositPending?: (txHash: string) => void;
  onDepositConfirmed?: (txHash: string, shares: string) => void;
  onError?: (error: Error, stage: 'approval' | 'deposit') => void;
}

/**
 * Deposit tokens into Gearbox pool with approval
 *
 * Transaction flow (based on Tenderly traces):
 * 1. Get token decimals
 * 2. Convert amount to wei (e.g., 100 USDT0 → 100000000 with 6 decimals)
 * 3. Check existing allowance
 * 4. Approve pool for uint256.max (infinite approval for gas savings)
 * 5. Call depositWithReferral(assets, receiver, referralCode)
 * 6. Parse shares from Transfer event logs (mint from 0x0 to user)
 *
 * @param poolAddress - Gearbox pool contract address
 * @param tokenAddress - ERC20 token to deposit
 * @param amount - Human-readable amount (e.g., "100" for 100 USDT0)
 * @param userAddress - User's wallet address (receiver)
 * @param referralCode - Optional referral code (default 0)
 * @param callbacks - Optional callbacks for transaction lifecycle
 * @returns Deposit result with shares received
 */
export async function depositToGearboxPool({
  poolAddress,
  tokenAddress,
  amount,
  userAddress,
  referralCode = 0,
  callbacks,
}: {
  poolAddress: Address;
  tokenAddress: Address;
  amount: string;
  userAddress: Address;
  referralCode?: number;
  callbacks?: DepositCallbacks;
}): Promise<{
  success: boolean;
  shares?: string;
  approvalTxHash?: string;
  depositTxHash?: string;
  error?: string;
}> {
  try {
    // Get wagmi hooks from window (loaded via CDN)
    const { readContract, writeContract, waitForTransactionReceipt, parseUnits, formatUnits, maxUint256 } = window.viem;

    if (!window.ethereum) {
      throw new Error('No wallet connected');
    }

    console.log('🔍 Starting deposit transaction:', {
      pool: poolAddress,
      token: tokenAddress,
      amount,
      user: userAddress,
    });

    // Step 1: Get token decimals
    const decimals = await readContract({
      address: tokenAddress,
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

    console.log(`💰 Token decimals: ${decimals}`);

    // Step 2: Convert amount to wei
    const amountWei = parseUnits(amount, decimals);
    console.log(`💰 Amount in wei: ${amountWei}`);

    // Step 3: Check existing allowance
    const currentAllowance = await readContract({
      address: tokenAddress,
      abi: [
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
      ],
      functionName: 'allowance',
      args: [userAddress, poolAddress],
    });

    console.log(`✅ Current allowance: ${currentAllowance}`);

    let approvalTxHash: string | undefined;

    // Step 4: Approve if needed (use infinite approval for gas savings)
    if (currentAllowance < amountWei) {
      console.log('🔐 Approving pool for infinite amount...');

      const approveTxHash = await writeContract({
        address: tokenAddress,
        abi: [
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
        ],
        functionName: 'approve',
        args: [poolAddress, maxUint256],
      });

      approvalTxHash = approveTxHash;
      callbacks?.onApprovalPending?.(approveTxHash);
      console.log(`⏳ Approval pending: ${approveTxHash}`);

      // Wait for approval confirmation
      await waitForTransactionReceipt({
        hash: approveTxHash,
      });

      callbacks?.onApprovalConfirmed?.(approveTxHash);
      console.log(`✅ Approval confirmed: ${approveTxHash}`);
    } else {
      console.log('✅ Sufficient allowance already exists');
    }

    // Step 5: Deposit into pool using depositWithReferral
    console.log('💸 Depositing into pool...');

    const depositTxHash = await writeContract({
      address: poolAddress,
      abi: [
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
      ],
      functionName: 'depositWithReferral',
      args: [amountWei, userAddress, BigInt(referralCode)],
    });

    callbacks?.onDepositPending?.(depositTxHash);
    console.log(`⏳ Deposit pending: ${depositTxHash}`);

    // Wait for deposit confirmation
    const receipt = await waitForTransactionReceipt({
      hash: depositTxHash,
    });

    console.log(`✅ Deposit confirmed: ${depositTxHash}`);

    // Step 6: Parse shares from Transfer event logs
    // Look for Transfer(address indexed from, address indexed to, uint256 value)
    // where from = 0x0 (mint) and to = userAddress
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const transferLog = receipt.logs.find(
      (log) =>
        log.topics[0] === transferEventSignature &&
        log.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000' && // from 0x0
        log.topics[2]?.toLowerCase().includes(userAddress.toLowerCase().slice(2)) // to user
    );

    let shares = '0';
    if (transferLog && transferLog.data) {
      const sharesWei = BigInt(transferLog.data);
      shares = formatUnits(sharesWei, decimals);
      console.log(`🎉 Shares received: ${shares}`);
    } else {
      console.warn('⚠️ Could not parse shares from logs');
    }

    callbacks?.onDepositConfirmed?.(depositTxHash, shares);

    return {
      success: true,
      shares,
      approvalTxHash,
      depositTxHash,
    };
  } catch (error: any) {
    console.error('❌ Deposit transaction failed:', error);

    const stage = error.message?.includes('approve') ? 'approval' : 'deposit';
    callbacks?.onError?.(error, stage);

    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Get pool token balance (shares) for a user
 * @param poolAddress - Gearbox pool contract address
 * @param userAddress - User's wallet address
 * @returns Balance of pool tokens (shares)
 */
export async function getPoolBalance(
  poolAddress: Address,
  userAddress: Address
): Promise<string> {
  try {
    const { readContract, formatUnits } = window.viem;

    // Get pool token decimals
    const decimals = await readContract({
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

    // Get user's pool token balance
    const balance = await readContract({
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
  } catch (error) {
    console.error('❌ Error fetching pool balance:', error);
    return '0';
  }
}

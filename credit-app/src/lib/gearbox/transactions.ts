import { encodeFunctionData, type Address, type Hex } from 'viem';
import { getGearboxSDK, type CreditManagerData } from './sdk';
import { ETH_PLUS_ADDRESS, WETH_ADDRESS } from './constants';

// Multicall type matching Gearbox contracts
export interface MultiCall {
  target: Address;
  callData: Hex;
}

// Transaction result type
export interface TransactionRequest {
  to: Address;
  data: Hex;
  value: bigint;
}

// CreditFacade ABI fragments for encoding calls
const CREDIT_FACADE_ABI = [
  {
    type: 'function',
    name: 'openCreditAccount',
    inputs: [
      { name: 'onBehalfOf', type: 'address' },
      { name: 'calls', type: 'tuple[]', components: [
        { name: 'target', type: 'address' },
        { name: 'callData', type: 'bytes' }
      ]},
      { name: 'referralCode', type: 'uint256' }
    ],
    outputs: [{ name: 'creditAccount', type: 'address' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'multicall',
    inputs: [
      { name: 'creditAccount', type: 'address' },
      { name: 'calls', type: 'tuple[]', components: [
        { name: 'target', type: 'address' },
        { name: 'callData', type: 'bytes' }
      ]}
    ],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'addCollateral',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'increaseDebt',
    inputs: [
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'updateQuota',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'quotaChange', type: 'int96' },
      { name: 'minQuota', type: 'uint96' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const;

/**
 * Build multicall to add collateral
 */
export function buildAddCollateralCall(
  creditFacade: Address,
  token: Address,
  amount: bigint
): MultiCall {
  const callData = encodeFunctionData({
    abi: CREDIT_FACADE_ABI,
    functionName: 'addCollateral',
    args: [token, amount]
  });

  return {
    target: creditFacade,
    callData
  };
}

/**
 * Build multicall to increase debt (borrow)
 */
export function buildIncreaseDebtCall(
  creditFacade: Address,
  amount: bigint
): MultiCall {
  const callData = encodeFunctionData({
    abi: CREDIT_FACADE_ABI,
    functionName: 'increaseDebt',
    args: [amount]
  });

  return {
    target: creditFacade,
    callData
  };
}

/**
 * Build multicall to update quota for a token (enable collateral)
 */
export function buildUpdateQuotaCall(
  creditFacade: Address,
  token: Address,
  quotaChange: bigint,
  minQuota: bigint = 0n
): MultiCall {
  const callData = encodeFunctionData({
    abi: CREDIT_FACADE_ABI,
    functionName: 'updateQuota',
    args: [token, quotaChange, minQuota]
  });

  return {
    target: creditFacade,
    callData
  };
}

/**
 * Build the complete transaction to open a leveraged ETH+ position
 *
 * Flow:
 * 1. Open credit account with initial ETH collateral
 * 2. Borrow additional WETH based on leverage
 * 3. Swap all WETH to ETH+ (via adapter)
 *
 * @param creditManager The credit manager data
 * @param depositAmount Amount of ETH to deposit (in wei)
 * @param leverage Target leverage (100 = 1x, 400 = 4x)
 * @param userAddress User's wallet address
 */
export async function buildOpenLeveragedPositionTx(
  creditManager: CreditManagerData,
  depositAmount: bigint,
  leverage: number,
  userAddress: Address
): Promise<TransactionRequest> {
  // Calculate borrow amount based on leverage
  // If deposit is 1 ETH and leverage is 4x, we need to borrow 3 ETH
  const leverageMultiplier = BigInt(leverage);
  const totalPosition = (depositAmount * leverageMultiplier) / 100n;
  const borrowAmount = totalPosition - depositAmount;

  // Build multicalls for the credit account operations
  const calls: MultiCall[] = [];

  // 1. Add collateral (WETH)
  calls.push(buildAddCollateralCall(
    creditManager.creditFacade,
    WETH_ADDRESS,
    depositAmount
  ));

  // 2. Increase debt (borrow more WETH)
  if (borrowAmount > 0n) {
    calls.push(buildIncreaseDebtCall(
      creditManager.creditFacade,
      borrowAmount
    ));
  }

  // 3. Enable ETH+ quota for the position
  calls.push(buildUpdateQuotaCall(
    creditManager.creditFacade,
    ETH_PLUS_ADDRESS,
    totalPosition,
    0n
  ));

  // Note: The actual swap from WETH to ETH+ would happen via an adapter
  // This depends on which swap adapter is available (Curve, Uniswap, etc.)
  // For now, we'll leave the position in WETH with ETH+ quota enabled
  // The user would need to manually swap via the Gearbox UI or bot

  // Encode the openCreditAccount call
  const txData = encodeFunctionData({
    abi: CREDIT_FACADE_ABI,
    functionName: 'openCreditAccount',
    args: [userAddress, calls, 0n] // 0 = no referral code
  });

  return {
    to: creditManager.creditFacade,
    data: txData,
    value: depositAmount // Send ETH with the transaction (will be wrapped to WETH)
  };
}

/**
 * Estimate gas for opening a leveraged position
 */
export async function estimateOpenPositionGas(
  tx: TransactionRequest,
  userAddress: Address
): Promise<bigint> {
  const sdk = await getGearboxSDK();

  try {
    const gas = await sdk.client.estimateGas({
      account: userAddress,
      to: tx.to,
      data: tx.data,
      value: tx.value
    });

    // Add 20% buffer for safety
    return (gas * 120n) / 100n;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    // Return a conservative estimate
    return 500_000n;
  }
}

/**
 * Get current gas price
 */
export async function getGasPrice(): Promise<bigint> {
  const sdk = await getGearboxSDK();
  return await sdk.client.getGasPrice();
}

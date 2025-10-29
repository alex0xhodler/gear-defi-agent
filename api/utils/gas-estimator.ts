// Utility for estimating gas costs for Gearbox transactions
import { getGearboxSDK } from './gearbox-sdk.js';
import { getTokenPriceUSD } from './price-oracle.js';
import type { Address } from 'viem';

/**
 * Estimate gas cost in USD for opening a credit account
 * @param creditManagerAddress - Credit manager contract address
 * @param userAddress - User's wallet address
 * @param collateralAmount - Amount of collateral to deposit (in token decimals)
 * @param collateralToken - Token symbol for collateral
 * @returns Estimated gas cost in USD
 */
export async function estimateOpenAccountGasUSD(
  creditManagerAddress: string,
  userAddress: string,
  collateralAmount: bigint,
  collateralToken: string
): Promise<number> {
  try {
    const sdk = await getGearboxSDK();

    // Get gas price from provider
    const gasPrice = await sdk.client.getGasPrice();

    // Estimate gas for opening credit account
    // Base gas estimate for openCreditAccount transaction
    const baseGasUnits = 500000n; // ~500k gas units for typical open account transaction

    // Calculate total gas cost in ETH
    const gasCostWei = baseGasUnits * gasPrice;
    const gasCostETH = Number(gasCostWei) / 1e18;

    // Convert ETH cost to USD using oracle
    const ethPriceUSD = await getTokenPriceUSD('WETH');
    const gasCostUSD = gasCostETH * ethPriceUSD;

    console.log(`⛽ Gas estimate: ${baseGasUnits.toString()} units × ${Number(gasPrice) / 1e9} gwei = $${gasCostUSD.toFixed(2)}`);

    return Math.round(gasCostUSD);

  } catch (error) {
    console.error('❌ Error estimating gas:', error);

    // Fallback to chain-based estimates
    const sdk = await getGearboxSDK();
    const fallbackEstimates: Record<string, number> = {
      Mainnet: 15,
      Arbitrum: 2,
      Optimism: 2,
      Base: 1,
      BNB: 3,
    };

    const fallback = fallbackEstimates[sdk.networkType] || 10;
    console.warn(`⚠️ Using fallback gas estimate: $${fallback}`);
    return fallback;
  }
}

/**
 * Get current gas price in Gwei
 * @returns Gas price in Gwei
 */
export async function getCurrentGasPrice(): Promise<number> {
  try {
    const sdk = await getGearboxSDK();
    const gasPrice = await sdk.client.getGasPrice();
    const gasPriceGwei = Number(gasPrice) / 1e9;

    console.log(`⛽ Current gas price: ${gasPriceGwei.toFixed(2)} gwei`);
    return gasPriceGwei;
  } catch (error) {
    console.error('❌ Error fetching gas price:', error);
    return 20; // Fallback to 20 gwei
  }
}

/**
 * Estimate gas for common Gearbox operations
 * @param operation - Type of operation
 * @returns Estimated gas units
 */
export function estimateGasUnits(operation: 'openAccount' | 'closeAccount' | 'multicall' | 'addCollateral'): bigint {
  const estimates: Record<string, bigint> = {
    openAccount: 500000n,    // Open credit account with multicall
    closeAccount: 350000n,   // Close account and withdraw
    multicall: 400000n,      // Execute multicall (swap + stake)
    addCollateral: 150000n,  // Add collateral to existing position
  };

  return estimates[operation] || 300000n;
}

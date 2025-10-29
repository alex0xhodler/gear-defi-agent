// Utility for fetching token prices from Gearbox price oracle
import { getGearboxSDK } from './gearbox-sdk.js';
import type { Address } from 'viem';

/**
 * Get token price in USD from Gearbox price oracle
 * @param tokenSymbol - Token symbol (e.g., 'USDC', 'WETH', 'GHO')
 * @returns Price in USD (e.g., 3000.50 for WETH)
 */
export async function getTokenPriceUSD(tokenSymbol: string): Promise<number> {
  try {
    const sdk = await getGearboxSDK();

    // Find token address by symbol
    const tokenMeta = Array.from(sdk.tokensMeta.values()).find(
      (token) => token.symbol.toUpperCase() === tokenSymbol.toUpperCase()
    );

    if (!tokenMeta) {
      throw new Error(`Token ${tokenSymbol} not found in SDK metadata`);
    }

    // Get first market's price oracle (all markets share same oracle on same chain)
    const market = sdk.marketRegister.markets[0];
    if (!market) {
      throw new Error('No markets available in SDK');
    }

    const oracle = market.priceOracle;

    // Fetch USD price (8 decimals: 1 USD = 100000000)
    const priceBigInt = await oracle.mainPrice(tokenMeta.addr as Address);
    const priceUSD = Number(priceBigInt) / 1e8;

    console.log(`💰 Oracle price for ${tokenSymbol}: $${priceUSD.toFixed(2)}`);

    return priceUSD;
  } catch (error) {
    console.error(`❌ Error fetching price for ${tokenSymbol}:`, error);

    // Fallback to approximate prices for common tokens
    const fallbackPrices: Record<string, number> = {
      USDC: 1,
      USDT: 1,
      DAI: 1,
      GHO: 1,
      WETH: 3000,
      ETH: 3000,
      wstETH: 3500,
      WBTC: 60000,
      sUSDe: 1,
    };

    const fallbackPrice = fallbackPrices[tokenSymbol.toUpperCase()] || 1;
    console.warn(`⚠️ Using fallback price for ${tokenSymbol}: $${fallbackPrice}`);

    return fallbackPrice;
  }
}

/**
 * Convert token amount to USD value
 * @param tokenAddress - Token contract address
 * @param amount - Token amount as bigint
 * @returns USD value
 */
export async function convertTokenToUSD(
  tokenAddress: string,
  amount: bigint
): Promise<number> {
  try {
    const sdk = await getGearboxSDK();
    const market = sdk.marketRegister.markets[0];

    if (!market) {
      throw new Error('No markets available in SDK');
    }

    const oracle = market.priceOracle;

    // Convert to USD (8 decimals)
    const usdValueBigInt = await oracle.convertToUSD(tokenAddress as Address, amount);
    const usdValue = Number(usdValueBigInt) / 1e8;

    return usdValue;
  } catch (error) {
    console.error('❌ Error converting token to USD:', error);
    throw error;
  }
}

/**
 * Get multiple token prices in parallel
 * @param tokenSymbols - Array of token symbols
 * @returns Map of token symbol to USD price
 */
export async function getMultipleTokenPrices(
  tokenSymbols: string[]
): Promise<Map<string, number>> {
  const pricePromises = tokenSymbols.map(async (symbol) => {
    const price = await getTokenPriceUSD(symbol);
    return [symbol, price] as [string, number];
  });

  const prices = await Promise.all(pricePromises);
  return new Map(prices);
}

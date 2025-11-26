import { GearboxSDK } from '@gearbox-protocol/sdk';
import { type Address } from 'viem';
import { RAY, ETH_PLUS_ADDRESS, WETH_ADDRESS } from './constants';

// DefiLlama ETH+ pool UUID (Reserve Protocol on Ethereum)
const DEFILLAMA_ETH_PLUS_POOL = 'e6cbbcbd-1a0f-4c97-9377-e4d7d55e2d72';

// Types for market and pool data
export interface PoolData {
  address: Address;
  name: string;
  underlying: Address;
  underlyingSymbol: string;
  totalSupplied: bigint;
  totalBorrowed: bigint;
  availableLiquidity: bigint;
  supplyRate: bigint; // RAY format
  borrowRate: bigint; // RAY format
  supplyAPY: number; // Percentage
  borrowAPY: number; // Percentage
}

export interface CreditManagerData {
  address: Address;
  name: string;
  underlying: Address;
  underlyingSymbol: string;
  pool: Address;
  creditFacade: Address;
  minDebt: bigint;
  maxDebt: bigint;
  maxLeverage: number;
  supportedTokens: Address[];
  supportsETHPlus: boolean;
}

export interface StrategyData {
  creditManager: CreditManagerData;
  pool: PoolData;
  ethPlusAPY: number; // ETH+ base yield
  quotaRate: number; // Quota fee for ETH+ collateral (e.g., 0.01%)
  netAPY: number; // Net APY after borrow costs
  maxLeverage: number; // Max from SDK credit manager (e.g., 400 = 4x)
  ltv: number; // Loan-to-value ratio (e.g., 0.93)
  maxLeverageForSafeHF: number; // Max leverage capped at HF >= 1.10
}

// Singleton SDK instance
let sdkInstance: GearboxSDK | null = null;
let sdkInitPromise: Promise<GearboxSDK> | null = null;

/**
 * Get or initialize the Gearbox SDK singleton
 */
export async function getGearboxSDK(rpcUrl?: string): Promise<GearboxSDK> {
  if (sdkInstance) {
    return sdkInstance;
  }

  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  const rpc = rpcUrl || import.meta.env.VITE_ETHEREUM_RPC_URL;

  if (!rpc) {
    throw new Error('VITE_ETHEREUM_RPC_URL is not set');
  }

  sdkInitPromise = GearboxSDK.attach({
    rpcURLs: [rpc],
    timeout: 120_000,
    ignoreUpdateablePrices: true,
  });

  try {
    sdkInstance = await sdkInitPromise;
    console.log('Gearbox SDK initialized:', sdkInstance.marketRegister.markets.length, 'markets');
    return sdkInstance;
  } catch (error) {
    sdkInitPromise = null;
    throw error;
  }
}

/**
 * Convert RAY rate to APY percentage
 */
export function rayToAPY(rate: bigint): number {
  return Number((rate * 10000n) / RAY) / 100;
}

/**
 * Fetch ETH+/ETH price ratio from Gearbox price oracle
 * ETH+ should trade very close to 1:1 with ETH
 */
export async function getETHPlusToETHRatio(): Promise<number> {
  try {
    const sdk = await getGearboxSDK();

    const market = sdk.marketRegister.markets[0];
    if (!market) {
      console.warn('No markets available for price oracle');
      return 1.0; // Assume 1:1 peg
    }

    const oracle = market.priceOracle;

    // Get both prices (8 decimals)
    const [ethPlusPriceBigInt, wethPriceBigInt] = await Promise.all([
      oracle.mainPrice(ETH_PLUS_ADDRESS),
      oracle.mainPrice(WETH_ADDRESS),
    ]);

    const ethPlusPrice = Number(ethPlusPriceBigInt);
    const wethPrice = Number(wethPriceBigInt);

    if (wethPrice === 0) return 1.0;

    const ratio = ethPlusPrice / wethPrice;
    console.log(`💱 ETH+/ETH ratio: ${ratio.toFixed(4)}`);
    return ratio;
  } catch (error) {
    console.error('Failed to fetch ETH+/ETH ratio:', error);
    return 1.0; // Assume 1:1 peg on error
  }
}

/**
 * Fetch ETH price from Gearbox price oracle
 */
export async function getETHPriceUSD(): Promise<number> {
  try {
    const sdk = await getGearboxSDK();

    // Get first market's price oracle
    const market = sdk.marketRegister.markets[0];
    if (!market) {
      console.warn('No markets available for price oracle');
      return 3500; // Fallback
    }

    const oracle = market.priceOracle;

    // Fetch WETH price (8 decimals: 1 USD = 100000000)
    const priceBigInt = await oracle.mainPrice(WETH_ADDRESS);
    const priceUSD = Number(priceBigInt) / 1e8;

    console.log(`💰 Oracle ETH price: $${priceUSD.toFixed(2)}`);
    return priceUSD;
  } catch (error) {
    console.error('Failed to fetch ETH price from oracle:', error);
    return 3500; // Fallback price
  }
}

/**
 * Fetch ETH+ APY from DefiLlama yields API
 * ETH+ is a diversified LST basket from Reserve Protocol
 */
export async function getETHPlusAPY(): Promise<number> {
  try {
    const response = await fetch(
      `https://yields.llama.fi/chart/${DEFILLAMA_ETH_PLUS_POOL}`
    );

    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.status}`);
    }

    const data = await response.json();

    // Get latest APY from chart data
    if (data.data && data.data.length > 0) {
      const latestEntry = data.data[data.data.length - 1];
      const apy = latestEntry.apy || latestEntry.apyBase || 3.5;
      console.log(`📊 ETH+ APY from DefiLlama: ${apy.toFixed(2)}%`);
      return apy;
    }

    return 3.5; // Fallback - ETH+ typically yields ~3-4%
  } catch (error) {
    console.error('Failed to fetch ETH+ APY from DefiLlama:', error);
    return 3.5;
  }
}

/**
 * Get ETH+ quota rate from the pool
 * Quota rate is the fee charged for using ETH+ as collateral
 */
export async function getETHPlusQuotaRate(): Promise<number> {
  try {
    const sdk = await getGearboxSDK();

    for (const market of sdk.marketRegister.markets) {
      const poolSuite = market.pool;
      if (!poolSuite) continue;

      // Check if this is a WETH pool
      const underlying = poolSuite.underlying.toLowerCase();
      if (underlying !== WETH_ADDRESS.toLowerCase()) continue;

      // Access pool's quotas - this contains rates for each collateral token
      const pool = poolSuite.pool as unknown as {
        quotas?: Array<{
          token: string;
          rate: number; // Already in percentage (e.g., 0.01 for 0.01%)
          isActive: boolean;
        }>;
      };

      if (pool.quotas) {
        const ethPlusQuota = pool.quotas.find(
          (q) => q.token?.toLowerCase() === ETH_PLUS_ADDRESS.toLowerCase() && q.isActive
        );
        if (ethPlusQuota) {
          console.log(`📊 ETH+ quota rate from SDK: ${ethPlusQuota.rate}%`);
          return ethPlusQuota.rate;
        }
      }
    }

    console.warn('ETH+ quota not found in pool, using default 0.01%');
    return 0.01; // Default from Gearbox app
  } catch (error) {
    console.error('Failed to fetch ETH+ quota rate:', error);
    return 0.01;
  }
}

/**
 * Get all WETH pools from the SDK
 */
export async function getWETHPools(): Promise<PoolData[]> {
  const sdk = await getGearboxSDK();
  const pools: PoolData[] = [];

  for (const market of sdk.marketRegister.markets) {
    const poolSuite = market.pool;
    if (!poolSuite) continue;

    // Access pool contract - properties are directly on the contract
    const pool = poolSuite.pool as unknown as {
      address: Address;
      expectedLiquidity?: bigint;
      totalBorrowed?: bigint;
      availableLiquidity?: bigint;
      supplyRate?: bigint;
      baseInterestRate?: bigint;
    };

    // Check if this is a WETH pool
    const underlying = poolSuite.underlying.toLowerCase();
    if (underlying !== WETH_ADDRESS.toLowerCase()) continue;

    const tokenMeta = sdk.tokensMeta.get(underlying);
    const symbol = tokenMeta?.symbol || 'WETH';

    pools.push({
      address: pool.address,
      name: `${symbol} Pool`,
      underlying: poolSuite.underlying as Address,
      underlyingSymbol: symbol,
      totalSupplied: pool.expectedLiquidity || 0n,
      totalBorrowed: pool.totalBorrowed || 0n,
      availableLiquidity: pool.availableLiquidity || 0n,
      supplyRate: pool.supplyRate || 0n,
      borrowRate: pool.baseInterestRate || 0n,
      supplyAPY: rayToAPY(pool.supplyRate || 0n),
      borrowAPY: rayToAPY(pool.baseInterestRate || 0n),
    });
  }

  return pools;
}

/**
 * Get credit managers that support ETH+ token
 */
export async function getETHPlusCreditManagers(): Promise<CreditManagerData[]> {
  const sdk = await getGearboxSDK();
  const managers: CreditManagerData[] = [];

  for (const market of sdk.marketRegister.markets) {
    // Skip markets without credit managers
    if (!market.creditManagers || market.creditManagers.length === 0) continue;

    for (const suite of market.creditManagers) {
      const cm = suite.creditManager;
      const facade = suite.creditFacade;

      if (!cm || !facade) continue;

      // Cast to access properties - the SDK exposes data directly on contracts
      const cmTyped = cm as unknown as {
        address: Address;
        collateralTokens?: Array<{ token: string }>;
      };

      const facadeTyped = facade as unknown as {
        address: Address;
        minDebt?: bigint;
        maxDebt?: bigint;
      };

      // Check if this credit manager supports ETH+ token
      const collateralTokens = cmTyped.collateralTokens || [];
      const supportsETHPlus = collateralTokens.some(
        (t) => t?.token?.toLowerCase() === ETH_PLUS_ADDRESS.toLowerCase()
      );

      // Get underlying token info
      const underlying = suite.underlying as Address;
      const tokenMeta = sdk.tokensMeta.get(underlying.toLowerCase());

      // For ETH+ (LST-backed), typical liquidation threshold is ~90%
      // Max theoretical leverage = 1 / (1 - LT)
      // For LT = 90%: maxLev = 1 / 0.10 = 10x
      // For LT = 85%: maxLev = 1 / 0.15 = 6.67x
      // We'll use a reasonable default that will be further capped by HF requirements
      const maxLeverageFromLT = supportsETHPlus ? 10 : 6; // Higher for ETH+ positions

      managers.push({
        address: cmTyped.address,
        name: suite.name || 'Credit Manager',
        underlying,
        underlyingSymbol: tokenMeta?.symbol || 'UNKNOWN',
        pool: suite.pool as Address,
        creditFacade: facadeTyped.address,
        minDebt: facadeTyped.minDebt || 0n,
        maxDebt: facadeTyped.maxDebt || 0n,
        maxLeverage: maxLeverageFromLT,
        supportedTokens: collateralTokens.filter((t) => t?.token).map((t) => t.token as Address),
        supportsETHPlus,
      });
    }
  }

  return managers;
}

/**
 * Get the ETH+ leverage strategy data
 * This finds the WETH credit manager that supports ETH+ and calculates net APY
 */
export async function getETHPlusStrategy(): Promise<StrategyData | null> {
  // Find WETH credit managers that support ETH+
  const managers = await getETHPlusCreditManagers();
  const ethPlusManager = managers.find(
    m => m.underlyingSymbol === 'WETH' && m.supportsETHPlus
  );

  if (!ethPlusManager) {
    console.warn('No WETH credit manager with ETH+ support found');
    return null;
  }

  // Get pool data
  const pools = await getWETHPools();
  const pool = pools.find(p => p.address.toLowerCase() === ethPlusManager.pool.toLowerCase());

  if (!pool) {
    console.warn('Pool not found for credit manager');
    return null;
  }

  // Get quota rate for ETH+ from the pool
  const quotaRate = await getETHPlusQuotaRate();

  // Fetch real ETH+ APY from DefiLlama
  // Note: Gearbox app may show higher APY (5-6%) vs DefiLlama (~3.5%)
  // This could be due to different yield sources or calculation methods
  const ethPlusAPY = await getETHPlusAPY();

  // Log SDK data for debugging
  console.log('📊 Strategy data from SDK:', {
    borrowAPY: pool.borrowAPY.toFixed(2) + '%',
    quotaRate: quotaRate.toFixed(2) + '%',
    ethPlusAPY: ethPlusAPY.toFixed(2) + '%',
  });

  // LTV for ETH+ collateral (93% liquidation threshold for ETH+ in Gearbox)
  // Derived from Gearbox app: HF 1.161 = (10 * LT) / 8 → LT = 0.93
  const ltv = 0.93;

  // Calculate max leverage from SDK
  const maxLeverage = ethPlusManager.maxLeverage * 100; // Convert to percentage (4 -> 400)

  // Calculate max leverage that keeps HF >= 1.10
  const maxLeverageForSafeHF = calculateMaxLeverageForHF(1.10, ltv, maxLeverage);

  // Calculate net APY for max safe leverage
  const netAPY = calculateNetAPY(ethPlusAPY, pool.borrowAPY, maxLeverageForSafeHF, quotaRate);

  return {
    creditManager: ethPlusManager,
    pool,
    ethPlusAPY,
    quotaRate,
    netAPY,
    maxLeverage,
    ltv,
    maxLeverageForSafeHF,
  };
}

/**
 * Calculate net APY for leveraged position (Gearbox formula)
 *
 * Simplified formula matching Gearbox app:
 * Net APY = (baseAPY × leverage) - (borrowRate × (leverage - 1)) - (quotaRate × leverage)
 *
 * This calculates the APY on your deposited amount (not total position).
 *
 * Example from Gearbox app (2 ETH deposit, 5x leverage):
 * - Total position: 10 ETH+
 * - Debt: 8 WETH
 * - If ETH+ APY = 5.7%, Borrow = 3.21%, Quota = 0.01%:
 * - Net APY = (5.7 × 5) - (3.21 × 4) - (0.01 × 5) = 28.5 - 12.84 - 0.05 = 15.61%
 *
 * @param baseAPY Base yield of collateral (ETH+ APY as percentage, e.g., 3.5)
 * @param borrowRate WETH borrow rate (as percentage, e.g., 3.21)
 * @param leverage Leverage as percentage (100 = 1x, 500 = 5x)
 * @param quotaRate Quota rate for ETH+ (as percentage, default 0.01%)
 */
export function calculateNetAPY(
  baseAPY: number,
  borrowRate: number,
  leverage: number, // 100 = 1x, 500 = 5x
  quotaRate: number = 0.01 // 0.01% quota rate for ETH+ (from Gearbox app)
): number {
  const leverageMultiplier = leverage / 100;

  // Net APY = (yield × leverage) - (borrow cost × borrowed portion) - (quota × leveraged amount)
  const grossYield = baseAPY * leverageMultiplier;
  const borrowCost = borrowRate * (leverageMultiplier - 1);
  const quotaCost = quotaRate * leverageMultiplier;

  return grossYield - borrowCost - quotaCost;
}

/**
 * Calculate health factor for a position
 * HF = (Collateral Value * LT) / Debt Value
 *
 * For ETH+ in Gearbox, LT (Liquidation Threshold) is ~93%
 * Example: 10 ETH+ collateral, 8 ETH debt → HF = (10 × 0.93) / 8 = 1.1625
 */
export function calculateHealthFactor(
  collateralValue: number,
  debtValue: number,
  ltv: number = 0.93 // 93% for ETH+ (from Gearbox app)
): number {
  if (debtValue === 0) return 10; // No debt = very safe
  return (collateralValue * ltv) / debtValue;
}

/**
 * Calculate liquidation buffer for ETH+/ETH price
 *
 * For a leveraged ETH+ position with WETH debt:
 * - Liquidation occurs when HF drops to 1
 * - HF = (ETH+ value × LT) / WETH debt
 * - If ETH+ depegs from ETH, HF drops
 *
 * The price can drop by factor of: currentHF
 * Buffer = (HF - 1) / HF = 1 - (1/HF)
 *
 * Example: HF = 1.13 → Buffer = 11.5% (ETH+ can drop 11.5% vs ETH before liquidation)
 *
 * @param healthFactor Current health factor
 * @returns Percentage buffer before liquidation (e.g., 11.5 for 11.5%)
 */
export function calculateLiquidationDrop(
  healthFactor: number,
): number {
  if (healthFactor <= 1) return 0;
  // Buffer = (HF - 1) / HF × 100
  return ((healthFactor - 1) / healthFactor) * 100;
}

/**
 * Calculate maximum leverage to maintain target health factor
 *
 * Derivation:
 * HF = (leverage × LT) / (leverage - 1)
 * Solving for leverage: leverage = targetHF / (targetHF - LT)
 *
 * For ETH+ with LT = 0.93:
 * - targetHF = 1.10 → maxLeverage = 1.10 / (1.10 - 0.93) = 6.47x
 * - targetHF = 1.15 → maxLeverage = 1.15 / (1.15 - 0.93) = 5.23x
 *
 * @param targetHF Minimum health factor to maintain (e.g., 1.10)
 * @param ltv Liquidation threshold (e.g., 0.93 for ETH+)
 * @param sdkMaxLeverage Max leverage from SDK credit manager (e.g., 1000 for 10x)
 * @returns Max leverage as percentage (100 = 1x, 500 = 5x)
 */
export function calculateMaxLeverageForHF(
  targetHF: number = 1.10,
  ltv: number = 0.93, // 93% for ETH+ (from Gearbox app)
  sdkMaxLeverage: number = 1000
): number {
  // Formula: maxLeverage = targetHF / (targetHF - LT)
  // This gives leverage multiplier (e.g., 8.75 for HF=1.05, LT=0.93)
  const maxLeverageMultiplier = targetHF / (targetHF - ltv);
  const maxLeveragePercent = Math.floor(maxLeverageMultiplier * 100);

  // Return the lower of calculated max and SDK max
  return Math.min(maxLeveragePercent, sdkMaxLeverage);
}

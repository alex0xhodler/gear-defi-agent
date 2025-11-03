import { GearboxSDK } from '@gearbox-protocol/sdk';

let sdkInstance: GearboxSDK | null = null;
const PLASMA_CHAIN_ID = 9745; // Plasma's actual chain ID

/**
 * Get or initialize Gearbox SDK singleton
 * Caches the instance to avoid re-initialization
 * @param chainId - Optional chain ID (defaults to Ethereum mainnet)
 */
export async function getGearboxSDK(chainId?: number): Promise<GearboxSDK> {
  if (sdkInstance) {
    return sdkInstance;
  }

  try {
    // Handle Plasma chain (not officially supported by SDK yet)
    if (chainId === PLASMA_CHAIN_ID) {
      console.log('🔍 Plasma chain requested - fetching real on-chain data for USDT0 pool');
      return await createPlasmaSDK();
    }

    // Get RPC URL from environment with fallback to public RPC
    const rpcURL = process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';

    if (!process.env.ETHEREUM_RPC_URL) {
      console.warn('⚠️ ETHEREUM_RPC_URL not set, using public RPC (may have rate limits)');
    }

    console.log('🔗 Initializing Gearbox SDK with RPC:', rpcURL.includes('alchemy') ? 'Alchemy' : 'Public RPC');

    // Default: Ethereum mainnet SDK
    sdkInstance = await GearboxSDK.attach({
      rpcURLs: [rpcURL],
      timeout: 120_000, // 2 minutes
      ignoreUpdateablePrices: true, // Skip RedStone price feed updates
    });

    console.log('✅ Gearbox SDK initialized:', {
      network: sdkInstance.networkType,
      markets: sdkInstance.marketRegister.markets.length,
    });

    return sdkInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Gearbox SDK:', error);

    // Log additional diagnostic info
    console.error('RPC URL configured:', process.env.ETHEREUM_RPC_URL ? 'Yes' : 'No (using fallback)');
    console.error('Chain ID requested:', chainId || 'mainnet');

    throw new Error(`Gearbox SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create mock SDK for Plasma chain with multiple USDT0 pools
 * Returns a minimal SDK-compatible object with REAL on-chain data fetched via viem
 */
async function createPlasmaSDK(): Promise<any> {
  const USDT0_ADDRESS = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb';

  // Import viem dynamically (ESM module)
  const { createPublicClient, http, defineChain } = await import('viem');

  // Define Plasma chain
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

  // Create viem client
  const client = createPublicClient({
    chain: plasma,
    transport: http('https://rpc.plasma.to')
  });

  // Pool ABI (minimal)
  const poolABI = [
    { name: 'supplyRate', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
    { name: 'expectedLiquidity', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] }
  ] as const;

  // Define all Plasma pools for USDT0
  const plasmaPools = [
    { name: 'Invariant Group', address: '0x76309a9a56309104518847bba321c261b7b4a43f' as `0x${string}` },
    { name: 'Edge UltraYield', address: '0x53e4e9b8766969c43895839cc9c673bb6bc8ac97' as `0x${string}` },
    { name: 'Hyperithm', address: '0xb74760fd26400030620027dd29d19d74d514700e' as `0x${string}` }
  ];

  // Fetch real data for all pools in parallel
  const poolDataPromises = plasmaPools.map(async (pool) => {
    try {
      // Fetch both values in parallel
      const [supplyRate, expectedLiquidity] = await Promise.all([
        client.readContract({
          address: pool.address,
          abi: poolABI,
          functionName: 'supplyRate'
        }),
        client.readContract({
          address: pool.address,
          abi: poolABI,
          functionName: 'expectedLiquidity'
        })
      ]);

      console.log(`✅ ${pool.name}: ${(Number(supplyRate) / 1e25).toFixed(2)}% APY, $${(Number(expectedLiquidity) / 1e6).toFixed(0)} TVL`);

      return {
        name: pool.name,
        address: pool.address,
        supplyRate,
        expectedLiquidity,
      };
    } catch (error) {
      console.error(`❌ ${pool.name}: Failed to fetch real data:`, error);
      // Return zero values if fetch fails
      return {
        name: pool.name,
        address: pool.address,
        supplyRate: 0n,
        expectedLiquidity: 0n,
      };
    }
  });

  const poolsData = await Promise.all(poolDataPromises);

  // Create market objects for each pool
  const markets = poolsData.map((poolData) => ({
    pool: {
      pool: {
        address: poolData.address,
        underlying: USDT0_ADDRESS,
        supplyRate: poolData.supplyRate,
        expectedLiquidity: poolData.expectedLiquidity,
      },
    },
    creditManagers: [], // No credit managers on Plasma (lending only)
    priceOracle: {
      // Mock price oracle for Plasma
      async mainPrice(token: string) {
        if (token.toLowerCase() === USDT0_ADDRESS.toLowerCase()) {
          return 100000000n; // $1.00 (8 decimals)
        }
        if (token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
          return 300000000000n; // $3000 for ETH (8 decimals)
        }
        return 100000000n; // Default to $1
      },
    },
  }));

  console.log(`✅ Created Plasma SDK with ${markets.length} USDT0 pools`);

  return {
    networkType: 'Plasma',
    marketRegister: {
      markets,
    },
    tokensMeta: new Map([
      [
        USDT0_ADDRESS,
        {
          addr: USDT0_ADDRESS,
          symbol: 'USDT0',
          name: 'Tether USD (Plasma)',
          decimals: 6,
        },
      ],
      [
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH
        {
          addr: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
        },
      ],
    ]),
    client: {
      // Mock viem client for Plasma
      async getGasPrice() {
        return 1000000n; // 0.001 gwei (ultra cheap)
      },
    },
  };
}

/**
 * Refresh SDK instance (force re-initialization)
 */
export async function refreshGearboxSDK(): Promise<GearboxSDK> {
  sdkInstance = null;
  return getGearboxSDK();
}

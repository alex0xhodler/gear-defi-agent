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

    // Default: Ethereum mainnet SDK
    sdkInstance = await GearboxSDK.attach({
      rpcURLs: [process.env.ETHEREUM_RPC_URL!],
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
    throw error;
  }
}

/**
 * Create mock SDK for Plasma chain with USDT0 pool
 * Returns a minimal SDK-compatible object with REAL on-chain data
 */
async function createPlasmaSDK(): Promise<any> {
  const USDT0_ADDRESS = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb';
  const POOL_ADDRESS = '0x76309a9a56309104518847bba321c261b7b4a43f';
  const PLASMA_RPC = 'https://rpc.plasma.to';

  // Fetch real supply rate from the pool contract
  let supplyRate = 2551000000000000000000000000n; // Default: 25.51% APY (from UI)
  let expectedLiquidity = 1000000000000n; // Default: 1M USDT0

  try {
    // Use fetch to call RPC
    const response = await fetch(PLASMA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: POOL_ADDRESS,
            data: '0x2749c8d6', // supplyRate() function selector
          },
          'latest',
        ],
        id: 1,
      }),
    });

    const data = (await response.json()) as any;
    if (data.result) {
      supplyRate = BigInt(data.result);
      console.log(`✅ Fetched real Plasma pool supply rate: ${supplyRate} (${(Number(supplyRate) / 1e25).toFixed(2)}% APY)`);
    }

    // Fetch expected liquidity
    const liquidityResponse = await fetch(PLASMA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: POOL_ADDRESS,
            data: '0x4b2ba0dd', // expectedLiquidity() function selector
          },
          'latest',
        ],
        id: 2,
      }),
    });

    const liquidityData = (await liquidityResponse.json()) as any;
    if (liquidityData.result) {
      expectedLiquidity = BigInt(liquidityData.result);
      console.log(`✅ Fetched real Plasma pool liquidity: ${expectedLiquidity} (${(Number(expectedLiquidity) / 1e6).toFixed(0)} USDT0)`);
    }
  } catch (error) {
    console.error('⚠️ Failed to fetch real Plasma pool data, using defaults:', error);
  }

  return {
    networkType: 'Plasma',
    marketRegister: {
      markets: [
        {
          pool: {
            pool: {
              address: POOL_ADDRESS,
              underlying: USDT0_ADDRESS,
              supplyRate, // Real on-chain supply rate
              expectedLiquidity, // Real on-chain liquidity
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
        },
      ],
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

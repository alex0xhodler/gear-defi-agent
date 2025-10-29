import { GearboxSDK } from '@gearbox-protocol/sdk';

let sdkInstance: GearboxSDK | null = null;

/**
 * Get or initialize Gearbox SDK singleton
 * Caches the instance to avoid re-initialization
 */
export async function getGearboxSDK(): Promise<GearboxSDK> {
  if (sdkInstance) {
    return sdkInstance;
  }

  try {
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
 * Refresh SDK instance (force re-initialization)
 */
export async function refreshGearboxSDK(): Promise<GearboxSDK> {
  sdkInstance = null;
  return getGearboxSDK();
}

/**
 * Inspect what data is available in SDK pool objects
 */

const { GearboxSDK } = require('@gearbox-protocol/sdk');

async function inspectPoolData() {
  console.log('🔍 Inspecting Gearbox SDK pool data structure...\n');

  const sdk = await GearboxSDK.attach({
    rpcURLs: [process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'],
    timeout: 300_000,
    ignoreUpdateablePrices: true,
  });

  console.log(`✅ SDK initialized: ${sdk.marketRegister.markets.length} markets\n`);

  // Get first market for inspection
  const market = sdk.marketRegister.markets[0];

  if (!market || !market.pool?.pool) {
    console.log('❌ No market data available');
    return;
  }

  const poolData = market.pool.pool;

  console.log('📊 Pool Data Fields:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(poolData, null, 2));

  console.log('\n\n📋 Available Pool Fields:');
  console.log('='.repeat(60));
  for (const key of Object.keys(poolData)) {
    console.log(`  - ${key}: ${typeof poolData[key]}`);
  }
}

inspectPoolData().catch(console.error);

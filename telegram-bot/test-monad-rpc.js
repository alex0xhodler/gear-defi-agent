/**
 * Test Monad RPC endpoints (public vs dedicated)
 */

const { createPublicClient, http } = require('viem');

const monadChain = {
  id: 143,
  name: 'Monad',
  network: 'monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [''] }
  }
};

async function testRPC(rpcUrl, name) {
  console.log(`\n🔗 Testing ${name}`);
  console.log(`   URL: ${rpcUrl}`);
  
  try {
    const client = createPublicClient({
      chain: { ...monadChain, rpcUrls: { default: { http: [rpcUrl] } } },
      transport: http(rpcUrl, { timeout: 10000 })
    });
    
    const start = Date.now();
    const blockNumber = await client.getBlockNumber();
    const latency = Date.now() - start;
    
    console.log(`   ✅ Connection successful`);
    console.log(`      Block: ${blockNumber}`);
    console.log(`      Latency: ${latency}ms`);
    
    return { success: true, latency, blockNumber };
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Monad RPC Endpoint Comparison\n');
  
  // Test dedicated Alchemy RPC
  await testRPC(
    'https://monad-mainnet.g.alchemy.com/v2/LCSenl8SNLcL-z2fyQFhm',
    'Dedicated Alchemy RPC'
  );
  
  // Test public RPC
  await testRPC(
    'https://rpc.monad.xyz',
    'Public Monad RPC'
  );
  
  console.log('\n✅ RPC endpoint tests completed!');
}

runTests().catch(console.error);

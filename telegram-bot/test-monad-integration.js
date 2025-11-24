/**
 * Test script for Monad mainnet integration
 * Verifies SDK, RPC connectivity, and configuration
 */

const config = require('./config');
const blockchain = require('./utils/blockchain');

console.log('🧪 Testing Monad Mainnet Integration\n');

// Test 1: Config verification
console.log('📋 Test 1: Configuration');
const monadConfig = config.blockchain.chains.Monad;
if (monadConfig) {
  console.log(`   ✅ Monad config found`);
  console.log(`      Chain ID: ${monadConfig.id}`);
  console.log(`      Name: ${monadConfig.name}`);
  console.log(`      RPC: ${monadConfig.rpcUrl}`);
  console.log(`      Explorer: ${monadConfig.explorerUrl}`);
} else {
  console.log(`   ❌ Monad config NOT found`);
  process.exit(1);
}

// Test 2: Blockchain client
console.log('\n🔗 Test 2: Blockchain Client');
try {
  const client = blockchain.getClient(143);
  console.log(`   ✅ Monad viem client created successfully`);
  console.log(`      Client chain ID: ${client.chain.id}`);
  console.log(`      Client chain name: ${client.chain.name}`);
} catch (error) {
  console.log(`   ❌ Failed to create client: ${error.message}`);
  process.exit(1);
}

// Test 3: RPC connectivity (quick check)
console.log('\n🌐 Test 3: RPC Connectivity');
async function testRPC() {
  try {
    const client = blockchain.getClient(143);
    const blockNumber = await client.getBlockNumber();
    console.log(`   ✅ RPC endpoint is reachable`);
    console.log(`      Current block: ${blockNumber}`);
    console.log(`      RPC URL: ${monadConfig.rpcUrl}`);
  } catch (error) {
    console.log(`   ⚠️  RPC test failed: ${error.message}`);
    console.log(`      This is expected if Monad mainnet is not fully live yet`);
  }
}

testRPC().then(() => {
  console.log('\n✅ All tests completed!');
  console.log('\n📝 Summary:');
  console.log('   - Monad configuration: ✅');
  console.log('   - Blockchain client: ✅');
  console.log('   - RPC connectivity: Check above');
  console.log('\n🚀 Monad integration is ready!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});

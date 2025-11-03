/**
 * Test script for pool discovery
 * Run: node test-pool-discovery.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const poolFetcher = require('./utils/pool-fetcher');

async function testPoolDiscovery() {
  console.log('🧪 Testing Pool Discovery with Gearbox SDK\n');
  console.log('='.repeat(60));

  try {
    // Test with lower TVL threshold for testing
    const minTVL = 100_000; // $100K minimum for testing

    const result = await poolFetcher.fetchAllPools(minTVL);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Pools Found: ${result.pools.length}`);
    console.log(`Chains Scanned: ${result.chainCount}`);
    console.log();

    // Group by chain
    const poolsByChain = {};
    result.pools.forEach(pool => {
      if (!poolsByChain[pool.chainName]) {
        poolsByChain[pool.chainName] = [];
      }
      poolsByChain[pool.chainName].push(pool);
    });

    console.log('Pools by Chain:');
    for (const [chainName, pools] of Object.entries(poolsByChain)) {
      console.log(`  ${chainName}: ${pools.length} pools`);
    }

    console.log();
    console.log('Top Pools by APY:');
    const topPools = result.pools
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 10);

    topPools.forEach((pool, idx) => {
      console.log(`  ${idx + 1}. ${pool.name} (${pool.chainName})`);
      console.log(`     APY: ${pool.apy.toFixed(2)}% | TVL: $${pool.tvl.toFixed(2)}`);
      console.log(`     Asset: ${pool.underlyingToken} | Address: ${pool.address}`);
      console.log();
    });

    console.log('✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testPoolDiscovery();

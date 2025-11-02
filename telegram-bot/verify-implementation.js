/**
 * Verification Script for Pool Discovery Implementation
 * Checks that all components are properly integrated
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const database = require('./database');
const poolFetcher = require('./utils/pool-fetcher');
const config = require('./config');

async function verify() {
  console.log('\n🔍 Verifying Pool Discovery Implementation\n');
  console.log('='.repeat(60));

  let allChecks = [];

  // Check 1: Database tables exist
  console.log('\n✅ Check 1: Database Tables');
  try {
    const pools = await database.getCachedPools(false);
    console.log(`   ✓ pool_cache table exists (${pools.length} pools)`);
    allChecks.push(true);
  } catch (error) {
    console.log(`   ✗ pool_cache table missing: ${error.message}`);
    allChecks.push(false);
  }

  // Check 2: Pool fetcher works
  console.log('\n✅ Check 2: Pool Fetcher (SDK)');
  try {
    const result = await poolFetcher.fetchAllPools(100_000); // Low threshold for testing
    console.log(`   ✓ Pool fetcher works (found ${result.pools.length} pools)`);
    console.log(`   ✓ Scanned ${result.chainCount} chains`);
    allChecks.push(true);
  } catch (error) {
    console.log(`   ✗ Pool fetcher failed: ${error.message}`);
    allChecks.push(false);
  }

  // Check 3: Database methods work
  console.log('\n✅ Check 3: Database Methods');
  try {
    // Test adding a pool to cache
    const testPool = {
      pool_address: '0xtest123',
      chain_id: 1,
      pool_name: 'Test Pool',
      pool_symbol: 'TEST',
      underlying_token: 'USDC',
      tvl: 1000000,
      apy: 5.5,
    };

    const result = await database.addOrUpdatePoolCache(testPool);
    console.log(`   ✓ addOrUpdatePoolCache works (isNew: ${result.isNew})`);

    // Test getting cached pools
    const cached = await database.getCachedPools(true);
    console.log(`   ✓ getCachedPools works (${cached.length} active pools)`);

    // Test new pool detection
    const newPools = await database.getNewPools(24);
    console.log(`   ✓ getNewPools works (${newPools.length} new in last 24h)`);

    allChecks.push(true);
  } catch (error) {
    console.log(`   ✗ Database methods failed: ${error.message}`);
    allChecks.push(false);
  }

  // Check 4: Configuration
  console.log('\n✅ Check 4: Configuration');
  try {
    console.log(`   ✓ Pool discovery enabled: ${config.features.poolDiscoveryMonitoring}`);
    console.log(`   ✓ Min TVL: $${config.poolDiscovery.minTVL.toLocaleString()}`);
    console.log(`   ✓ Scan interval: ${config.monitoring.poolRefreshInterval / 1000 / 60} minutes`);
    console.log(`   ✓ Chains configured: ${Object.keys(config.blockchain.chains).length}`);
    allChecks.push(true);
  } catch (error) {
    console.log(`   ✗ Configuration invalid: ${error.message}`);
    allChecks.push(false);
  }

  // Check 5: Chain configs
  console.log('\n✅ Check 5: Chain Configurations');
  try {
    const chains = ['Mainnet', 'Arbitrum', 'Optimism', 'Sonic', 'Plasma'];
    for (const chain of chains) {
      const chainConfig = config.blockchain.chains[chain];
      if (chainConfig) {
        console.log(`   ✓ ${chain} configured (chainId: ${chainConfig.id})`);
      } else {
        console.log(`   ✗ ${chain} missing configuration`);
        allChecks.push(false);
      }
    }
    allChecks.push(true);
  } catch (error) {
    console.log(`   ✗ Chain configuration check failed: ${error.message}`);
    allChecks.push(false);
  }

  // Check 6: Monitor integration
  console.log('\n✅ Check 6: Monitor Integration');
  try {
    const { getMonitorStats } = require('./pool-discovery-monitor');
    const stats = getMonitorStats();
    console.log(`   ✓ Pool discovery monitor module loaded`);
    console.log(`   ✓ Monitor interval: ${stats.interval / 1000 / 60} minutes`);
    allChecks.push(true);
  } catch (error) {
    console.log(`   ✗ Monitor integration failed: ${error.message}`);
    allChecks.push(false);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  const passed = allChecks.filter(Boolean).length;
  const total = allChecks.length;
  const percentage = ((passed / total) * 100).toFixed(0);

  console.log(`\nChecks Passed: ${passed}/${total} (${percentage}%)`);

  if (passed === total) {
    console.log('\n✅ All checks passed! Implementation is ready.');
    console.log('\nNext steps:');
    console.log('1. Start the bot: node index.js');
    console.log('2. Monitor logs for pool discoveries');
    console.log('3. Create test mandates and verify notifications\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some checks failed. Review errors above.\n');
    process.exit(1);
  }
}

// Run verification
verify().catch(error => {
  console.error('\n❌ Verification failed:', error);
  process.exit(1);
});

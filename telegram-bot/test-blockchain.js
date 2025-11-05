#!/usr/bin/env node
/**
 * Test script for blockchain.js multi-chain support
 */

const blockchain = require('./utils/blockchain.js');

console.log('🧪 Testing blockchain.js multi-chain support...\n');

const chains = [
  { id: 1, name: 'Ethereum' },
  { id: 42161, name: 'Arbitrum' },
  { id: 10, name: 'Optimism' },
  { id: 146, name: 'Sonic' },
  { id: 9745, name: 'Plasma' }
];

let passed = 0;
let failed = 0;

chains.forEach(chain => {
  try {
    const client = blockchain.getClient(chain.id);
    if (client) {
      console.log(`✅ ${chain.name} (${chain.id}): Client initialized successfully`);
      passed++;
    }
  } catch (error) {
    console.log(`❌ ${chain.name} (${chain.id}): ${error.message}`);
    failed++;
  }
});

// Test unsupported chain
try {
  blockchain.getClient(999);
  console.log('❌ Unsupported chain test: Should have thrown error');
  failed++;
} catch (error) {
  if (error.message.includes('Unsupported chain ID')) {
    console.log('✅ Unsupported chain test: Correctly rejected invalid chain ID');
    passed++;
  } else {
    console.log(`❌ Unsupported chain test: Wrong error - ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed\n');
  process.exit(1);
}

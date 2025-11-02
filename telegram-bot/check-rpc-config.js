#!/usr/bin/env node
/**
 * Diagnostic script to check RPC configuration
 * Run this on production server to verify Ethereum RPC setup
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const config = require('./config');

console.log('🔍 Checking RPC Configuration\n');
console.log('='.repeat(60));

// Check Ethereum RPC
const ethRpcUrl = process.env.ETHEREUM_RPC_URL || config.blockchain.chains.Mainnet.rpcUrl;
console.log('\n📡 Ethereum Mainnet RPC:');
console.log(`   URL: ${ethRpcUrl}`);

// Detect RPC provider type
if (ethRpcUrl.includes('alchemy.com')) {
  console.log('   Provider: ✅ Alchemy (GOOD - supports complex queries)');
} else if (ethRpcUrl.includes('infura.io')) {
  console.log('   Provider: ⚠️  Infura (May have gas limit issues)');
} else if (ethRpcUrl.includes('llamarpc') || ethRpcUrl.includes('rpc.eth') || ethRpcUrl.includes('cloudflare')) {
  console.log('   Provider: ❌ Public RPC (Will fail with gas limit errors)');
} else {
  console.log('   Provider: ⚠️  Unknown (Check if it supports high gas limits)');
}

// Check other chains
console.log('\n📡 Other Chains:');
const chains = ['Arbitrum', 'Optimism', 'Sonic', 'Plasma'];
for (const chain of chains) {
  const chainConfig = config.blockchain.chains[chain];
  if (chainConfig) {
    console.log(`   ${chain}: ${chainConfig.rpcUrl}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 Recommendations:');

if (!ethRpcUrl.includes('alchemy.com')) {
  console.log('   ❌ ISSUE: Ethereum RPC is not using Alchemy');
  console.log('   🔧 FIX: Add to .env file:');
  console.log('   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY');
  console.log('');
  console.log('   Get free Alchemy API key: https://www.alchemy.com/');
  console.log('   Alchemy free tier: 300M compute units/month (sufficient)');
} else {
  console.log('   ✅ Ethereum RPC configuration looks good!');
  console.log('   ℹ️  If SDK still fails, check Alchemy API key is valid');
}

console.log('\n');

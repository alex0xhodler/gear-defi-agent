#!/usr/bin/env node
/**
 * Debug script to check environment variable loading
 */

console.log('\n🔍 Environment Variable Debug\n');
console.log('='.repeat(60));

// Test 1: Load .env from root
console.log('\n1️⃣  Loading .env from root directory:');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log(`   ETHEREUM_RPC_URL: ${process.env.ETHEREUM_RPC_URL ? '✅ SET' : '❌ MISSING'}`);
if (process.env.ETHEREUM_RPC_URL) {
  const url = process.env.ETHEREUM_RPC_URL;
  console.log(`   Value: ${url.substring(0, 50)}...`);

  if (url.includes('alchemy.com')) {
    console.log(`   Provider: ✅ Alchemy`);
  } else if (url.includes('llamarpc')) {
    console.log(`   Provider: ❌ Public RPC (will fail)`);
  }
}

// Test 2: Check if root .env file exists
const fs = require('fs');
const path = require('path');
const rootEnvPath = path.join(__dirname, '../.env');

console.log(`\n2️⃣  Checking .env file location:`);
console.log(`   Expected path: ${rootEnvPath}`);
console.log(`   File exists: ${fs.existsSync(rootEnvPath) ? '✅ YES' : '❌ NO'}`);

if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf8');
  const hasEthRpc = envContent.includes('ETHEREUM_RPC_URL');
  console.log(`   Contains ETHEREUM_RPC_URL: ${hasEthRpc ? '✅ YES' : '❌ NO'}`);

  if (hasEthRpc) {
    const lines = envContent.split('\n');
    const ethLine = lines.find(l => l.startsWith('ETHEREUM_RPC_URL'));
    if (ethLine) {
      console.log(`   Line: ${ethLine.substring(0, 70)}...`);
    }
  }
}

// Test 3: Check config.js
console.log(`\n3️⃣  Checking config.js:`);
const config = require('./config');
console.log(`   Mainnet RPC URL: ${config.blockchain.chains.Mainnet.rpcUrl.substring(0, 50)}...`);

if (config.blockchain.chains.Mainnet.rpcUrl.includes('alchemy.com')) {
  console.log(`   Status: ✅ Using Alchemy`);
} else {
  console.log(`   Status: ❌ Using fallback (${config.blockchain.chains.Mainnet.rpcUrl.includes('llamarpc') ? 'llamarpc' : 'other'})`);
}

// Test 4: Check current working directory
console.log(`\n4️⃣  Current working directory:`);
console.log(`   CWD: ${process.cwd()}`);
console.log(`   __dirname: ${__dirname}`);
console.log(`   Resolved .env path: ${path.resolve(rootEnvPath)}`);

console.log('\n' + '='.repeat(60));
console.log('\n💡 Next Steps:\n');

if (!process.env.ETHEREUM_RPC_URL) {
  console.log('   ❌ ETHEREUM_RPC_URL not loaded!');
  console.log('   🔧 Solution:');
  console.log('   1. Verify .env file exists in root directory');
  console.log('   2. Check ETHEREUM_RPC_URL is set in .env');
  console.log('   3. Restart PM2 processes');
} else if (!process.env.ETHEREUM_RPC_URL.includes('alchemy.com')) {
  console.log('   ⚠️  ETHEREUM_RPC_URL is set but not using Alchemy');
  console.log('   🔧 Update .env file with Alchemy URL');
} else {
  console.log('   ✅ Everything looks good!');
}

console.log('\n');

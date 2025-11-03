#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 * Run before starting the bot to ensure all required vars are set
 * Usage: node validate-env.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const REQUIRED_VARS = [
  'TELEGRAM_BOT_TOKEN',
];

const RECOMMENDED_VARS = [
  'ETHEREUM_RPC_URL',
];

const OPTIONAL_VARS = [
  'GEMINI_API_KEY',
  'ARBITRUM_RPC_URL',
  'OPTIMISM_RPC_URL',
  'SONIC_RPC_URL',
  'PLASMA_RPC_URL',
];

console.log('\n🔍 Validating Environment Variables\n');
console.log('='.repeat(60));

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('\n✅ REQUIRED Variables:');
for (const varName of REQUIRED_VARS) {
  if (!process.env[varName]) {
    console.log(`   ❌ ${varName}: MISSING`);
    hasErrors = true;
  } else {
    const value = process.env[varName];
    const displayValue = value.length > 20 ? value.substring(0, 15) + '...' : value;
    console.log(`   ✅ ${varName}: SET (${displayValue})`);
  }
}

// Check recommended variables
console.log('\n⚠️  RECOMMENDED Variables:');
for (const varName of RECOMMENDED_VARS) {
  if (!process.env[varName]) {
    console.log(`   ⚠️  ${varName}: MISSING`);
    console.log(`      Impact: Reduced functionality or fallback to public RPCs`);
    hasWarnings = true;
  } else {
    const value = process.env[varName];
    const displayValue = value.length > 40 ? value.substring(0, 35) + '...' : value;
    console.log(`   ✅ ${varName}: SET (${displayValue})`);

    // Check if using recommended provider
    if (varName === 'ETHEREUM_RPC_URL') {
      if (value.includes('alchemy.com')) {
        console.log(`      Provider: ✅ Alchemy (recommended)`);
      } else if (value.includes('infura.io')) {
        console.log(`      Provider: ✅ Infura (good)`);
      } else if (value.includes('llamarpc') || value.includes('cloudflare')) {
        console.log(`      Provider: ⚠️  Public RPC (may have rate limits)`);
        hasWarnings = true;
      }
    }
  }
}

// Check optional variables
console.log('\nℹ️  OPTIONAL Variables:');
const setOptional = [];
const missingOptional = [];
for (const varName of OPTIONAL_VARS) {
  if (process.env[varName]) {
    setOptional.push(varName);
  } else {
    missingOptional.push(varName);
  }
}
console.log(`   Set: ${setOptional.length}/${OPTIONAL_VARS.length}`);
if (setOptional.length > 0) {
  setOptional.forEach(v => console.log(`   ✅ ${v}`));
}
if (missingOptional.length > 0) {
  console.log(`   Not set: ${missingOptional.join(', ')}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (hasErrors) {
  console.log('\n❌ VALIDATION FAILED');
  console.log('\nMissing required environment variables.');
  console.log('Please create a .env file in the root directory.');
  console.log('See .env.example for reference.\n');
  process.exit(1);
}

if (hasWarnings) {
  console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS');
  console.log('\nSome recommended variables are missing.');
  console.log('Bot will work but with reduced functionality.');
  console.log('Consider adding missing variables for best experience.\n');
  process.exit(0);
}

console.log('\n✅ VALIDATION PASSED');
console.log('\nAll required variables are set.');
console.log('Bot is ready to start!\n');
process.exit(0);

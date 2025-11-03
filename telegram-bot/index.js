/**
 * Main entry point for Gearbox Telegram Bot
 * Starts bot and monitoring services
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bot = require('./bot');
const { startMonitoring } = require('./monitor');
const { startPoolDiscoveryMonitor } = require('./pool-discovery-monitor');
const config = require('./config');

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║   Gearbox Sigma Telegram Bot v1.0           ║');
console.log('║   24/7 DeFi Yield Monitoring                ║');
console.log('╚═══════════════════════════════════════════════╝\n');

console.log('📋 Configuration:');
console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`   Gemini API Key: ${process.env.GOOGLE_GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   Ethereum RPC: ${process.env.ETHEREUM_RPC_URL ? '✅ Set' : '❌ Missing'}`);
console.log('');

// Start mandate monitoring service
if (config.features.mandateMonitoring) {
  startMonitoring();
}

// Start pool discovery monitoring service
if (config.features.poolDiscoveryMonitoring) {
  startPoolDiscoveryMonitor(bot);
}

console.log('✅ All services running!');
console.log('   Press Ctrl+C to stop\n');

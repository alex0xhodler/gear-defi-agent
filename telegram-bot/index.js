/**
 * Main entry point for Gearbox Telegram Bot
 * Starts bot and monitoring service
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bot = require('./bot');
const { startMonitoring } = require('./monitor');

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║   Gearbox Sigma Telegram Bot v1.0           ║');
console.log('║   24/7 DeFi Yield Monitoring                ║');
console.log('╚═══════════════════════════════════════════════╝\n');

console.log('📋 Configuration:');
console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`   Gemini API Key: ${process.env.GOOGLE_GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   Ethereum RPC: ${process.env.ETHEREUM_RPC_URL ? '✅ Set' : '❌ Missing'}`);
console.log('');

// Start monitoring service
startMonitoring();

console.log('✅ All services running!');
console.log('   Press Ctrl+C to stop\n');

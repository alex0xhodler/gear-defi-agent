/**
 * Position Monitor Service
 * Continuously monitors user positions for:
 * - APY changes
 * - Health factor changes (liquidation risk)
 * - Position closures
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const config = require('./config');
const { scanWalletPositions } = require('./position-scanner');
const { fetchPoolAPY } = require('./query-opportunities');

// Initialize bot (for sending notifications)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Track last run times
let lastPositionScan = null;
let lastAPYCheck = null;
let lastHealthFactorCheck = null;

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log('🔍 Starting position monitoring service...');

  // Check if any pools are configured
  const totalPools = (config.pools?.Mainnet?.length || 0) + (config.pools?.Plasma?.length || 0);
  if (totalPools === 0) {
    console.log('⚠️  No pools configured in config.js');
    console.log('📖 Pools will be dynamically discovered via pool-fetcher');
    console.log('');
    console.log('ℹ️  Position monitoring will scan positions for users with connected wallets.');
    console.log('   The service will monitor existing positions in the database.');
    console.log('');
  }

  console.log(`📊 Configuration:`);
  console.log(`   - Configured pools: ${totalPools} (${config.pools?.Mainnet?.length || 0} Mainnet, ${config.pools?.Plasma?.length || 0} Plasma)`);
  console.log(`   - Position scan interval: ${config.monitoring.positionScanInterval / 60000} minutes`);
  console.log(`   - APY check interval: ${config.monitoring.positionScanInterval / 60000} minutes`);
  console.log(`   - Minor APY change threshold: ${config.apy.minorChangeThreshold}%`);
  console.log(`   - Major APY change threshold: ${config.apy.majorChangeThreshold}%`);
  console.log(`   - Mode: Lending pools only (no leverage/health factor monitoring)`);

  // Wait for database to be ready
  await db.waitForReady();
  console.log('✅ Database ready');

  // Only run position scanner if pools are configured
  if (totalPools > 0) {
    await scanUserPositions();
  } else {
    console.log('⏭️  Skipping initial position scan (no pools configured)');
  }

  // Set up monitoring intervals
  setInterval(async () => {
    try {
      await scanUserPositions();
    } catch (error) {
      console.error('❌ Error in position scan:', error.message);
    }
  }, config.monitoring.positionScanInterval);

  setInterval(async () => {
    try {
      await checkAPYChanges();
    } catch (error) {
      console.error('❌ Error in APY check:', error.message);
    }
  }, config.monitoring.positionScanInterval);

  console.log('✅ Position monitoring service started (lending pools only)');
}

/**
 * Scan all users' wallets for positions
 */
async function scanUserPositions() {
  console.log('\n🔍 Scanning user positions...');
  lastPositionScan = new Date();

  // Note: Pools are dynamically discovered, position scanning works with any discovered pools
  const totalPools = (config.pools?.Mainnet?.length || 0) + (config.pools?.Plasma?.length || 0);
  if (totalPools === 0) {
    console.log('   ℹ️  No static pools configured (using dynamic discovery)');
  }

  try {
    const users = await db.getUsersWithWallets();
    console.log(`   Found ${users.length} users with wallets`);

    for (const user of users) {
      try {
        const positions = await scanWalletPositions(user.wallet_address);

        if (positions.length > 0) {
          console.log(`   👤 ${user.wallet_address.slice(0, 10)}...: ${positions.length} positions`);

          for (const position of positions) {
            await db.createOrUpdatePosition(user.id, position);
          }
        }

        // Detect closed positions (balance became 0)
        await detectClosedPositions(user.id, positions);

      } catch (error) {
        console.error(`   ❌ Error scanning ${user.wallet_address}:`, error.message);
      }
    }

    console.log('✅ Position scan complete\n');
  } catch (error) {
    console.error('❌ Error scanning positions:', error.message);
  }
}

/**
 * Detect positions that have been closed
 */
async function detectClosedPositions(userId, currentPositions) {
  try {
    const storedPositions = await db.getUserPositions(userId);
    const currentPoolKeys = new Set(
      currentPositions.map(p => `${p.poolAddress}-${p.chainId}`)
    );

    for (const stored of storedPositions) {
      const poolKey = `${stored.pool_address}-${stored.chain_id}`;

      if (!currentPoolKeys.has(poolKey)) {
        // Position was closed
        console.log(`   ⚠️ Position closed: ${stored.pool_address.slice(0, 10)}... on chain ${stored.chain_id}`);
        await db.deactivatePosition(stored.id);

        // Notify user
        await notifyPositionClosed(stored);
      }
    }
  } catch (error) {
    console.error('   ❌ Error detecting closed positions:', error.message);
  }
}

/**
 * Check for APY changes in active positions
 */
async function checkAPYChanges() {
  console.log('\n📊 Checking APY changes...');
  lastAPYCheck = new Date();

  try {
    const positions = await db.getPositionsNeedingAPYCheck(
      config.monitoring.positionScanInterval / 60000 // Convert ms to minutes
    );

    console.log(`   Found ${positions.length} positions to check`);

    for (const position of positions) {
      try {
        // Fetch current APY
        const apyData = await fetchPoolAPY(position.pool_address, position.chain_id);

        if (!apyData || apyData.supplyAPY === null) {
          continue;
        }

        const currentSupplyAPY = apyData.supplyAPY;
        const oldSupplyAPY = position.current_supply_apy || position.initial_supply_apy;

        // Calculate APY change
        const changePercent = Math.abs(currentSupplyAPY - oldSupplyAPY);

        // Update position APY (lending pools only - no leverage calculations)
        await db.updatePositionAPY(
          position.id,
          currentSupplyAPY,
          null, // No borrow APY for lending
          currentSupplyAPY // Net APY = Supply APY for lending
        );

        // Record APY history
        await db.recordAPYHistory(
          position.pool_address,
          position.chain_id,
          currentSupplyAPY,
          apyData.borrowAPY,
          apyData.tvl || 0
        );

        // Check if change is significant
        if (changePercent >= config.apy.minorChangeThreshold) {
          const alreadyNotified = await db.wasNotifiedAboutAPYChange(
            position.id,
            config.apy.notificationCooldown / (60 * 60 * 1000) // Convert ms to hours
          );

          if (!alreadyNotified) {
            const changeType = currentSupplyAPY > oldSupplyAPY ? 'increase' : 'decrease';
            const isMajor = changePercent >= config.apy.majorChangeThreshold;

            console.log(`   📈 ${isMajor ? 'MAJOR' : 'Minor'} APY ${changeType}: ${oldSupplyAPY.toFixed(2)}% → ${currentSupplyAPY.toFixed(2)}%`);

            await notifyAPYChange(position, oldSupplyAPY, currentSupplyAPY, changePercent, isMajor);
            await db.logAPYChangeNotification(
              position.id,
              position.user_id,
              changeType,
              oldSupplyAPY,
              currentSupplyAPY,
              changePercent
            );
          }
        }
      } catch (error) {
        console.error(`   ❌ Error checking APY for position ${position.id}:`, error.message);
      }
    }

    console.log('✅ APY check complete\n');
  } catch (error) {
    console.error('❌ Error checking APY changes:', error.message);
  }
}

// Health factor monitoring removed - not applicable for lending pools

/**
 * Send APY change notification to user
 */
async function notifyAPYChange(position, oldAPY, newAPY, changePercent, isMajor) {
  try {
    const direction = newAPY > oldAPY ? '📈' : '📉';
    const sign = newAPY > oldAPY ? '+' : '';
    const urgency = isMajor ? '🚨 MAJOR APY CHANGE' : '📊 APY Update';

    const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma', 143: 'Monad' };
    const chainName = chainNames[position.chain_id] || `Chain ${position.chain_id}`;

    const message = `${urgency}\n\n` +
      `${direction} **${position.underlying_token} Position**\n` +
      `Pool: ${position.pool_address.slice(0, 10)}...${position.pool_address.slice(-8)}\n` +
      `Chain: ${chainName}\n\n` +
      `Old APY: ${oldAPY.toFixed(2)}%\n` +
      `New APY: ${newAPY.toFixed(2)}%\n` +
      `Change: ${sign}${(newAPY - oldAPY).toFixed(2)}% (${changePercent.toFixed(2)}%)\n\n` +
      `Current Value: ${position.current_value?.toFixed(2) || 'N/A'} ${position.underlying_token}`;

    await bot.sendMessage(position.telegram_chat_id, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 View Position', callback_data: `view_position_${position.id}` },
            { text: '📈 View History', callback_data: `view_history_${position.id}` },
          ],
        ],
      },
    });

    console.log(`   ✅ Notified user ${position.telegram_chat_id}`);
  } catch (error) {
    console.error(`   ❌ Error sending APY notification:`, error.message);
  }
}

// Liquidation risk notification removed - not applicable for lending pools

/**
 * Send position closed notification to user
 */
async function notifyPositionClosed(position) {
  try {
    const pnl = position.current_value - position.deposited_amount;
    const pnlPercent = (pnl / position.deposited_amount) * 100;
    const pnlEmoji = pnl >= 0 ? '📈' : '📉';

    const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma', 143: 'Monad' };
    const chainName = chainNames[position.chain_id] || `Chain ${position.chain_id}`;

    const message = `✅ **Position Closed**\n\n` +
      `${position.underlying_token} position has been closed\n\n` +
      `Pool: ${position.pool_address.slice(0, 10)}...${position.pool_address.slice(-8)}\n` +
      `Chain: ${chainName}\n\n` +
      `Deposited: ${position.deposited_amount.toFixed(2)} ${position.underlying_token}\n` +
      `Final Value: ${position.current_value?.toFixed(2) || 'N/A'} ${position.underlying_token}\n\n` +
      `${pnlEmoji} PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ${position.underlying_token} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`;

    await bot.sendMessage(position.telegram_chat_id, message, {
      parse_mode: 'Markdown',
    });

    console.log(`   ✅ Notified user about position closure`);
  } catch (error) {
    console.error(`   ❌ Error sending position closed notification:`, error.message);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n📴 Shutting down position monitor...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📴 Shutting down position monitor...');
  db.close();
  process.exit(0);
});

// Start the service
startMonitoring().catch((error) => {
  console.error('❌ Fatal error starting position monitor:', error);
  process.exit(1);
});

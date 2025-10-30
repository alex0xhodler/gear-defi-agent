/**
 * Position Monitor Service
 * Continuously monitors user positions for:
 * - APY changes
 * - Health factor changes (liquidation risk)
 * - Position closures
 */

require('dotenv').config();
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
  const totalPools = config.pools.ethereum.length + config.pools.plasma.length;
  if (totalPools === 0) {
    console.log('⚠️  No pools configured in config.js');
    console.log('📖 Please add Gearbox pool addresses to config.pools');
    console.log('   Get addresses from: https://dev.gearbox.fi/docs/documentation/deployments/deployed-contracts');
    console.log('');
    console.log('ℹ️  Position monitoring will not scan for positions until pools are configured.');
    console.log('   The service will still monitor existing positions in the database.');
    console.log('');
  }

  console.log(`📊 Configuration:`);
  console.log(`   - Configured pools: ${totalPools} (${config.pools.ethereum.length} Ethereum, ${config.pools.plasma.length} Plasma)`);
  console.log(`   - Position scan interval: ${config.monitoring.positionScanInterval / 60000} minutes`);
  console.log(`   - APY check interval: ${config.monitoring.positionScanInterval / 60000} minutes`);
  console.log(`   - Health factor check interval: ${config.monitoring.healthFactorCheckInterval / 60000} minutes`);
  console.log(`   - Minor APY change threshold: ${config.apy.minorChangeThreshold}%`);
  console.log(`   - Major APY change threshold: ${config.apy.majorChangeThreshold}%`);

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

  setInterval(async () => {
    try {
      await checkHealthFactors();
    } catch (error) {
      console.error('❌ Error in health factor check:', error.message);
    }
  }, config.monitoring.healthFactorCheckInterval);

  console.log('✅ Position monitoring service started');
}

/**
 * Scan all users' wallets for positions
 */
async function scanUserPositions() {
  console.log('\n🔍 Scanning user positions...');
  lastPositionScan = new Date();

  // Skip if no pools configured
  const totalPools = config.pools.ethereum.length + config.pools.plasma.length;
  if (totalPools === 0) {
    console.log('   ⏭️  Skipped: No pools configured in config.js');
    console.log('   💡 Add Gearbox pool addresses to enable position scanning');
    return;
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

        // Update position APY
        const netAPY = position.leverage > 1
          ? (currentSupplyAPY * position.leverage) - (apyData.borrowAPY * (position.leverage - 1))
          : currentSupplyAPY;

        await db.updatePositionAPY(
          position.id,
          currentSupplyAPY,
          apyData.borrowAPY,
          netAPY
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

/**
 * Check health factors for leveraged positions
 */
async function checkHealthFactors() {
  if (!config.features.healthFactorMonitoring) {
    return;
  }

  console.log('\n⚠️  Checking health factors...');
  lastHealthFactorCheck = new Date();

  try {
    const atRiskPositions = await db.getPositionsWithLowHealthFactor(
      config.healthFactor.warningThreshold
    );

    console.log(`   Found ${atRiskPositions.length} positions with low health factor`);

    for (const position of atRiskPositions) {
      try {
        const healthFactor = position.health_factor;

        // Determine severity
        let severity;
        let emoji;
        if (healthFactor < config.healthFactor.liquidationThreshold) {
          severity = 'critical';
          emoji = '🔴';
        } else if (healthFactor < config.healthFactor.criticalThreshold) {
          severity = 'high';
          emoji = '🟠';
        } else {
          severity = 'warning';
          emoji = '🟡';
        }

        // Check if already notified
        const cooldownHours = config.healthFactor.notificationCooldown / (60 * 60 * 1000);
        const alreadyNotified = await db.wasNotifiedAboutHealthFactor(
          position.id,
          cooldownHours
        );

        if (!alreadyNotified) {
          console.log(`   ${emoji} ${severity.toUpperCase()} health factor: ${healthFactor.toFixed(2)}`);

          await notifyLiquidationRisk(position, healthFactor, severity);
          await db.logHealthFactorNotification(
            position.id,
            position.user_id,
            healthFactor,
            severity
          );
        }
      } catch (error) {
        console.error(`   ❌ Error checking health factor for position ${position.id}:`, error.message);
      }
    }

    console.log('✅ Health factor check complete\n');
  } catch (error) {
    console.error('❌ Error checking health factors:', error.message);
  }
}

/**
 * Send APY change notification to user
 */
async function notifyAPYChange(position, oldAPY, newAPY, changePercent, isMajor) {
  try {
    const direction = newAPY > oldAPY ? '📈' : '📉';
    const sign = newAPY > oldAPY ? '+' : '';
    const urgency = isMajor ? '🚨 MAJOR APY CHANGE' : '📊 APY Update';

    const message = `${urgency}\n\n` +
      `${direction} **${position.underlying_token} Position**\n` +
      `Pool: ${position.pool_address.slice(0, 10)}...${position.pool_address.slice(-8)}\n` +
      `Chain: ${position.chain_id === 1 ? 'Ethereum' : 'Plasma'}\n\n` +
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

/**
 * Send liquidation risk notification to user
 */
async function notifyLiquidationRisk(position, healthFactor, severity) {
  try {
    let emoji, title, urgency;

    if (severity === 'critical') {
      emoji = '🔴';
      title = 'CRITICAL LIQUIDATION RISK';
      urgency = 'IMMEDIATE ACTION REQUIRED';
    } else if (severity === 'high') {
      emoji = '🟠';
      title = 'HIGH LIQUIDATION RISK';
      urgency = 'Action recommended';
    } else {
      emoji = '🟡';
      title = 'Liquidation Warning';
      urgency = 'Monitor closely';
    }

    const message = `${emoji} **${title}**\n\n` +
      `${urgency}\n\n` +
      `**${position.underlying_token} Position**\n` +
      `Pool: ${position.pool_address.slice(0, 10)}...${position.pool_address.slice(-8)}\n` +
      `Chain: ${position.chain_id === 1 ? 'Ethereum' : 'Plasma'}\n\n` +
      `Health Factor: ${healthFactor.toFixed(2)}\n` +
      `Leverage: ${position.leverage}x\n` +
      `Current Value: ${position.current_value?.toFixed(2) || 'N/A'} ${position.underlying_token}\n\n` +
      `⚠️ Health factor below ${config.healthFactor.liquidationThreshold} = liquidation\n\n` +
      `Recommended actions:\n` +
      `• Add more collateral\n` +
      `• Reduce leverage\n` +
      `• Close position`;

    await bot.sendMessage(position.telegram_chat_id, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔗 Open Gearbox App', url: `https://app.gearbox.fi` },
          ],
          [
            { text: '📊 View Position', callback_data: `view_position_${position.id}` },
          ],
        ],
      },
    });

    console.log(`   ✅ Notified user ${position.telegram_chat_id} about liquidation risk`);
  } catch (error) {
    console.error(`   ❌ Error sending liquidation notification:`, error.message);
  }
}

/**
 * Send position closed notification to user
 */
async function notifyPositionClosed(position) {
  try {
    const pnl = position.current_value - position.deposited_amount;
    const pnlPercent = (pnl / position.deposited_amount) * 100;
    const pnlEmoji = pnl >= 0 ? '📈' : '📉';

    const message = `✅ **Position Closed**\n\n` +
      `${position.underlying_token} position has been closed\n\n` +
      `Pool: ${position.pool_address.slice(0, 10)}...${position.pool_address.slice(-8)}\n` +
      `Chain: ${position.chain_id === 1 ? 'Ethereum' : 'Plasma'}\n\n` +
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

/**
 * Pool Discovery Monitor
 *
 * Periodically scans all Gearbox chains for new pools and notifies users
 * when pools matching their mandate criteria are discovered.
 *
 * Features:
 * - Discovers pools across Ethereum, Arbitrum, Optimism, Sonic, Plasma, and Monad
 * - Tracks new/removed pools in database cache
 * - Matches new pools against active mandates
 * - Sends Telegram notifications to matching users
 * - Prevents notification spam with 24h cooldown
 * - Special broadcast for first Monad pool discovery
 */

const poolFetcher = require('./utils/pool-fetcher');
const database = require('./database');
const config = require('./config');

let monitorInterval = null;
let isRunning = false;
let scanCount = 0;

/**
 * Start the pool discovery monitor
 */
function startPoolDiscoveryMonitor(bot) {
  if (isRunning) {
    console.log('⚠️  Pool discovery monitor already running');
    return;
  }

  console.log('🔍 Starting pool discovery monitor...');
  console.log(`   Scan interval: ${config.monitoring.poolRefreshInterval / 1000 / 60} minutes`);
  console.log(`   Min TVL: $${config.poolDiscovery?.minTVL ?? 0} (no filter)\n`);

  isRunning = true;

  // Run immediately on start
  scanPools(bot).catch(err => {
    console.error('❌ Initial pool scan failed:', err);
  });

  // Then run periodically
  monitorInterval = setInterval(() => {
    scanPools(bot).catch(err => {
      console.error('❌ Pool scan failed:', err);
    });
  }, config.monitoring.poolRefreshInterval);

  console.log('✅ Pool discovery monitor started\n');
}

/**
 * Stop the pool discovery monitor
 */
function stopPoolDiscoveryMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    isRunning = false;
    console.log('⏹️  Pool discovery monitor stopped');
  }
}

/**
 * Scan for new pools and update cache
 */
async function scanPools(bot) {
  try {
    scanCount++;
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Pool Discovery Scan #${scanCount}`);
    console.log(`   Time: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Fetch all pools from chains (no TVL filter)
    const minTVL = config.poolDiscovery?.minTVL ?? 0;
    const result = await poolFetcher.fetchAllPools(minTVL);

    console.log(`✅ Discovered ${result.pools.length} pools across ${result.chainCount} chains\n`);

    // Update pool cache and detect new pools
    const newPools = [];
    const seenPoolKeys = [];

    for (const pool of result.pools) {
      const poolKey = `${pool.address}-${pool.chainId}`;
      seenPoolKeys.push(poolKey);

      const cacheResult = await database.addOrUpdatePoolCache({
        pool_address: pool.address,
        chain_id: pool.chainId,
        pool_name: pool.name,
        pool_symbol: pool.symbol,
        underlying_token: pool.underlyingToken,
        underlying_token_address: pool.tokenAddress || pool.asset, // Use tokenAddress if available
        underlying_decimals: pool.decimals || 18,
        tvl: pool.tvl,
        apy: pool.apy,
        borrowed: pool.borrowed || 0,
        utilization: pool.utilization || 0,
        collaterals: pool.collaterals || null,
      });

      if (cacheResult.isNew) {
        newPools.push({
          ...pool,
          cacheId: cacheResult.id,
        });
        console.log(`   🆕 New pool discovered: ${pool.name} on ${pool.chainName}`);
        console.log(`      APY: ${pool.apy.toFixed(2)}% | TVL: $${pool.tvl.toFixed(2)} | Utilization: ${(pool.utilization || 0).toFixed(1)}%`);
      } else if (cacheResult.oldAPY && cacheResult.newAPY !== cacheResult.oldAPY) {
        // Log APY change
        const apyChange = cacheResult.newAPY - cacheResult.oldAPY;
        const changeSymbol = apyChange > 0 ? '📈' : '📉';
        console.log(`   ${changeSymbol} APY changed for ${pool.name}: ${cacheResult.oldAPY.toFixed(2)}% → ${cacheResult.newAPY.toFixed(2)}%`);
      }
    }

    // Mark missing pools as inactive
    if (seenPoolKeys.length > 0) {
      const deactivatedResult = await database.markMissingPoolsInactive(seenPoolKeys);
      if (deactivatedResult.deactivated > 0) {
        console.log(`   ⏸️  Marked ${deactivatedResult.deactivated} pools as inactive`);
      }
    }

    // Notify users about new pools
    if (newPools.length > 0) {
      console.log(`\n📢 Notifying users about ${newPools.length} new pools...`);
      await notifyUsersAboutNewPools(bot, newPools);
    } else {
      console.log(`\n   ℹ️  No new pools discovered this scan`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Scan #${scanCount} completed in ${duration}s`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Pool scan error:', error);
    throw error;
  }
}

/**
 * Notify users about new pools that match their mandates
 */
async function notifyUsersAboutNewPools(bot, newPools) {
  try {
    // Check if this is the first Monad pool ever discovered
    const monadPools = newPools.filter(pool => pool.chainId === 143);
    if (monadPools.length > 0) {
      const hasMonadPoolBefore = await database.hasMonadPoolBeenDiscovered(143);

      if (!hasMonadPoolBefore) {
        console.log('   🎉 FIRST MONAD POOL DETECTED! Broadcasting to all users...\n');
        await broadcastMonadLaunch(bot, monadPools[0]);
        // Continue with normal mandate matching for other pools
      }
    }

    // Get all active mandates
    const mandates = await database.getActiveMandates();

    if (mandates.length === 0) {
      console.log('   ℹ️  No active mandates to match against');
      return;
    }

    console.log(`   📋 Checking ${mandates.length} active mandates...\n`);

    let notificationsSent = 0;

    // Group mandates by user for efficient processing
    const mandatesByUser = mandates.reduce((acc, mandate) => {
      if (!acc[mandate.user_id]) {
        acc[mandate.user_id] = [];
      }
      acc[mandate.user_id].push(mandate);
      return acc;
    }, {});

    // Check each new pool against mandates
    for (const pool of newPools) {
      for (const mandate of mandates) {
        // Check if pool matches mandate criteria
        if (!matchesMandate(pool, mandate)) {
          continue;
        }

        // Check if user was already notified about this pool
        const wasNotified = await database.wasNotifiedAboutPool(
          mandate.user_id,
          pool.address,
          pool.chainId,
          24 // 24 hour cooldown
        );

        if (wasNotified) {
          continue;
        }

        // Mandates from getActiveMandates() already include telegram_chat_id via JOIN
        // If not available, skip this notification
        if (!mandate.telegram_chat_id) {
          console.log(`   ⚠️  Skipping notification: No telegram_chat_id for user ${mandate.user_id}`);
          continue;
        }

        // Send notification
        await sendNewPoolNotification(bot, mandate.telegram_chat_id, pool, mandate);

        // Log notification
        await database.logPoolNotification(
          mandate.user_id,
          pool.address,
          pool.chainId,
          mandate.id
        );

        notificationsSent++;
        console.log(`   ✅ Notified user ${mandate.telegram_chat_id} about ${pool.name}`);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n   📊 Sent ${notificationsSent} notifications`);

  } catch (error) {
    console.error('❌ Error notifying users:', error);
  }
}

/**
 * Broadcast Monad launch announcement to ALL users
 * This is a special one-time announcement for the first Monad pool
 */
async function broadcastMonadLaunch(bot, pool) {
  try {
    // Get all active users
    const users = await database.getAllActiveUsers();

    if (users.length === 0) {
      console.log('   ℹ️  No users to broadcast to');
      return;
    }

    console.log(`   📢 Broadcasting Monad launch to ${users.length} users...\n`);

    const message = `🎉 *MAJOR LAUNCH: Gearbox Protocol on Monad!*

The first Gearbox lending pool is now live on Monad mainnet!

🏦 *Pool:* ${pool.name}
💰 *APY:* ${pool.apy.toFixed(2)}%
📊 *TVL:* $${formatNumber(pool.tvl)}
⚡ *Chain:* Monad (Chain ID: 143)
🪙 *Asset:* ${pool.underlyingToken}

💎 *Why Monad?*
• Ultra-fast execution (~400ms blocks)
• Low transaction costs
• EVM-compatible DeFi yield

Start earning on the newest high-performance blockchain!`;

    let broadcastsSent = 0;
    let broadcastsFailed = 0;

    for (const user of users) {
      try {
        await bot.sendMessage(user.telegram_chat_id, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🚀 View Pool Details', callback_data: `pool_${pool.address}_${pool.chainId}` },
              ],
              [
                { text: '📊 Pool Analytics', url: `${config.blockchain.chains.Monad.explorerUrl}/address/${pool.address}` },
                { text: '🔔 Create Alert', callback_data: `alert_${pool.address}_${pool.chainId}` },
              ],
            ],
          },
        });

        // Log this as a special broadcast (no mandate_id)
        await database.logPoolNotification(
          user.id,
          pool.address,
          pool.chainId,
          null // No mandate - this is a broadcast
        );

        broadcastsSent++;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`   ❌ Failed to broadcast to user ${user.telegram_chat_id}:`, error.message);
        broadcastsFailed++;
      }
    }

    console.log(`   ✅ Monad launch broadcast: ${broadcastsSent} sent, ${broadcastsFailed} failed\n`);

  } catch (error) {
    console.error('❌ Error broadcasting Monad launch:', error);
  }
}

/**
 * Check if a pool matches mandate criteria
 */
function matchesMandate(pool, mandate) {
  // Match underlying asset (e.g., USDC, WETH, USDT)
  if (mandate.asset.toUpperCase() !== pool.underlyingToken.toUpperCase()) {
    return false;
  }

  // Check minimum APY
  if (pool.apy < mandate.min_apy) {
    return false;
  }

  // For now, we only support lending pools (leverage = 1)
  // In the future, add leverage matching

  return true;
}

/**
 * Send Telegram notification about a new pool
 */
async function sendNewPoolNotification(bot, chatId, pool, mandate) {
  const message = `🆕 *New Gearbox Pool Discovered!*

*Pool:* ${pool.name}
*Chain:* ${pool.chainName}
*Asset:* ${pool.underlyingToken}
*APY:* ${pool.apy.toFixed(2)}%
*TVL:* $${formatNumber(pool.tvl)}

✅ *Matches Your Mandate:*
• Asset: ${mandate.asset}
• Min APY: ${mandate.min_apy.toFixed(2)}%
• Risk: ${mandate.risk}

This pool meets your investment criteria!`;

  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 View Pool Details', callback_data: `pool_${pool.address}_${pool.chainId}` },
          ],
          [
            { text: '🔔 Create Alert', callback_data: `alert_${pool.address}_${pool.chainId}` },
            { text: '💼 View Mandate', callback_data: `mandate_${mandate.id}` },
          ],
        ],
      },
    });
  } catch (error) {
    console.error(`❌ Failed to send notification to ${chatId}:`, error.message);
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Get monitoring statistics
 */
function getMonitorStats() {
  return {
    isRunning,
    scanCount,
    interval: config.monitoring.poolRefreshInterval,
  };
}

module.exports = {
  startPoolDiscoveryMonitor,
  stopPoolDiscoveryMonitor,
  scanPools,
  getMonitorStats,
};

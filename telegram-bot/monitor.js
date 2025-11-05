/**
 * Mandate Monitoring Service
 * Runs every 15 minutes to check all active mandates against live opportunities
 */

const db = require('./database');
const bot = require('./bot');
const { queryFarmOpportunities } = require('./query-opportunities');

// Monitoring interval (15 minutes)
const MONITOR_INTERVAL = 15 * 60 * 1000;

// Track last scan time
let lastScanTime = null;
let scanCount = 0;

async function checkAllMandates() {
  try {
    scanCount++;
    const startTime = Date.now();
    console.log(`\n🔍 [SCAN #${scanCount}] Starting mandate check at ${new Date().toLocaleTimeString()}`);

    // Get all active signed mandates
    const activeMandates = await db.getActiveMandates();
    console.log(`   Found ${activeMandates.length} active mandates to check`);

    if (activeMandates.length === 0) {
      console.log('   ℹ️  No active mandates to monitor');
      return;
    }

    // Group mandates by asset to reduce API calls
    const mandatesByAsset = {};
    activeMandates.forEach(mandate => {
      if (!mandatesByAsset[mandate.asset]) {
        mandatesByAsset[mandate.asset] = [];
      }
      mandatesByAsset[mandate.asset].push(mandate);
    });

    console.log(`   Grouped into ${Object.keys(mandatesByAsset).length} asset types:`, Object.keys(mandatesByAsset).join(', '));

    let totalNotificationsSent = 0;

    // Check each asset type
    for (const [asset, mandates] of Object.entries(mandatesByAsset)) {
      try {
        console.log(`\n   📊 Checking ${asset} opportunities for ${mandates.length} mandates...`);

        // Query opportunities for this asset
        const opportunities = await queryFarmOpportunities({
          asset: asset,
          min_apy: 0 // Get all, filter later per mandate
        });

        console.log(`      Found ${opportunities.length} opportunities for ${asset}`);

        if (!opportunities || opportunities.length === 0) {
          console.log(`      ⚠️  No opportunities found for ${asset}`);
          continue;
        }

        // Check each mandate against opportunities
        for (const mandate of mandates) {
          // Filter opportunities that meet mandate criteria
          const matchingOpportunities = opportunities.filter(opp => {
            const oppAPY = opp.projAPY || opp.apy || 0;
            // Check if pool supports leverage up to the mandate's max
            const poolMaxLeverage = opp.maxLeverage || 1;

            return (
              oppAPY >= mandate.min_apy &&
              poolMaxLeverage >= 1 // Pool must support at least basic deposits
            );
          });

          if (matchingOpportunities.length === 0) {
            console.log(`      ℹ️  No matches for mandate #${mandate.id} (min ${mandate.min_apy}% APY)`);
            continue;
          }

          // Sort by highest APY
          matchingOpportunities.sort((a, b) => {
            const apyA = a.projAPY || a.apy || 0;
            const apyB = b.projAPY || b.apy || 0;
            return apyB - apyA;
          });

          const bestMatch = matchingOpportunities[0];
          const bestAPY = bestMatch.projAPY || bestMatch.apy;
          const opportunityId = bestMatch.pool_address || bestMatch.id || `${bestMatch.strategy}_${asset}`;
          const chainId = bestMatch.chain_id || 1; // Default to Ethereum mainnet if not specified
          const poolAddress = bestMatch.pool_address;

          // Check if we already notified about this opportunity recently
          const wasNotified = await db.wasRecentlyNotified(mandate.id, opportunityId, 24);

          if (wasNotified) {
            console.log(`      ⏭️  Already notified about ${bestMatch.strategy} (${bestAPY.toFixed(2)}%) in last 24h`);
            continue;
          }

          // 🚨 SEND NOTIFICATION 🚨
          console.log(`      🎯 MATCH FOUND! Mandate #${mandate.id} → ${bestMatch.strategy} (${bestAPY.toFixed(2)}% APY)`);

          try {
            // Get APY history for this pool to show change
            let apyChangeText = '';
            try {
              const apyHistory = await db.getAPYHistory(poolAddress, chainId, 7);
              if (apyHistory && apyHistory.length > 1) {
                const previousAPY = apyHistory[1].supply_apy;
                const apyChange = bestAPY - previousAPY;
                const changePercent = ((apyChange / previousAPY) * 100).toFixed(1);
                const changeSymbol = apyChange > 0 ? '📈' : '📉';
                apyChangeText = `${changeSymbol} *APY Change:* ${previousAPY.toFixed(2)}% → ${bestAPY.toFixed(2)}% (${apyChange > 0 ? '+' : ''}${changePercent}%)\n`;
              }
            } catch (historyErr) {
              console.log(`      ⚠️ Could not fetch APY history: ${historyErr.message}`);
            }

            // Format TVL with intelligent units
            let tvlFormatted = 'N/A';
            if (bestMatch.tvl) {
              if (bestMatch.tvl >= 1e6) {
                tvlFormatted = '$' + (bestMatch.tvl / 1e6).toFixed(2) + 'M';
              } else if (bestMatch.tvl >= 1e3) {
                tvlFormatted = '$' + (bestMatch.tvl / 1e3).toFixed(2) + 'K';
              } else {
                tvlFormatted = '$' + bestMatch.tvl.toFixed(2);
              }
            }

            // Format borrowed amount with intelligent units
            let borrowedFormatted = 'N/A';
            if (bestMatch.borrowed && bestMatch.borrowed > 0) {
              if (bestMatch.borrowed >= 1e6) {
                borrowedFormatted = (bestMatch.borrowed / 1e6).toFixed(2) + 'M';
              } else if (bestMatch.borrowed >= 1e3) {
                borrowedFormatted = (bestMatch.borrowed / 1e3).toFixed(2) + 'K';
              } else {
                borrowedFormatted = bestMatch.borrowed.toFixed(2);
              }
            }

            // Format utilization
            const utilizationText = (bestMatch.utilization && bestMatch.utilization > 0)
              ? `${bestMatch.utilization.toFixed(1)}%`
              : 'N/A';

            // Format collaterals
            let collateralsText = '';
            if (bestMatch.collaterals && bestMatch.collaterals.length > 0) {
              const collateralsList = Array.isArray(bestMatch.collaterals)
                ? bestMatch.collaterals
                : JSON.parse(bestMatch.collaterals);
              collateralsText = `🪙 *Collaterals:* ${collateralsList.join(', ')}\n`;
            }

            // Build pool metrics text
            let metricsText = `💰 *TVL:* ${tvlFormatted}\n`;
            if (borrowedFormatted !== 'N/A') {
              metricsText += `📊 *Borrowed:* ${borrowedFormatted} ${bestMatch.underlyingToken || ''}\n`;
            }
            if (utilizationText !== 'N/A') {
              metricsText += `⚡ *Utilization:* ${utilizationText}\n`;
            }

            await bot.sendMessage(
              mandate.telegram_chat_id,
              `🚨 *New Opportunity Alert!*\n\n` +
              `💎 *${bestMatch.strategy || bestMatch.pool_name}*\n` +
              `📈 *APY:* ${bestAPY.toFixed(2)}%\n` +
              apyChangeText +
              `🌐 *Chain:* ${bestMatch.chain}\n` +
              metricsText +
              collateralsText +
              `\nThis matches your *${mandate.asset}* alert (min ${mandate.min_apy}% APY).\n\n` +
              `_Scan #${scanCount} at ${new Date().toLocaleTimeString()}_`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '✅ View Pool', url: `https://app.gearbox.finance/pools/${chainId}/${poolAddress}` },
                      { text: '📊 More Details', callback_data: `details_${opportunityId}` }
                    ],
                    [
                      { text: '⏸️ Pause Alert', callback_data: `pause_${mandate.id}` }
                    ]
                  ]
                }
              }
            );

            // Log notification to database
            await db.logNotification(
              mandate.id,
              mandate.user_id,
              opportunityId,
              bestAPY,
              bestMatch.strategy || bestMatch.pool_name
            );

            totalNotificationsSent++;
            console.log(`      ✅ Notification sent to user ${mandate.user_id}`);
          } catch (notifyError) {
            console.error(`      ❌ Error sending notification:`, notifyError.message);
          }
        }
      } catch (assetError) {
        console.error(`   ❌ Error checking ${asset}:`, assetError.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    lastScanTime = new Date();

    console.log(`\n✅ [SCAN #${scanCount}] Completed in ${duration}s`);
    console.log(`   📬 Notifications sent: ${totalNotificationsSent}`);
    console.log(`   ⏰ Next scan in 15 minutes at ${new Date(Date.now() + MONITOR_INTERVAL).toLocaleTimeString()}\n`);

  } catch (error) {
    console.error('❌ Error in checkAllMandates:', error);
  }
}

// Start monitoring service
async function startMonitoring() {
  console.log('🚀 Starting mandate monitoring service...');
  console.log(`   Interval: Every 15 minutes (${MONITOR_INTERVAL / 1000}s)`);
  console.log(`   Waiting for database to be ready...`);

  // Wait for database to initialize
  await db.waitForReady();
  console.log(`   Database ready! First scan will run immediately\n`);

  // Run first check immediately
  checkAllMandates();

  // Then run every 15 minutes
  setInterval(checkAllMandates, MONITOR_INTERVAL);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping monitoring service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping monitoring service...');
  process.exit(0);
});

// Export for use in main process
module.exports = { startMonitoring, checkAllMandates };

// If run directly (not imported), start monitoring
if (require.main === module) {
  startMonitoring();
}

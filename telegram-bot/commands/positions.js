/**
 * Position Commands Handler
 * Handles /positions and related commands for viewing user positions
 */

const db = require('../database');
const config = require('../config');

/**
 * Handle /positions command - List all active positions
 */
async function handlePositionsCommand(bot, msg) {
  const chatId = msg.chat.id;

  try {
    // Get user from database
    const user = await db.getOrCreateUser(chatId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ Error retrieving user data. Please try /start');
      return;
    }

    // Check if wallet is connected
    if (!user.wallet_address) {
      await bot.sendMessage(
        chatId,
        '👛 No wallet connected\n\n' +
        'Connect your wallet to track positions:\n' +
        '/wallet <your_wallet_address>',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Fetch fresh positions from blockchain
    await bot.sendMessage(chatId, '🔍 Fetching latest positions from blockchain...');

    const { scanWalletPositions } = require('../position-scanner');
    const freshPositions = await scanWalletPositions(user.wallet_address);

    // Update database with fresh positions
    for (const pos of freshPositions) {
      await db.createOrUpdatePosition(user.id, pos);
    }

    console.log(`✅ Refreshed ${freshPositions.length} positions from blockchain for user ${user.id}`);

    // Get updated positions from database
    const positions = await db.getUserPositions(user.id);

    if (positions.length === 0) {
      await bot.sendMessage(
        chatId,
        '📊 **No Active Positions**\n\n' +
        'You don\'t have any active positions yet.\n\n' +
        'Create a mandate to start finding yield opportunities:\n' +
        '/create',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Calculate total portfolio value
    const totalValue = positions.reduce((sum, p) => sum + (p.current_value || 0), 0);
    const totalDeposited = positions.reduce((sum, p) => sum + (p.deposited_amount || 0), 0);
    const totalPnL = totalValue - totalDeposited;
    const totalPnLPercent = (totalPnL / totalDeposited) * 100;

    // Format positions message
    let message = `📊 **Your Positions** (${positions.length})\n\n`;
    message += `💰 Total Value: $${totalValue.toFixed(2)}\n`;
    message += `💸 Total Deposited: $${totalDeposited.toFixed(2)}\n`;
    message += `${totalPnL >= 0 ? '📈' : '📉'} PnL: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)\n\n`;
    message += `───────────────────\n\n`;

    positions.forEach((pos, index) => {
      const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma', 143: 'Monad' };
      const chainName = chainNames[pos.chain_id] || `Chain ${pos.chain_id}`;
      const pnl = (pos.current_value || 0) - (pos.deposited_amount || 0);
      const pnlPercent = (pnl / pos.deposited_amount) * 100;

      message += `**${index + 1}. ${pos.underlying_token}** on ${chainName}\n`;
      message += `   APY: ${pos.current_supply_apy?.toFixed(2) || pos.initial_supply_apy.toFixed(2)}%`;

      if (pos.leverage && pos.leverage > 1) {
        message += ` | ${pos.leverage}x leverage`;
        if (pos.health_factor) {
          const hfEmoji = pos.health_factor < 1.5 ? '🔴' : pos.health_factor < 2 ? '🟠' : '🟢';
          message += ` | ${hfEmoji} HF: ${pos.health_factor.toFixed(2)}`;
        }
      }

      message += `\n`;
      message += `   Value: ${pos.current_value?.toFixed(2) || 'N/A'} ${pos.underlying_token}`;
      message += ` | PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)\n`;

      // Add manage link for each position (using chain ID number)
      message += `   [Manage on Gearbox](https://app.gearbox.finance/pools/${pos.chain_id}/${pos.pool_address})\n\n`;
    });

    // Add inline keyboard for actions
    const keyboard = [];

    // Create rows of 2 buttons each
    for (let i = 0; i < Math.min(positions.length, 5); i++) {
      const pos = positions[i];
      keyboard.push([
        {
          text: `📊 View #${i + 1} Details`,
          callback_data: `view_position_${pos.id}`
        }
      ]);
    }

    // Add refresh button
    keyboard.push([
      { text: '🔄 Refresh Positions', callback_data: 'refresh_positions' }
    ]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Error handling /positions command:', error);
    await bot.sendMessage(chatId, '❌ Error loading positions. Please try again later.');
  }
}

/**
 * Handle view_position callback - Show detailed position info
 */
async function handleViewPosition(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const positionId = parseInt(callbackQuery.data.split('_')[2]);

  try {
    const user = await db.getOrCreateUser(chatId);
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }

    const positions = await db.getUserPositions(user.id);
    const position = positions.find(p => p.id === positionId);

    if (!position) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Position not found' });
      return;
    }

    // Get APY trend
    const trend = await db.getAPYTrend(position.pool_address, position.chain_id, 7);

    // Format detailed message
    const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma', 143: 'Monad' };
    const chainName = chainNames[position.chain_id] || `Chain ${position.chain_id}`;
    const pnl = (position.current_value || 0) - (position.deposited_amount || 0);
    const pnlPercent = (pnl / position.deposited_amount) * 100;
    const apyChange = (position.current_supply_apy || position.initial_supply_apy) - position.initial_supply_apy;

    let message = `📊 **Position Details**\n\n`;
    message += `**${position.underlying_token}** on ${chainName}\n`;
    message += `Pool: \`${position.pool_address}\`\n\n`;

    message += `**Position Info:**\n`;
    message += `• Shares: ${position.shares.toFixed(4)}\n`;
    message += `• Current Value: ${position.current_value?.toFixed(2) || 'N/A'} ${position.underlying_token}\n`;
    message += `• Deposited: ${position.deposited_amount.toFixed(2)} ${position.underlying_token}\n`;
    message += `• PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ${position.underlying_token} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)\n\n`;

    message += `**APY Info:**\n`;
    message += `• Current APY: ${position.current_supply_apy?.toFixed(2) || position.initial_supply_apy.toFixed(2)}%\n`;
    message += `• Initial APY: ${position.initial_supply_apy.toFixed(2)}%\n`;
    message += `• Change: ${apyChange >= 0 ? '+' : ''}${apyChange.toFixed(2)}%\n`;

    if (trend.trend !== 'unknown') {
      const trendEmoji = trend.trend === 'increasing' ? '📈' : trend.trend === 'decreasing' ? '📉' : '➡️';
      message += `• 7-day trend: ${trendEmoji} ${trend.trend} (${trend.change >= 0 ? '+' : ''}${trend.change.toFixed(2)}%)\n`;
    }

    if (position.leverage && position.leverage > 1) {
      message += `\n**Leverage Info:**\n`;
      message += `• Leverage: ${position.leverage}x\n`;
      message += `• Borrow APY: ${position.current_borrow_apy?.toFixed(2) || 'N/A'}%\n`;
      message += `• Net APY: ${position.net_apy?.toFixed(2) || 'N/A'}%\n`;

      if (position.health_factor) {
        const hfEmoji = position.health_factor < 1.5 ? '🔴' : position.health_factor < 2 ? '🟠' : '🟢';
        message += `• ${hfEmoji} Health Factor: ${position.health_factor.toFixed(2)}\n`;

        if (position.health_factor < 1.5) {
          message += `\n⚠️ **Warning**: Low health factor!\n`;
          message += `Liquidation risk if HF drops below ${config.healthFactor.liquidationThreshold}\n`;
        }
      }
    }

    message += `\n**Timestamps:**\n`;
    message += `• Deposited: ${new Date(position.deposited_at).toLocaleDateString()}\n`;
    message += `• Last Updated: ${new Date(position.last_updated).toLocaleDateString()}\n`;

    // Explorer link
    const explorerUrl = position.chain_id === 1
      ? `https://etherscan.io/address/${position.pool_address}`
      : `https://plasmascan.to/address/${position.pool_address}`;

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📈 View History', callback_data: `view_history_${positionId}` },
            { text: '🔄 Refresh', callback_data: `view_position_${positionId}` }
          ],
          [
            { text: '🔗 View on Explorer', url: explorerUrl }
          ],
          [
            { text: '⬅️ Back to Positions', callback_data: 'back_to_positions' }
          ]
        ]
      }
    });

    await bot.answerCallbackQuery(callbackQuery.id);

  } catch (error) {
    console.error('Error handling view position:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading position' });
  }
}

/**
 * Handle view_history callback - Show APY history chart
 */
async function handleViewHistory(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const positionId = parseInt(callbackQuery.data.split('_')[2]);

  try {
    const user = await db.getOrCreateUser(chatId);
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }

    const positions = await db.getUserPositions(user.id);
    const position = positions.find(p => p.id === positionId);

    if (!position) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Position not found' });
      return;
    }

    // Get APY history
    const history = await db.getAPYHistory(position.pool_address, position.chain_id, 30);

    const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma', 143: 'Monad' };
    const chainName = chainNames[position.chain_id] || `Chain ${position.chain_id}`;

    let message = `📈 **APY History**\n\n`;
    message += `${position.underlying_token} on ${chainName}\n\n`;

    if (history.length === 0) {
      message += 'No historical data available yet.\n';
    } else {
      message += `**Last 30 days:**\n\n`;

      // Show recent snapshots (last 10)
      const recent = history.slice(0, 10);
      recent.forEach((snapshot, index) => {
        const date = new Date(snapshot.recorded_at).toLocaleDateString();
        const prev = history[index + 1];

        let changeStr = '';
        if (prev) {
          const change = snapshot.supply_apy - prev.supply_apy;
          const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
          changeStr = ` ${emoji} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        }

        message += `${date}: ${snapshot.supply_apy.toFixed(2)}%${changeStr}\n`;
      });

      // Summary statistics
      const apys = history.map(h => h.supply_apy);
      const maxAPY = Math.max(...apys);
      const minAPY = Math.min(...apys);
      const avgAPY = apys.reduce((a, b) => a + b, 0) / apys.length;

      message += `\n**Statistics:**\n`;
      message += `• Max: ${maxAPY.toFixed(2)}%\n`;
      message += `• Min: ${minAPY.toFixed(2)}%\n`;
      message += `• Avg: ${avgAPY.toFixed(2)}%\n`;
    }

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Back to Position', callback_data: `view_position_${positionId}` }
          ]
        ]
      }
    });

    await bot.answerCallbackQuery(callbackQuery.id);

  } catch (error) {
    console.error('Error handling view history:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading history' });
  }
}

/**
 * Handle refresh_positions callback
 */
async function handleRefreshPositions(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;

  try {
    await bot.answerCallbackQuery(callbackQuery.id, { text: '🔄 Refreshing positions...' });

    // Delete old message and send new one (simulates refresh)
    await bot.deleteMessage(chatId, callbackQuery.message.message_id);

    // Call positions command again
    await handlePositionsCommand(bot, { chat: { id: chatId } });

  } catch (error) {
    console.error('Error refreshing positions:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error refreshing positions' });
  }
}

/**
 * Handle back_to_positions callback
 */
async function handleBackToPositions(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;

  try {
    await bot.deleteMessage(chatId, callbackQuery.message.message_id);
    await handlePositionsCommand(bot, { chat: { id: chatId } });
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Error going back to positions:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading positions' });
  }
}

module.exports = {
  handlePositionsCommand,
  handleViewPosition,
  handleViewHistory,
  handleRefreshPositions,
  handleBackToPositions,
};

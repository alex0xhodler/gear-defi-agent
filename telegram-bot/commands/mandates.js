/**
 * Mandates (Alerts) Commands Handler
 * Handles /mandates and /alerts commands for viewing user alerts
 */

const db = require('../database');

/**
 * Handle /mandates command - List all active alerts
 */
async function handleMandatesCommand(bot, msg) {
  const chatId = msg.chat.id;

  try {
    // Get user from database
    const user = await db.getOrCreateUser(chatId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ Error retrieving user data. Please try /start');
      return;
    }

    // Get user's mandates
    const mandates = await db.getUserMandates(user.id);

    if (mandates.length === 0) {
      await bot.sendMessage(
        chatId,
        '📋 *No Active Alerts*\n\n' +
        'You don\'t have any alerts set up yet.\n\n' +
        'Scan your wallet to auto-activate personalized alerts:\n' +
        '/wallet',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Format alerts message - simplified, user-facing only
    let message = `📋 *Your Smart Alerts* (${mandates.length})\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━\n\n`;

    mandates.forEach((mandate, index) => {
      const assetEmoji = getAssetEmoji(mandate.asset);

      message += `${assetEmoji} *${mandate.asset}*\n`;
      message += `   Min APY: ${mandate.min_apy}%+\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `🔔 Scanning every 15 minutes\n`;
    message += `You'll get notified when opportunities match these criteria.`;

    // Add inline keyboard for actions
    const keyboard = [
      [
        { text: '➕ Add New Alert', callback_data: 'add_new_alert' }
      ],
      [
        { text: '📊 View Positions', callback_data: 'show_positions' }
      ]
    ];

    // Add delete buttons for each mandate (max 5)
    const mandatesToShow = mandates.slice(0, 5);
    mandatesToShow.forEach((mandate, index) => {
      keyboard.push([
        {
          text: `🗑 Remove ${mandate.asset}`,
          callback_data: `delete_mandate_${mandate.id}`
        }
      ]);
    });

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    console.error('Error handling /mandates command:', error);
    await bot.sendMessage(chatId, '❌ Error loading alerts. Please try again later.');
  }
}

/**
 * Get emoji for asset
 */
function getAssetEmoji(asset) {
  const emojiMap = {
    'USDC': '💵',
    'USDT': '💵',
    'USDT0': '💵',
    'DAI': '💵',
    'GHO': '💵',
    'sUSDe': '💵',
    'WETH': '💎',
    'ETH': '💎',
    'wstETH': '🔷',
    'WBTC': '₿',
    'ALL': '🌐'
  };
  return emojiMap[asset] || '📊';
}

/**
 * Handle delete_mandate callback
 */
async function handleDeleteMandate(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const mandateId = parseInt(callbackQuery.data.split('_')[2]);

  try {
    const user = await db.getOrCreateUser(chatId);
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }

    // Get mandate details before deleting
    const mandates = await db.getUserMandates(user.id);
    const mandate = mandates.find(m => m.id === mandateId);

    if (!mandate) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Alert not found' });
      return;
    }

    // Delete mandate
    await db.deleteMandate(mandateId);

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `✅ Removed ${mandate.asset} alert`
    });

    // Refresh the list
    await bot.deleteMessage(chatId, callbackQuery.message.message_id);
    await handleMandatesCommand(bot, { chat: { id: chatId } });

  } catch (error) {
    console.error('Error deleting mandate:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error removing alert' });
  }
}

/**
 * Handle add_new_alert callback
 */
async function handleAddNewAlert(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;

  try {
    await bot.answerCallbackQuery(callbackQuery.id);

    await bot.sendMessage(
      chatId,
      '➕ *Add New Alert*\n\n' +
      'To add a new alert, use the manual setup:\n' +
      '/create\n\n' +
      'Or scan your wallet again to refresh personalized alerts:\n' +
      '/wallet',
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('Error handling add new alert:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error' });
  }
}

module.exports = {
  handleMandatesCommand,
  handleDeleteMandate,
  handleAddNewAlert,
};

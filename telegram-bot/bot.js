/**
 * Gearbox Sigma Telegram Bot
 * 24/7 yield monitoring with Telegram notifications
 */

const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const { queryFarmOpportunities } = require('../api/tools/query-strategies');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8466127519:AAGi_Xk1QiQCiZWkEWXPRRBdijgUn0EMTH0';

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Gearbox Sigma Bot starting...');

// Session storage for multi-step flows (in-memory, resets on restart)
const sessions = new Map();

// ==========================================
// COMMAND: /start
// ==========================================

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  try {
    await db.getOrCreateUser(chatId, username);

    await bot.sendMessage(
      chatId,
      `👋 *Welcome to Gearbox Sigma Agent!*\n\n` +
      `I'm your 24/7 DeFi yield hunter. I'll watch Gearbox Protocol opportunities and alert you when yields match your mandates.\n\n` +
      `*Commands:*\n` +
      `/create - Create new yield mandate\n` +
      `/list - View your active mandates\n` +
      `/opportunities - Check current top yields\n` +
      `/wallet - Connect wallet address\n` +
      `/stats - View your notification stats\n` +
      `/help - Show all commands`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /start:', error);
    await bot.sendMessage(chatId, '❌ Error starting bot. Please try again.');
  }
});

// ==========================================
// COMMAND: /create (Start mandate creation)
// ==========================================

bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await db.getOrCreateUser(chatId);

    // Initialize session
    sessions.set(chatId, { step: 'asset', userId: user.id });

    await bot.sendMessage(
      chatId,
      `🎯 *Let's create a yield mandate!*\n\n` +
      `What asset are you looking to earn with?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💵 USDC', callback_data: 'asset_USDC' },
              { text: '💵 USDT', callback_data: 'asset_USDT' }
            ],
            [
              { text: '⚡ WETH', callback_data: 'asset_WETH' },
              { text: '🔷 wstETH', callback_data: 'asset_wstETH' }
            ],
            [
              { text: '🪙 USDT0 (Plasma)', callback_data: 'asset_USDT0' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in /create:', error);
    await bot.sendMessage(chatId, '❌ Error creating mandate. Please try again.');
  }
});

// ==========================================
// CALLBACK QUERY HANDLER (Button clicks)
// ==========================================

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    // Handle asset selection
    if (data.startsWith('asset_')) {
      const asset = data.replace('asset_', '');
      const session = sessions.get(chatId) || {};
      session.asset = asset;
      session.step = 'minAPY';
      sessions.set(chatId, session);

      await bot.sendMessage(
        chatId,
        `Great! You selected *${asset}*.\n\n` +
        `What's your minimum acceptable APY?\n` +
        `(e.g., send "6.5" for 6.5% APY)`,
        { parse_mode: 'Markdown' }
      );
    }

    // Handle risk selection
    if (data.startsWith('risk_')) {
      const risk = data.replace('risk_', '');
      const session = sessions.get(chatId) || {};
      session.risk = risk;
      session.step = 'maxLeverage';
      sessions.set(chatId, session);

      await bot.sendMessage(
        chatId,
        `Risk level: *${risk}*\n\n` +
        `What's your maximum leverage?\n` +
        `(e.g., send "2" for 2x leverage, or "5" for 5x)`,
        { parse_mode: 'Markdown' }
      );
    }

    // Handle mandate confirmation
    if (data.startsWith('confirm_mandate')) {
      const session = sessions.get(chatId);
      if (!session || !session.mandateId) {
        await bot.sendMessage(chatId, '❌ Session expired. Please use /create to start over.');
        return;
      }

      await db.signMandate(session.mandateId);
      sessions.delete(chatId);

      const mandate = session.mandate;

      await bot.sendMessage(
        chatId,
        `✅ *Mandate Activated!*\n\n` +
        `I'm now watching for *${mandate.asset}* opportunities with:\n` +
        `📈 Min APY: ${mandate.minAPY}%\n` +
        `⚡ Max Leverage: ${mandate.maxLeverage}x\n` +
        `🛡️ Risk: ${mandate.risk}\n\n` +
        `You'll get a Telegram alert when I find matching opportunities! 🚀\n\n` +
        `_Monitoring runs every 15 minutes_`,
        { parse_mode: 'Markdown' }
      );
    }

    // Handle mandate cancellation
    if (data.startsWith('cancel_mandate')) {
      sessions.delete(chatId);
      await bot.sendMessage(chatId, '❌ Mandate creation cancelled.');
    }

    // Handle mandate pause
    if (data.startsWith('pause_')) {
      const mandateId = parseInt(data.replace('pause_', ''));
      await db.pauseMandate(mandateId);
      await bot.sendMessage(chatId, '⏸️ Mandate paused. You won\'t receive alerts for this mandate.');
    }

    // Handle opportunity approval
    if (data.startsWith('approve_')) {
      const poolAddress = data.replace('approve_', '');
      const user = await db.getOrCreateUser(chatId);

      if (!user.wallet_address) {
        await bot.sendMessage(
          chatId,
          `⚠️ Please connect your wallet first using /wallet\n\n` +
          `Once connected, you can approve deposits directly from Telegram.`
        );
        return;
      }

      await bot.sendMessage(
        chatId,
        `🔐 *Transaction Prepared*\n\n` +
        `Pool: \`${poolAddress}\`\n` +
        `Wallet: \`${user.wallet_address}\`\n\n` +
        `To proceed, visit:\nhttps://app.gearbox.fi/pools/${poolAddress}\n\n` +
        `_Future: Direct wallet signing from Telegram_`,
        { parse_mode: 'Markdown' }
      );
    }

  } catch (error) {
    console.error('Error in callback_query:', error);
    await bot.sendMessage(chatId, '❌ Error processing request. Please try again.');
  }
});

// ==========================================
// TEXT MESSAGE HANDLER (Multi-step flows)
// ==========================================

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore commands
  if (text.startsWith('/')) return;

  const session = sessions.get(chatId);
  if (!session) return;

  try {
    // Step: Enter minimum APY
    if (session.step === 'minAPY') {
      const minAPY = parseFloat(text);
      if (isNaN(minAPY) || minAPY < 0 || minAPY > 100) {
        await bot.sendMessage(chatId, '⚠️ Please enter a valid APY between 0 and 100.');
        return;
      }

      session.minAPY = minAPY;
      session.step = 'risk';
      sessions.set(chatId, session);

      await bot.sendMessage(
        chatId,
        `Min APY: *${minAPY}%*\n\n` +
        `What's your risk tolerance?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🟢 Low', callback_data: 'risk_Low' },
                { text: '🟡 Medium', callback_data: 'risk_Medium' },
                { text: '🔴 High', callback_data: 'risk_High' }
              ]
            ]
          }
        }
      );
    }

    // Step: Enter max leverage
    else if (session.step === 'maxLeverage') {
      const maxLeverage = parseFloat(text);
      if (isNaN(maxLeverage) || maxLeverage < 1 || maxLeverage > 10) {
        await bot.sendMessage(chatId, '⚠️ Please enter leverage between 1 and 10.');
        return;
      }

      session.maxLeverage = maxLeverage;
      session.step = 'maxPosition';
      sessions.set(chatId, session);

      await bot.sendMessage(
        chatId,
        `Max leverage: *${maxLeverage}x*\n\n` +
        `What's your maximum position size in USD?\n` +
        `(e.g., send "10000" for $10,000)`,
        { parse_mode: 'Markdown' }
      );
    }

    // Step: Enter max position
    else if (session.step === 'maxPosition') {
      const maxPosition = parseFloat(text);
      if (isNaN(maxPosition) || maxPosition <= 0) {
        await bot.sendMessage(chatId, '⚠️ Please enter a valid position size.');
        return;
      }

      session.maxPosition = maxPosition;
      session.step = 'confirm';
      sessions.set(chatId, session);

      // Create mandate in database
      const mandate = {
        asset: session.asset,
        minAPY: session.minAPY,
        maxLeverage: session.maxLeverage,
        risk: session.risk,
        maxPosition: session.maxPosition
      };

      const createdMandate = await db.createMandate(session.userId, mandate);
      session.mandateId = createdMandate.id;
      session.mandate = mandate;
      sessions.set(chatId, session);

      await bot.sendMessage(
        chatId,
        `📋 *Mandate Preview*\n\n` +
        `💰 Asset: ${mandate.asset}\n` +
        `📈 Min APY: ${mandate.minAPY}%\n` +
        `⚡ Max Leverage: ${mandate.maxLeverage}x\n` +
        `🛡️ Risk: ${mandate.risk}\n` +
        `💵 Max Position: $${mandate.maxPosition.toLocaleString()}\n\n` +
        `Looks good?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Activate Mandate', callback_data: 'confirm_mandate' },
                { text: '❌ Cancel', callback_data: 'cancel_mandate' }
              ]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    await bot.sendMessage(chatId, '❌ Error processing message. Please try again.');
  }
});

// ==========================================
// COMMAND: /list (View user's mandates)
// ==========================================

bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await db.getOrCreateUser(chatId);
    const mandates = await db.getUserMandates(user.id);

    if (mandates.length === 0) {
      await bot.sendMessage(
        chatId,
        `You don't have any active mandates yet.\n\nUse /create to set one up! 🚀`
      );
      return;
    }

    const mandatesList = mandates
      .map((m, i) => {
        const status = m.signed ? '✅ Active' : '⏸️ Draft';
        return (
          `${i + 1}. *${m.asset}* - Min ${m.min_apy}% APY\n` +
          `   Risk: ${m.risk} | Leverage: ${m.max_leverage}x\n` +
          `   Status: ${status}`
        );
      })
      .join('\n\n');

    await bot.sendMessage(
      chatId,
      `📋 *Your Active Mandates:*\n\n${mandatesList}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /list:', error);
    await bot.sendMessage(chatId, '❌ Error fetching mandates.');
  }
});

// ==========================================
// COMMAND: /opportunities (Check current yields)
// ==========================================

bot.onText(/\/opportunities/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await bot.sendMessage(chatId, '🔍 Scanning current opportunities...');

    // Query top opportunities
    const opportunities = await queryFarmOpportunities({
      asset: 'USDC',
      min_apy: 0
    });

    if (!opportunities || opportunities.length === 0) {
      await bot.sendMessage(chatId, '❌ No opportunities found. Try again later.');
      return;
    }

    const top3 = opportunities.slice(0, 3);

    const opportunitiesText = top3
      .map((opp, i) =>
        `${i + 1}. *${opp.strategy || opp.pool_name}*\n` +
        `   📈 APY: ${opp.projAPY?.toFixed(2) || opp.apy?.toFixed(2)}%\n` +
        `   ⚡ Leverage: ${opp.leverage || opp.maxLeverage || 'N/A'}x\n` +
        `   🌐 Chain: ${opp.chain}`
      )
      .join('\n\n');

    await bot.sendMessage(
      chatId,
      `💎 *Top Opportunities Right Now:*\n\n${opportunitiesText}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /opportunities:', error);
    await bot.sendMessage(chatId, '❌ Error fetching opportunities. Please try again.');
  }
});

// ==========================================
// COMMAND: /wallet (Connect wallet)
// ==========================================

bot.onText(/\/wallet(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const walletAddress = match[1]?.trim();

  try {
    const user = await db.getOrCreateUser(chatId);

    if (!walletAddress) {
      const currentWallet = user.wallet_address || 'Not connected';
      await bot.sendMessage(
        chatId,
        `💳 *Wallet Status*\n\n` +
        `Current wallet: \`${currentWallet}\`\n\n` +
        `To connect a wallet, send:\n` +
        `/wallet 0xYourWalletAddress`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Basic validation
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      await bot.sendMessage(chatId, '⚠️ Invalid wallet address. Must start with 0x and be 42 characters.');
      return;
    }

    await db.updateUserWallet(user.id, walletAddress);

    await bot.sendMessage(
      chatId,
      `✅ *Wallet Connected!*\n\n` +
      `Address: \`${walletAddress}\`\n\n` +
      `You can now approve deposits directly from Telegram alerts.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /wallet:', error);
    await bot.sendMessage(chatId, '❌ Error connecting wallet.');
  }
});

// ==========================================
// COMMAND: /stats (Notification stats)
// ==========================================

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await db.getOrCreateUser(chatId);
    const stats = await db.getNotificationStats(user.id);

    await bot.sendMessage(
      chatId,
      `📊 *Your Stats*\n\n` +
      `🔔 Total alerts: ${stats.total_notifications || 0}\n` +
      `📈 Average APY: ${stats.avg_apy ? stats.avg_apy.toFixed(2) + '%' : 'N/A'}\n` +
      `⏰ Last alert: ${stats.last_notification || 'Never'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /stats:', error);
    await bot.sendMessage(chatId, '❌ Error fetching stats.');
  }
});

// ==========================================
// COMMAND: /help
// ==========================================

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    `🤖 *Gearbox Sigma Bot - Help*\n\n` +
    `*Commands:*\n` +
    `/start - Start the bot\n` +
    `/create - Create new yield mandate\n` +
    `/list - View your active mandates\n` +
    `/opportunities - Check current top yields\n` +
    `/wallet [address] - Connect/view wallet\n` +
    `/stats - View notification stats\n` +
    `/help - Show this help message\n\n` +
    `*How it works:*\n` +
    `1. Create a mandate with your criteria\n` +
    `2. Bot monitors Gearbox every 15 minutes\n` +
    `3. Get alerts when yields match your mandate\n` +
    `4. Approve deposits with one click\n\n` +
    `_Bot runs 24/7 on server - no need to keep anything open!_`,
    { parse_mode: 'Markdown' }
  );
});

// ==========================================
// ERROR HANDLING
// ==========================================

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.code, error.message);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...');
  bot.stopPolling();
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot...');
  bot.stopPolling();
  db.close();
  process.exit(0);
});

console.log('✅ Bot is running! Waiting for messages...');

module.exports = bot;

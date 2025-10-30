/**
 * Gearbox Sigma Telegram Bot
 * 24/7 yield monitoring with Telegram notifications
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const { queryFarmOpportunities } = require('./query-opportunities');
const { scanWalletPositions } = require('./position-scanner');
const positionCommands = require('./commands/positions');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Gearbox Sigma Bot starting...');

// Set bot command menu (appears when user types "/" in chat)
bot.setMyCommands([
  { command: 'start', description: '🏠 Start the bot and view main menu' },
  { command: 'create', description: '➕ Create a new yield mandate' },
  { command: 'list', description: '📋 View your active mandates' },
  { command: 'positions', description: '💼 View your active positions' },
  { command: 'opportunities', description: '💎 Check current top yields' },
  { command: 'wallet', description: '💳 Connect or view your wallet' },
  { command: 'stats', description: '📊 View your notification stats' },
  { command: 'help', description: '❓ Show help and instructions' }
]).then(() => {
  console.log('✅ Bot command menu configured');
}).catch(err => {
  console.error('❌ Error setting bot commands:', err);
});

// Session storage for multi-step flows (in-memory, resets on restart)
const sessions = new Map();

// ==========================================
// COMMAND: /start
// ==========================================

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  try {
    const user = await db.getOrCreateUser(chatId, username);
    const mandates = await db.getUserMandates(user.id);

    if (mandates.length === 0) {
      // First-time user - offer quick setup
      await bot.sendMessage(
        chatId,
        `👋 *Welcome to Gearbox Sigma Agent!*\n\n` +
        `I'm your 24/7 DeFi yield hunter. I'll watch Gearbox Protocol lending pools and alert you when yields match your mandates.\n\n` +
        `🚀 *Quick Start:* Choose a ready-made template or create your own custom mandate!`,
        { parse_mode: 'Markdown' }
      );

      await bot.sendMessage(
        chatId,
        `📋 *Choose a template to get started:*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🛡️ Conservative (3%+ APY)', callback_data: 'setup_default_conservative' }
              ],
              [
                { text: '⚖️ Balanced (7%+ APY)', callback_data: 'setup_default_balanced' }
              ],
              [
                { text: '🚀 Aggressive (12%+ APY)', callback_data: 'setup_default_aggressive' }
              ],
              [
                { text: '🎨 Custom Mandate', callback_data: 'menu_create' }
              ]
            ]
          }
        }
      );

      // Encourage wallet connection for first-time users
      if (!user.wallet_address) {
        await bot.sendMessage(
          chatId,
          `💡 *Pro Tip:* Connect your wallet to track your positions!\n\n` +
          `Use /wallet to connect and I'll monitor your active positions, APY changes, and health factors.`,
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      // Returning user - show main menu
      await bot.sendMessage(
        chatId,
        `👋 *Welcome back!*\n\n` +
        `You have ${mandates.length} active mandate${mandates.length > 1 ? 's' : ''}.\n` +
        `I'm watching for opportunities 24/7! 🔍`,
        { parse_mode: 'Markdown' }
      );

      // Remind returning users without wallet to connect
      if (!user.wallet_address) {
        await bot.sendMessage(
          chatId,
          `💳 *Wallet not connected*\n\n` +
          `Connect your wallet with /wallet to enable position tracking and receive alerts for APY changes and liquidation risks.`,
          { parse_mode: 'Markdown' }
        );
      }

      await showMainMenu(chatId);
    }
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

    // Handle main menu navigation
    if (data === 'menu_create') {
      // Trigger /create command
      const user = await db.getOrCreateUser(chatId);
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
      return;
    } else if (data === 'menu_list') {
      const user = await db.getOrCreateUser(chatId);
      const mandates = await db.getUserMandates(user.id);
      if (mandates.length === 0) {
        await bot.sendMessage(chatId, `You don't have any active mandates yet.\n\nUse the button below to create one! 🚀`);
        await showMainMenu(chatId);
      } else {
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
        await bot.sendMessage(chatId, `📋 *Your Active Mandates:*\n\n${mandatesList}`, { parse_mode: 'Markdown' });
        await showMainMenu(chatId);
      }
      return;
    } else if (data === 'menu_opportunities') {
      await bot.sendMessage(chatId, '🔍 Scanning current opportunities...');
      const opportunities = await queryFarmOpportunities({ asset: 'USDC', min_apy: 0 });
      if (!opportunities || opportunities.length === 0) {
        await bot.sendMessage(chatId, '❌ No opportunities found. Try again later.');
        await showMainMenu(chatId);
      } else {
        const top3 = opportunities.slice(0, 3);
        const opportunitiesText = top3
          .map((opp, i) =>
            `${i + 1}. *${opp.strategy || opp.pool_name}*\n` +
            `   📈 APY: ${opp.projAPY?.toFixed(2) || opp.apy?.toFixed(2)}%\n` +
            `   ⚡ Leverage: ${opp.leverage || opp.maxLeverage || 'N/A'}x\n` +
            `   🌐 Chain: ${opp.chain}`
          )
          .join('\n\n');
        await bot.sendMessage(chatId, `💎 *Top Opportunities Right Now:*\n\n${opportunitiesText}`, { parse_mode: 'Markdown' });
        await showMainMenu(chatId);
      }
      return;
    } else if (data === 'menu_stats') {
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
      await showMainMenu(chatId);
      return;
    } else if (data === 'menu_wallet') {
      const user = await db.getOrCreateUser(chatId);
      const currentWallet = user.wallet_address || 'Not connected';
      await bot.sendMessage(
        chatId,
        `💳 *Wallet Status*\n\n` +
        `Current wallet: \`${currentWallet}\`\n\n` +
        `To connect a wallet, send:\n` +
        `/wallet 0xYourWalletAddress`,
        { parse_mode: 'Markdown' }
      );
      await showMainMenu(chatId);
      return;
    } else if (data === 'menu_help') {
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
      await showMainMenu(chatId);
      return;
    } else if (data === 'back_to_menu') {
      await showMainMenu(chatId);
      return;
    } else if (data.startsWith('setup_default_')) {
      const template = data.replace('setup_default_', '');
      await setupDefaultMandate(chatId, template);
      return;
    }

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
        `(e.g., send "5" for 5% APY, or "10" for 10% APY)\n\n` +
        `_Note: Risk and leverage will be auto-configured based on your APY target_`,
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
        `I'm now watching for *${mandate.asset}* opportunities with min ${mandate.minAPY}% APY.\n\n` +
        `You'll get a Telegram alert when I find matching opportunities! 🚀\n\n` +
        `_Monitoring runs every 15 minutes_`,
        { parse_mode: 'Markdown' }
      );

      // Encourage adding more mandates
      await bot.sendMessage(
        chatId,
        `💡 *Want to cover more opportunities?*\n\n` +
        `Consider adding mandates for different assets (WETH, wstETH) or risk levels to maximize your yield hunting!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '➕ Add Another Mandate', callback_data: 'menu_create' }
              ],
              [
                { text: '📋 Back to Main Menu', callback_data: 'back_to_menu' }
              ]
            ]
          }
        }
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

    // Position-related callbacks
    if (data.startsWith('view_position_')) {
      await positionCommands.handleViewPosition(bot, query);
      return;
    }

    if (data.startsWith('view_history_')) {
      await positionCommands.handleViewHistory(bot, query);
      return;
    }

    if (data === 'refresh_positions') {
      await positionCommands.handleRefreshPositions(bot, query);
      return;
    }

    if (data === 'back_to_positions') {
      await positionCommands.handleBackToPositions(bot, query);
      return;
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

      // Apply smart defaults
      session.minAPY = minAPY;

      // Smart defaults for lending pools (no leverage involved)
      if (minAPY < 5) {
        session.risk = 'Low';
      } else if (minAPY < 10) {
        session.risk = 'Medium';
      } else {
        session.risk = 'High';
      }
      session.maxLeverage = 1; // Lending pools are non-leveraged
      session.maxPosition = 50000; // Default $50k max position for lending

      session.step = 'confirm';
      sessions.set(chatId, session);

      // Create mandate in database immediately
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
        `💰 Asset: *${mandate.asset}*\n` +
        `📈 Min APY: *${mandate.minAPY}%*\n\n` +
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
      `Scanning for existing positions...`,
      { parse_mode: 'Markdown' }
    );

    // Scan for positions
    try {
      const positions = await scanWalletPositions(walletAddress);

      if (positions.length > 0) {
        // Store positions in database
        for (const position of positions) {
          await db.createOrUpdatePosition(user.id, position);
        }

        const totalValue = positions.reduce((sum, p) => sum + (p.currentValue || 0), 0);

        await bot.sendMessage(
          chatId,
          `🔍 *Position Scan Complete*\n\n` +
          `Found ${positions.length} active position(s)!\n` +
          `Total value: $${totalValue.toFixed(2)}\n\n` +
          `Use /positions to view details`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.sendMessage(
          chatId,
          `📊 No active positions found.\n\n` +
          `Create a mandate to find yield opportunities:\n/create`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (scanError) {
      console.error('Error scanning positions:', scanError);
      await bot.sendMessage(
        chatId,
        `⚠️ Wallet connected, but position scan failed.\n\n` +
        `The monitoring service will scan your wallet automatically.`,
        { parse_mode: 'Markdown' }
      );
    }

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
// COMMAND: /positions
// ==========================================

bot.onText(/\/positions/, async (msg) => {
  await positionCommands.handlePositionsCommand(bot, msg);
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
    `/positions - View your active positions\n` +
    `/opportunities - Check current top yields\n` +
    `/wallet [address] - Connect/view wallet\n` +
    `/stats - View notification stats\n` +
    `/help - Show this help message\n\n` +
    `*How it works:*\n` +
    `1. Create a mandate with your criteria\n` +
    `2. Bot monitors Gearbox every 15 minutes\n` +
    `3. Get alerts when yields match your mandate\n` +
    `4. Connect your wallet to track positions\n` +
    `5. Get alerts for APY changes and liquidation risks\n\n` +
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

// ==========================================
// HELPER: Show Main Menu
// ==========================================

function showMainMenu(chatId, message = '📋 *Main Menu*') {
  return bot.sendMessage(
    chatId,
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Create Mandate', callback_data: 'menu_create' },
            { text: '📋 My Mandates', callback_data: 'menu_list' }
          ],
          [
            { text: '💎 View Opportunities', callback_data: 'menu_opportunities' },
            { text: '📊 My Stats', callback_data: 'menu_stats' }
          ],
          [
            { text: '💳 Wallet', callback_data: 'menu_wallet' },
            { text: '❓ Help', callback_data: 'menu_help' }
          ]
        ]
      }
    }
  );
}

// ==========================================
// HELPER: Setup Default Mandates
// ==========================================

async function setupDefaultMandate(chatId, template) {
  try {
    const user = await db.getOrCreateUser(chatId);

    const templates = {
      'conservative': {
        asset: 'USDC',
        minAPY: 3.0,
        maxLeverage: 1,
        risk: 'Low',
        maxPosition: 10000
      },
      'balanced': {
        asset: 'USDT0',
        minAPY: 7.0,
        maxLeverage: 1,
        risk: 'Medium',
        maxPosition: 25000
      },
      'aggressive': {
        asset: 'USDT0',
        minAPY: 12.0,
        maxLeverage: 1,
        risk: 'High',
        maxPosition: 50000
      }
    };

    const mandate = templates[template];
    if (!mandate) return;

    const createdMandate = await db.createMandate(user.id, mandate);
    await db.signMandate(createdMandate.id);

    await bot.sendMessage(
      chatId,
      `✅ *${template.charAt(0).toUpperCase() + template.slice(1)} Mandate Activated!*\n\n` +
      `I'm now watching for *${mandate.asset}* lending pools with ${mandate.minAPY}%+ APY.\n\n` +
      `You'll get alerts when matching opportunities appear! 🚀`,
      { parse_mode: 'Markdown' }
    );

    // Show options to add more or go to menu
    await bot.sendMessage(
      chatId,
      `💡 *Want to cover more opportunities?*\n\n` +
      `Consider adding mandates for different assets to maximize your yield hunting!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Add Another Mandate', callback_data: 'menu_create' }
            ],
            [
              { text: '📋 Back to Main Menu', callback_data: 'back_to_menu' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error setting up default mandate:', error);
    await bot.sendMessage(chatId, '❌ Error setting up mandate. Please try again.');
  }
}

module.exports = bot;

/**
 * Gearbox Sigma Telegram Bot
 * 24/7 yield monitoring with Telegram notifications
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const { queryFarmOpportunities } = require('./query-opportunities');
const { scanWalletPositions } = require('./position-scanner');
const positionCommands = require('./commands/positions');
const { analyzeWalletHoldings } = require('./utils/wallet-analyzer');
const { getOpportunityPreviews } = require('./utils/opportunity-preview');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Gearbox Sigma Bot starting...');

// Set bot command menu (appears when user types "/" in chat)
bot.setMyCommands([
  { command: 'start', description: '🏠 Start the bot and view main menu' },
  { command: 'create', description: '➕ Create a new yield alert' },
  { command: 'list', description: '📋 View your active alerts' },
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
    const hasWallet = !!user.wallet_address;

    if (mandates.length === 0 && !hasWallet) {
      // First-time user - wallet-first onboarding (THE AWE MOMENT STARTS HERE)
      await bot.sendMessage(
        chatId,
        `👋 *Welcome to Sigmatic*\n\n` +
        `Your 24/7 Gearbox yield monitoring agent\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `I analyze your wallet and find the best yields across 31 pools and 5 chains.\n\n` +
        `Let me show you what you're missing:\n\n` +
        `━━━━━━━━━━━━━━━━━━━`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👛 Scan My Wallet', callback_data: 'onboard_wallet_scan' }
              ],
              [
                { text: '⚙️ Manual Setup', callback_data: 'onboard_manual' },
                { text: '📖 How It Works', callback_data: 'show_help' }
              ]
            ]
          }
        }
      );
    } else if (mandates.length === 0) {
      // Has wallet but no alerts - sleek alert setup
      await bot.sendMessage(
        chatId,
        `✅ *Wallet Connected*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Now let's set up yield alerts so I can notify you when rates match your strategy.\n\n` +
        `*Choose your investment profile:*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🛡️ Conservative · 3%+ APY', callback_data: 'setup_default_conservative' }
              ],
              [
                { text: '⚖️ Balanced · 7%+ APY', callback_data: 'setup_default_balanced' }
              ],
              [
                { text: '🚀 Aggressive · 12%+ APY', callback_data: 'setup_default_aggressive' }
              ],
              [
                { text: '⚙️ Custom Strategy', callback_data: 'menu_create' }
              ]
            ]
          }
        }
      );
    } else {
      // Returning user - sleek status display
      const alertCount = mandates.length;
      const alertText = alertCount === 1 ? '1 alert' : `${alertCount} alerts`;

      await bot.sendMessage(
        chatId,
        `👋 *Welcome back*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ ${alertText} active\n` +
        `🔍 Monitoring 31 pools\n` +
        `⏰ Scanning every 15 minutes\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `I'm tracking APY changes across Ethereum, Arbitrum, Optimism, Sonic, and Plasma to maximize your capital efficiency.`,
        { parse_mode: 'Markdown' }
      );

      // Remind returning users without wallet to connect
      if (!hasWallet) {
        await bot.sendMessage(
          chatId,
          `💡 *Pro Tip:* Connect your wallet to track your positions!\n\n` +
          `Use /wallet or tap the button below to enable position tracking and APY change alerts.`,
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
// COMMAND: /create (Start alert creation)
// ==========================================

bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await db.getOrCreateUser(chatId);

    // Initialize session
    sessions.set(chatId, { step: 'asset', userId: user.id });

    await bot.sendMessage(
      chatId,
      `🎯 *Create Yield Alert*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Which asset would you like to earn yield on?\n\n` +
      `_I'll notify you when pools match your target APY_`,
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
        await bot.sendMessage(chatId, `You don't have any active alerts yet.\n\nUse the button below to create one! 🚀`);
        await showMainMenu(chatId);
      } else {
        // Send each mandate as a separate card with delete button
        await bot.sendMessage(chatId, `📋 *Your Active Alerts (${mandates.length}):*`, { parse_mode: 'Markdown' });

        for (const mandate of mandates) {
          const status = mandate.signed ? '✅ Active' : '⏸️ Draft';
          const expiresAt = new Date(mandate.expires_at).toLocaleDateString();

          const mandateText = (
            `*${mandate.asset}* Alert\n\n` +
            `📊 Min APY: ${mandate.min_apy}%\n` +
            `⚖️ Risk: ${mandate.risk}\n` +
            `💰 Max Position: $${mandate.max_position.toLocaleString()}\n` +
            `📅 Expires: ${expiresAt}\n` +
            `Status: ${status}`
          );

          await bot.sendMessage(
            chatId,
            mandateText,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🗑️ Delete Alert', callback_data: `delete_mandate_${mandate.id}` }
                  ]
                ]
              }
            }
          );
        }

        await showMainMenu(chatId);
      }
      return;
    } else if (data === 'menu_opportunities') {
      const user = await db.getOrCreateUser(chatId);
      const mandates = await db.getUserMandates(user.id);

      if (mandates.length === 0) {
        await bot.sendMessage(
          chatId,
          `📋 *No Active Alerts*\n\n` +
          `Create an alert first to see matching opportunities!`,
          { parse_mode: 'Markdown' }
        );
        await showMainMenu(chatId);
        return;
      }

      await bot.sendMessage(chatId, `🔍 Scanning opportunities for your ${mandates.length} alert${mandates.length > 1 ? 's' : ''}...`);

      let hasResults = false;
      let responseText = `💎 *Matching Opportunities:*\n\n`;

      for (const mandate of mandates) {
        const opportunities = await queryFarmOpportunities({
          asset: mandate.asset,
          min_apy: mandate.min_apy
        });

        if (opportunities && opportunities.length > 0) {
          hasResults = true;
          const top3 = opportunities.slice(0, 3);

          responseText += `📋 *${mandate.asset}* (${mandate.min_apy}%+)\n`;
          top3.forEach((opp, i) => {
            responseText += `${i + 1}. ${opp.pool_name || opp.strategy} - ${(opp.projAPY || opp.apy).toFixed(2)}% (${opp.chain})\n`;
          });
          responseText += `\n`;
        }
      }

      if (!hasResults) {
        await bot.sendMessage(chatId, '❌ No opportunities found matching your alerts.');
      } else {
        await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
      }
      await showMainMenu(chatId);
      return;
    } else if (data === 'menu_positions') {
      // Trigger /positions command via positions handler
      await positionCommands.handlePositionsCommand(bot, { chat: { id: chatId } });
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
        `/create - Create new yield alert\n` +
        `/list - View your active alerts\n` +
        `/positions - View your active positions\n` +
        `/opportunities - Check current top yields\n` +
        `/wallet [address] - Connect/view wallet\n` +
        `/stats - View notification stats\n` +
        `/help - Show this help message\n\n` +
        `*How it works:*\n` +
        `1. Create an alert with your criteria\n` +
        `2. Bot monitors Gearbox every 15 minutes\n` +
        `3. Get alerts when yields match your criteria\n` +
        `4. Connect wallet to track positions\n\n` +
        `_Bot runs 24/7 on server - no need to keep anything open!_`,
        { parse_mode: 'Markdown' }
      );
      await showMainMenu(chatId);
      return;
    } else if (data === 'back_to_menu') {
      await showMainMenu(chatId);
      return;
    } else if (data === 'onboard_wallet_scan') {
      // NEW: Wallet-first onboarding - prompt for wallet address
      await bot.sendMessage(
        chatId,
        `👛 *Wallet Scan*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Send me your Ethereum wallet address and I'll:\n\n` +
        `✨ Detect all your DeFi tokens\n` +
        `📊 Show current best APYs\n` +
        `💡 Suggest personalized alerts\n` +
        `🚀 Auto-enable monitoring\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Send your address:*\n` +
        `/wallet 0xYourAddress`,
        { parse_mode: 'Markdown' }
      );
      return;
    } else if (data === 'onboard_manual') {
      // NEW: Manual setup with "All Assets" default
      await bot.sendMessage(
        chatId,
        `⚙️ *Manual Alert Setup*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Choose your strategy:\n\n` +
        `I'll monitor *ALL assets* (USDC, wstETH, WETH, WBTC, etc.) matching your risk level.\n\n` +
        `💡 *Tip:* Connect wallet later to filter for only tokens you own.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🛡️ Conservative · 3%+ APY', callback_data: 'setup_all_assets_conservative' }
              ],
              [
                { text: '⚖️ Balanced · 5%+ APY', callback_data: 'setup_all_assets_balanced' }
              ],
              [
                { text: '🚀 Aggressive · 10%+ APY', callback_data: 'setup_all_assets_aggressive' }
              ],
              [
                { text: '🔙 Back', callback_data: 'back_to_start' }
              ]
            ]
          }
        }
      );
      return;
    } else if (data.startsWith('setup_all_assets_')) {
      // NEW: Create "All Assets" mandate
      const strategy = data.replace('setup_all_assets_', '');
      await setupAllAssetsMandate(chatId, strategy);
      return;
    } else if (data.startsWith('activate_smart_alerts_')) {
      // NEW: Auto-create personalized alerts based on wallet analysis
      const userId = parseInt(data.replace('activate_smart_alerts_', ''));

      global.walletSessions = global.walletSessions || new Map();
      const session = global.walletSessions.get(chatId);

      if (!session || !session.analysis) {
        await bot.sendMessage(chatId, '⚠️ Session expired. Please run /wallet again.');
        return;
      }

      const { analysis } = session;
      const { suggestedStrategy, suggestedAssets } = analysis;

      // Create mandates for each detected asset
      const mandates = suggestedAssets.map(asset => ({
        asset: asset.asset,
        minAPY: suggestedStrategy.minAPY,
        risk: suggestedStrategy.risk,
        maxLeverage: 1,
        maxPosition: 50000
      }));

      try {
        const createdIds = await db.createMultipleMandates(userId, mandates, true);

        const assetList = mandates.map(m => m.asset).join(', ');

        await bot.sendMessage(
          chatId,
          `🎉 *Alerts Activated!*\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ Monitoring ${mandates.length} token type(s): ${assetList}\n` +
          `✅ Minimum ${suggestedStrategy.minAPY}% APY (${suggestedStrategy.strategy})\n` +
          `✅ ${suggestedStrategy.risk} risk tolerance\n` +
          `⏰ Scanning every 15 minutes\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `You'll get instant notifications when opportunities match your portfolio!`,
          { parse_mode: 'Markdown' }
        );

        // Clean up session
        global.walletSessions.delete(chatId);

        await showMainMenu(chatId);
      } catch (error) {
        console.error('Error activating smart alerts:', error);
        await bot.sendMessage(chatId, '❌ Error creating alerts. Please try again.');
      }
      return;
    } else if (data === 'back_to_start') {
      // Restart onboarding
      const user = await db.getOrCreateUser(chatId);
      const mandates = await db.getUserMandates(user.id);

      if (mandates.length === 0) {
        await bot.sendMessage(
          chatId,
          `👋 *Welcome to Sigmatic*\n\n` +
          `Your 24/7 Gearbox yield monitoring agent\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `I analyze your wallet and find the best yields across 31 pools and 5 chains.\n\n` +
          `Let me show you what you're missing:\n\n` +
          `━━━━━━━━━━━━━━━━━━━`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👛 Scan My Wallet', callback_data: 'onboard_wallet_scan' }
                ],
                [
                  { text: '⚙️ Manual Setup', callback_data: 'onboard_manual' },
                  { text: '📖 How It Works', callback_data: 'show_help' }
                ]
              ]
            }
          }
        );
      } else {
        await showMainMenu(chatId);
      }
      return;
    } else if (data === 'onboard_wallet') {
      // Wallet tracking - premium onboarding
      await bot.sendMessage(
        chatId,
        `👛 *Position Tracking*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Connect your wallet to automatically track all Gearbox positions.\n\n` +
        `*I'll alert you when:*\n\n` +
        `📈 APY increases on your positions\n` +
        `📉 APY decreases (time to rebalance)\n` +
        `🆕 Better opportunities emerge\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `*To connect:*\n` +
        `/wallet 0xYourAddress`,
        { parse_mode: 'Markdown' }
      );
      return;
    } else if (data === 'onboard_alerts') {
      // Yield alerts - premium onboarding
      await bot.sendMessage(
        chatId,
        `🎯 *Yield Alert Setup*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `I scan 31 pools across 5 chains every 15 minutes.\n\n` +
        `*Select your strategy:*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🛡️ Conservative · 3%+ APY', callback_data: 'setup_default_conservative' }
              ],
              [
                { text: '⚖️ Balanced · 7%+ APY', callback_data: 'setup_default_balanced' }
              ],
              [
                { text: '🚀 Aggressive · 12%+ APY', callback_data: 'setup_default_aggressive' }
              ],
              [
                { text: '⚙️ Custom Strategy', callback_data: 'menu_create' }
              ]
            ]
          }
        }
      );
      return;
    } else if (data === 'show_help') {
      // Show help from onboarding
      await bot.sendMessage(
        chatId,
        `🤖 *Meet Sigmatic - Your 24/7 Gearbox Agent*\n\n` +
        `I help you maximize capital efficiency on Gearbox Protocol by monitoring lending pool APYs and notifying you when opportunities arise.\n\n` +
        `*How I Work for You:*\n\n` +
        `📊 *Position Monitoring*\n` +
        `Connect your wallet and I'll track your Gearbox positions, alerting you whenever lending APYs change so you can rebalance for better returns.\n\n` +
        `🎯 *Opportunity Alerts*\n` +
        `Set your criteria (asset, min APY, risk tolerance) and I'll scan all Gearbox pools every 15 minutes across Ethereum, Arbitrum, Optimism, Sonic, and Plasma.\n\n` +
        `💰 *Capital Efficiency*\n` +
        `Never miss a rate change. I work 24/7 so you can deploy capital when yields spike and move it when rates drop.\n\n` +
        `*Commands:*\n` +
        `/wallet [address] - Connect wallet for position tracking\n` +
        `/create - Create custom yield alert\n` +
        `/positions - View your positions and APYs\n` +
        `/opportunities - Check current yields across chains\n\n` +
        `Ready to maximize your Gearbox potential?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👛 Track Wallet', callback_data: 'onboard_wallet' }
              ],
              [
                { text: '🔔 Get Alerts', callback_data: 'onboard_alerts' }
              ]
            ]
          }
        }
      );
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
        `_Note: Risk level will be auto-configured based on your APY target_`,
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

    // Handle mandate deletion
    if (data.startsWith('delete_mandate_')) {
      const mandateId = parseInt(data.replace('delete_mandate_', ''));

      // Show confirmation dialog
      await bot.sendMessage(
        chatId,
        `⚠️ *Are you sure you want to delete this alert?*\n\n` +
        `This action cannot be undone. You'll stop receiving notifications for this mandate.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Yes, Delete', callback_data: `confirm_delete_${mandateId}` },
                { text: '❌ Cancel', callback_data: 'menu_list' }
              ]
            ]
          }
        }
      );
      return;
    }

    // Handle confirmed mandate deletion
    if (data.startsWith('confirm_delete_')) {
      const mandateId = parseInt(data.replace('confirm_delete_', ''));

      try {
        await db.deleteMandate(mandateId);
        await bot.sendMessage(
          chatId,
          `✅ *Alert deleted successfully!*\n\n` +
          `You won't receive notifications for this mandate anymore.`,
          { parse_mode: 'Markdown' }
        );

        // Show remaining mandates
        const user = await db.getOrCreateUser(chatId);
        const remainingMandates = await db.getUserMandates(user.id);

        if (remainingMandates.length > 0) {
          await bot.sendMessage(
            chatId,
            `You still have ${remainingMandates.length} active alert${remainingMandates.length > 1 ? 's' : ''}.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📋 View Alerts', callback_data: 'menu_list' }
                  ],
                  [
                    { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
                  ]
                ]
              }
            }
          );
        } else {
          await bot.sendMessage(
            chatId,
            `You don't have any active alerts. Create a new one to start receiving opportunities!`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '➕ Create Alert', callback_data: 'menu_create' }
                  ],
                  [
                    { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
                  ]
                ]
              }
            }
          );
        }
      } catch (error) {
        console.error('Error deleting mandate:', error);
        await bot.sendMessage(chatId, '❌ Error deleting alert. Please try again.');
      }
      return;
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

      // Look up pool details to get chain ID
      const pool = await db.getCachedPoolByAddress(poolAddress);
      const chainId = pool?.chain_id || 1; // Default to Ethereum if not found

      await bot.sendMessage(
        chatId,
        `🔐 *Transaction Prepared*\n\n` +
        `Pool: \`${poolAddress}\`\n` +
        `Wallet: \`${user.wallet_address}\`\n\n` +
        `To proceed, visit:\nhttps://app.gearbox.finance/pools/${chainId}/${poolAddress}\n\n` +
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
// COMMAND: /list (View user's alerts)
// ==========================================

bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await db.getOrCreateUser(chatId);
    const mandates = await db.getUserMandates(user.id);

    if (mandates.length === 0) {
      await bot.sendMessage(
        chatId,
        `You don't have any active alerts yet.\n\nUse /create to set one up! 🚀`
      );
      return;
    }

    const mandatesList = mandates
      .map((m, i) => {
        const status = m.signed ? '✅ Active' : '⏸️ Draft';
        return (
          `${i + 1}. *${m.asset}* - Min ${m.min_apy}% APY\n` +
          `   Risk: ${m.risk}\n` +
          `   Status: ${status}`
        );
      })
      .join('\n\n');

    await bot.sendMessage(
      chatId,
      `📋 *Your Active Alerts:*\n\n${mandatesList}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in /list:', error);
    await bot.sendMessage(chatId, '❌ Error fetching alerts.');
  }
});

// ==========================================
// COMMAND: /opportunities (Check current yields)
// ==========================================

bot.onText(/\/opportunities/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await db.getOrCreateUser(chatId);
    const mandates = await db.getUserMandates(user.id);

    if (mandates.length === 0) {
      await bot.sendMessage(
        chatId,
        `📋 *No Active Alerts*\n\n` +
        `You need to create an alert first to see matching opportunities!\n\n` +
        `Use /create to set up your first alert.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await bot.sendMessage(chatId, `🔍 Scanning opportunities for your ${mandates.length} alert${mandates.length > 1 ? 's' : ''}...`);

    let hasResults = false;
    let responseText = `💎 *Opportunities Matching Your Alerts:*\n\n`;

    // Query opportunities for each mandate
    for (const mandate of mandates) {
      const opportunities = await queryFarmOpportunities({
        asset: mandate.asset,
        min_apy: mandate.min_apy
      });

      if (opportunities && opportunities.length > 0) {
        hasResults = true;
        const top3 = opportunities.slice(0, 3);

        responseText += `📋 *${mandate.asset}* (${mandate.min_apy}%+ APY)\n`;

        top3.forEach((opp, i) => {
          responseText += `${i + 1}. ${opp.pool_name || opp.strategy}\n`;
          responseText += `   📈 ${(opp.projAPY || opp.apy).toFixed(2)}% APY\n`;
          responseText += `   🌐 ${opp.chain}\n`;
        });

        responseText += `\n`;
      } else {
        responseText += `📋 *${mandate.asset}* (${mandate.min_apy}%+ APY)\n`;
        responseText += `   No pools found meeting criteria\n\n`;
      }
    }

    if (!hasResults) {
      await bot.sendMessage(
        chatId,
        `❌ No opportunities found matching any of your alerts.\n\n` +
        `Try lowering your minimum APY requirements or checking different assets.`
      );
    } else {
      await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
    }

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

    // THE AWE MOMENT: Show loading state
    await bot.sendMessage(
      chatId,
      `🔍 *Analyzing ${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}*\n\n` +
      `Checking balances across Ethereum and Plasma...`,
      { parse_mode: 'Markdown' }
    );

    // Scan for positions (existing feature)
    let positions = [];
    try {
      positions = await scanWalletPositions(walletAddress);
      if (positions.length > 0) {
        for (const position of positions) {
          await db.createOrUpdatePosition(user.id, position);
        }
      }
    } catch (scanError) {
      console.error('Error scanning positions:', scanError.message);
    }

    // NEW: Analyze wallet for token holdings
    try {
      const walletAnalysis = await analyzeWalletHoldings(walletAddress);

      if (walletAnalysis.gearboxCompatible.length === 0) {
        // No compatible tokens found
        await bot.sendMessage(
          chatId,
          `⚠️ *No Compatible Tokens Found*\n\n` +
          `Your wallet doesn't contain Gearbox-supported tokens.\n\n` +
          `*Supported tokens:*\n` +
          `• Stablecoins: USDC, USDT, DAI, GHO, sUSDe, USDT0\n` +
          `• ETH variants: WETH, wstETH\n` +
          `• Others: WBTC\n\n` +
          `━━━━━━━━━━━━━━━━━━━`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚙️ Set Up Manual Alerts', callback_data: 'onboard_manual' }
                ],
                [
                  { text: '📚 Learn About Gearbox', url: 'https://gearbox.finance' }
                ]
              ]
            }
          }
        );
        return;
      }

      // AWE MOMENT: Show detected tokens with USD values
      let tokensText = '';
      for (const token of walletAnalysis.gearboxCompatible) {
        const emoji = token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI' ? '💰' :
                      token.symbol === 'wstETH' ? '🌊' :
                      token.symbol === 'WETH' || token.symbol === 'ETH' ? '💎' :
                      token.symbol === 'WBTC' ? '₿' : '🪙';
        tokensText += `${emoji} ${parseFloat(token.balance).toFixed(2)} ${token.symbol} ($${token.valueUSD.toFixed(0)})\n`;
      }

      // Fetch current best rates for detected assets
      const opportunityPreviews = await getOpportunityPreviews(walletAnalysis.suggestedAssets);

      let ratesText = '';
      if (opportunityPreviews.previews.length > 0) {
        for (const preview of opportunityPreviews.previews) {
          if (preview.currentAPY) {
            const protocol = preview.protocol.includes('on') ? preview.protocol.split('on')[0].trim() : preview.protocol;
            ratesText += `${preview.asset} → ${preview.currentAPY.toFixed(2)}% APY (${protocol})\n`;
          }
        }
      }

      const earningsText = opportunityPreviews.totalMonthlyEarnings > 0
        ? `💡 *Potential: ~$${opportunityPreviews.totalMonthlyEarnings.toFixed(2)}/month passive income*`
        : '';

      await bot.sendMessage(
        chatId,
        `✨ *Your Portfolio*\n\n` +
        tokensText +
        `\n*Total: $${walletAnalysis.totalValueUSD.toFixed(0)} in DeFi-ready assets*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        (ratesText ? `📊 *Best Available Rates Right Now*\n\n${ratesText}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        earningsText +
        (earningsText ? `\n\nWant alerts when rates like these appear?` : `Ready to monitor these assets?`),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Yes, Monitor These', callback_data: `activate_smart_alerts_${user.id}` }
              ],
              [
                { text: '⚙️ Customize First', callback_data: 'onboard_manual' }
              ]
            ]
          }
        }
      );

      // Store wallet analysis in session for smart alert creation
      global.walletSessions = global.walletSessions || new Map();
      global.walletSessions.set(chatId, {
        analysis: walletAnalysis,
        opportunityPreviews: opportunityPreviews
      });

      // Show positions if found
      if (positions.length > 0) {
        const totalValue = positions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
        await bot.sendMessage(
          chatId,
          `\n🎊 *Active Positions Detected!*\n\n` +
          `Found ${positions.length} active Gearbox position(s) worth $${totalValue.toFixed(2)}\n\n` +
          `✅ Position tracking auto-enabled\n` +
          `🔔 I'll alert you on APY changes\n\n` +
          `Use /positions to view details`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (analysisError) {
      console.error('Error analyzing wallet:', analysisError.message);
      await bot.sendMessage(
        chatId,
        `⚠️ Wallet connected, but analysis failed.\n\n` +
        `You can still set up alerts manually:\n/create`,
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
    `/create - Create new yield alert\n` +
    `/list - View your active alerts\n` +
    `/positions - View your active positions\n` +
    `/opportunities - Check current top yields\n` +
    `/wallet [address] - Connect/view wallet\n` +
    `/stats - View notification stats\n` +
    `/help - Show this help message\n\n` +
    `*How it works:*\n` +
    `1. Create an alert with your criteria\n` +
    `2. Bot monitors Gearbox every 15 minutes\n` +
    `3. Get alerts when yields match your criteria\n` +
    `4. Connect your wallet to track positions\n` +
    `5. Get alerts for APY changes\n\n` +
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
            { text: '➕ Create Alert', callback_data: 'menu_create' },
            { text: '📋 My Alerts', callback_data: 'menu_list' }
          ],
          [
            { text: '💼 My Positions', callback_data: 'menu_positions' },
            { text: '💎 Opportunities', callback_data: 'menu_opportunities' }
          ],
          [
            { text: '💳 Wallet', callback_data: 'menu_wallet' },
            { text: '📊 Stats', callback_data: 'menu_stats' }
          ],
          [
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

// ==========================================
// HELPER: Setup "All Assets" Mandate (Manual Flow)
// ==========================================

async function setupAllAssetsMandate(chatId, strategy) {
  try {
    const user = await db.getOrCreateUser(chatId);

    const strategies = {
      'conservative': {
        asset: 'ALL',
        minAPY: 3.0,
        risk: 'Low',
        maxLeverage: 1,
        maxPosition: 50000
      },
      'balanced': {
        asset: 'ALL',
        minAPY: 5.0,
        risk: 'Medium',
        maxLeverage: 1,
        maxPosition: 50000
      },
      'aggressive': {
        asset: 'ALL',
        minAPY: 10.0,
        risk: 'High',
        maxLeverage: 1,
        maxPosition: 50000
      }
    };

    const mandate = strategies[strategy];
    if (!mandate) return;

    const createdMandate = await db.createMandate(user.id, mandate);
    await db.signMandate(createdMandate.id);

    await bot.sendMessage(
      chatId,
      `🎉 *${strategy.charAt(0).toUpperCase() + strategy.slice(1)} Strategy Activated!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ Monitoring ALL assets (USDC, wstETH, WETH, WBTC, etc.)\n` +
      `✅ Minimum ${mandate.minAPY}% APY\n` +
      `✅ ${mandate.risk} risk tolerance\n` +
      `⏰ Scanning every 15 minutes\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `You'll get alerts for ANY pool meeting your criteria!`,
      { parse_mode: 'Markdown' }
    );

    // Trigger immediate scan to show opportunities
    await bot.sendMessage(
      chatId,
      `🔍 Running first scan now...`,
      { parse_mode: 'Markdown' }
    );

    // Show current opportunities
    try {
      const opportunities = await queryFarmOpportunities({
        asset: 'ALL',
        min_apy: mandate.minAPY
      });

      if (opportunities && opportunities.length > 0) {
        // Sort by APY
        opportunities.sort((a, b) => (b.projAPY || b.apy) - (a.projAPY || a.apy));

        // Show top 2 opportunities
        const topOpps = opportunities.slice(0, 2);

        await bot.sendMessage(
          chatId,
          `✨ *Found ${opportunities.length} opportunities right now!*\n\n` +
          `Here are the top 2:\n\n` +
          `━━━━━━━━━━━━━━━━━━━`,
          { parse_mode: 'Markdown' }
        );

        for (const opp of topOpps) {
          const apy = opp.projAPY || opp.apy || 0;
          const poolHealth = opp.utilization >= 95 ? '🔴' : opp.utilization >= 80 ? '🟡' : '🟢';

          await bot.sendMessage(
            chatId,
            `${poolHealth} *${opp.underlying_token || opp.underlyingToken} Opportunity*\n\n` +
            `📍 ${opp.strategy || opp.pool_name}\n` +
            `🌐 ${opp.chain}\n\n` +
            `💵 *${apy.toFixed(2)}% APY*\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n\n` +
            `_Not financial advice. DeFi carries smart contract risk._`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🚀 Deposit Now', url: `https://app.gearbox.finance/pools/${opp.chain_id}/${opp.pool_address}` }
                  ]
                ]
              }
            }
          );
        }
      }
    } catch (oppError) {
      console.error('Error showing opportunities:', oppError.message);
    }

    await showMainMenu(chatId);
  } catch (error) {
    console.error('Error setting up all assets mandate:', error);
    await bot.sendMessage(chatId, '❌ Error setting up mandate. Please try again.');
  }
}

module.exports = bot;

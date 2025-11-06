/**
 * /invest command - Progressive investment flow
 * Step 1: Choose goal (Maximize Growth / Balanced / Safety First)
 * Step 2: Select pool & enter amount
 * Step 3: Review & confirm
 * Step 4: WalletConnect transaction
 */

const db = require('../database');
const walletconnect = require('../services/walletconnect');
const transactionService = require('../services/transaction-service');
const confirmation = require('../utils/confirmation');

/**
 * Filter pools by risk tier
 * @param {Array} pools - All pools
 * @param {string} riskTier - 'maximize' | 'balanced' | 'safety'
 * @returns {Array} Filtered pools
 */
function filterPoolsByRisk(pools, riskTier) {
  // Sort by APY descending
  const sorted = pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));

  if (riskTier === 'maximize') {
    // Top 30% highest APY pools
    const count = Math.max(3, Math.ceil(sorted.length * 0.3));
    return sorted.slice(0, count);
  } else if (riskTier === 'balanced') {
    // Middle 40% APY pools
    const skipCount = Math.ceil(sorted.length * 0.3);
    const takeCount = Math.max(3, Math.ceil(sorted.length * 0.4));
    return sorted.slice(skipCount, skipCount + takeCount);
  } else if (riskTier === 'safety') {
    // Bottom 30% lowest APY pools (safest)
    const count = Math.max(3, Math.ceil(sorted.length * 0.3));
    return sorted.slice(-count).reverse();
  }

  return sorted;
}

/**
 * Get chain name from chain ID
 */
function getChainName(chainId) {
  const chains = {
    1: 'Ethereum',
    42161: 'Arbitrum',
    10: 'Optimism',
    146: 'Sonic',
    9745: 'Plasma',
  };
  return chains[chainId] || `Chain ${chainId}`;
}

/**
 * Start /lend command
 */
async function handleInvestCommand(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const message = `What's your goal?

📈 *Maximize Yield* - Highest APY pools
⚖️ *Balanced* - Stable mid-tier pools
🛡️ *Conservative* - Proven, lower-risk pools`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📈 Maximize Growth', callback_data: 'invest_goal_maximize' }],
          [{ text: '⚖️ Balanced Returns', callback_data: 'invest_goal_balanced' }],
          [{ text: '🛡️ Safety First', callback_data: 'invest_goal_safety' }],
        ],
      },
    });
  } catch (error) {
    console.error('❌ Error in /invest command:', error);
    await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
  }
}

/**
 * Handle goal selection
 */
async function handleGoalSelection(bot, chatId, goal, sessions) {
  try {
    // Get all active pools
    const pools = await db.getCachedPools(true);

    if (!pools || pools.length === 0) {
      await bot.sendMessage(
        chatId,
        '❌ No pools available at the moment. Please try again later.'
      );
      return;
    }

    // Filter by risk tier
    const filteredPools = filterPoolsByRisk(pools, goal);

    // Store in session
    sessions.set(chatId, {
      step: 'select_pool',
      goal,
      availablePools: filteredPools,
    });

    // Build pool selection message
    const goalTitles = {
      maximize: '📈 High-Yield Pools (Maximize Growth)',
      balanced: '⚖️ Mid-Tier Pools (Balanced Returns)',
      safety: '🛡️ Conservative Pools (Safety First)',
    };

    let message = `${goalTitles[goal]}\n\n`;
    message += `Select a pool to deposit into:\n\n`;

    // Show top 6 pools
    const displayPools = filteredPools.slice(0, 6);
    const keyboard = [];

    displayPools.forEach((pool, index) => {
      const chainName = getChainName(pool.chain_id);
      const apy = pool.apy ? pool.apy.toFixed(2) : 'N/A';
      const tvl = pool.tvl ? `$${(pool.tvl / 1_000_000).toFixed(1)}M` : 'N/A';

      message += `${index + 1}. *${pool.pool_name}* (${chainName})\n`;
      message += `   APY: ${apy}% | TVL: ${tvl}\n`;
      message += `   Token: ${pool.underlying_token}\n\n`;

      keyboard.push([
        {
          text: `${index + 1}. ${pool.pool_name} - ${apy}%`,
          callback_data: `invest_pool_${index}`,
        },
      ]);
    });

    keyboard.push([{ text: '← Back to Goals', callback_data: 'invest_back_to_goals' }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    console.error('❌ Error handling goal selection:', error);
    await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
  }
}

/**
 * Handle pool selection
 */
async function handlePoolSelection(bot, chatId, poolIndex, sessions) {
  try {
    const session = sessions.get(chatId);
    if (!session || !session.availablePools) {
      await bot.sendMessage(chatId, '❌ Session expired. Please start again with /invest');
      return;
    }

    const selectedPool = session.availablePools[poolIndex];
    if (!selectedPool) {
      await bot.sendMessage(chatId, '❌ Invalid pool selection.');
      return;
    }

    // Update session
    sessions.set(chatId, {
      ...session,
      step: 'enter_amount',
      selectedPool,
    });

    const chainName = getChainName(selectedPool.chain_id);
    const apy = selectedPool.apy ? selectedPool.apy.toFixed(2) : 'N/A';

    const message = `✅ *${selectedPool.pool_name}* (${chainName})
APY: ${apy}% | Token: ${selectedPool.underlying_token}

💰 *How much ${selectedPool.underlying_token} do you want to deposit?*

Enter amount or use quick select:`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '0.1', callback_data: 'invest_amount_0.1' },
            { text: '0.5', callback_data: 'invest_amount_0.5' },
            { text: '1.0', callback_data: 'invest_amount_1.0' },
          ],
          [
            { text: '2.0', callback_data: 'invest_amount_2.0' },
            { text: '5.0', callback_data: 'invest_amount_5.0' },
          ],
          [{ text: '✍️ Enter Custom Amount', callback_data: 'invest_amount_custom' }],
          [{ text: '← Back to Pools', callback_data: 'invest_back_to_pools' }],
        ],
      },
    });
  } catch (error) {
    console.error('❌ Error handling pool selection:', error);
    await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
  }
}

/**
 * Handle amount selection - INSTANT QR CODE (no confirmation screens)
 */
async function handleAmountSelection(bot, chatId, amount, sessions) {
  try {
    const session = sessions.get(chatId);
    if (!session || !session.selectedPool) {
      await bot.sendMessage(chatId, 'Session expired. Try /lend again.');
      return;
    }

    const pool = session.selectedPool;
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      await bot.sendMessage(chatId, 'Enter a valid amount.');
      return;
    }

    // Update session
    sessions.set(chatId, {
      ...session,
      step: 'executing',
      amount: amount,
    });

    // INSTANT QR CODE - No confirmation screens
    await showQRCodeWithRecap(bot, chatId, sessions, pool, amount);

  } catch (error) {
    console.error('❌ Error handling amount selection:', error);
    await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
  }
}

/**
 * Handle custom amount input (from text message)
 */
async function handleCustomAmountInput(bot, chatId, amountText, sessions) {
  // Remove any non-numeric characters except decimal point
  const cleanAmount = amountText.replace(/[^\d.]/g, '');
  await handleAmountSelection(bot, chatId, cleanAmount, sessions);
}

/**
 * Execute deposit transaction
 */
async function executeDeposit(bot, chatId, sessions) {
  try {
    const session = sessions.get(chatId);
    if (!session || !session.selectedPool || !session.amount) {
      await bot.sendMessage(chatId, '❌ Session expired. Please start again with /invest');
      return;
    }

    const pool = session.selectedPool;
    const amount = session.amount;

    // Check WalletConnect session
    let wcSession;
    try {
      wcSession = await walletconnect.getActiveSession(chatId);
    } catch (sessionError) {
      // Session error (expired, invalid, "No matching key", etc.)
      // Disconnect and clear from database to allow fresh reconnection
      console.log('⚠️ Session error, clearing and reconnecting:', sessionError.message);
      await walletconnect.disconnectSession(chatId).catch(() => {});
      wcSession = null;
    }

    if (!wcSession) {
      await promptWalletConnect(bot, chatId, sessions);
      return;
    }

    // Validate chain is supported in WalletConnect session
    const sessionChains = wcSession.session?.namespaces?.eip155?.chains || [];
    const poolChainId = `eip155:${pool.chain_id}`;

    if (!sessionChains.includes(poolChainId)) {
      const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma' };
      const chainName = chainNames[pool.chain_id] || `Chain ${pool.chain_id}`;

      // Try to add the chain to wallet automatically
      try {
        await addChainToWallet(walletconnect, chatId, pool.chain_id);
        await bot.sendMessage(chatId, `✅ ${chainName} network added to your wallet. Continuing...`);
        // Don't return - continue with transaction
      } catch (addChainError) {
        console.log('❌ Failed to add chain to wallet:', addChainError.message);

        await bot.sendMessage(
          chatId,
          `⚠️ *Chain Not Supported*\n\n` +
          `Your wallet doesn't support ${chainName} (chain ${pool.chain_id}).\n\n` +
          `Approved chains: ${sessionChains.join(', ')}\n\n` +
          `💡 *Solution:* Manually add ${chainName} network to your wallet:\n` +
          `• Chain ID: ${pool.chain_id}\n` +
          `• Name: ${chainName}\n\n` +
          `Then use /invest to try again.`,
          { parse_mode: 'Markdown' }
        );

        // Clear session to allow reconnection
        sessions.delete(chatId);
        await walletconnect.disconnectSession(chatId).catch(() => {});
        return;
      }
    }

    await bot.sendMessage(chatId, '⏳ Preparing transaction...');

    try {
      // Get the actual underlying token address from the pool contract
      const { getClient } = require('../utils/blockchain');
      const client = getClient(pool.chain_id);

      const tokenAddress = await client.readContract({
        address: pool.pool_address,
        abi: [
          {
            name: 'asset',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }],
          },
        ],
        functionName: 'asset',
      });

      console.log(`✅ Fetched token address from pool: ${tokenAddress}`);

      // Execute deposit via transaction service
      const result = await transactionService.executeDeposit({
        chatId,
        poolAddress: pool.pool_address,
        tokenAddress: tokenAddress, // Use actual token address, not symbol
        amount: amount,
        chainId: pool.chain_id,
        referralCode: 0,
      });

      if (result.error) {
        // Clear both invest session AND WalletConnect session to allow fresh reconnection
        sessions.delete(chatId);
        await walletconnect.disconnectSession(chatId).catch(() => {}); // Disconnect WC session

        let errorMsg = `❌ *Transaction Failed*\n\n${result.error}`;

        // Add helpful context for common errors
        if (result.error.includes('Insufficient balance')) {
          errorMsg += `\n\n💡 *Tip:* Make sure your wallet has ${amount} ${pool.underlying_token} on ${getChainName(pool.chain_id)} chain.`;
          errorMsg += `\n\nUse /invest again to connect a different wallet.`;
        }

        await bot.sendMessage(chatId, errorMsg, {
          parse_mode: 'Markdown',
        });
        return;
      }

      // Success! Save position to database immediately
      const user = await db.getOrCreateUser(chatId);

      // Create or update position in database (using camelCase for database.js)
      const positionData = {
        poolAddress: pool.pool_address,
        chainId: pool.chain_id,
        underlyingToken: tokenAddress,
        shares: parseFloat(result.shares || '0'),
        depositedAmount: parseFloat(amount),
        currentValue: parseFloat(amount), // Initial value = deposited amount
        initialSupplyAPY: pool.apy || 0,
        currentSupplyAPY: pool.apy || 0,
        initialBorrowAPY: null,
        currentBorrowAPY: null,
        netAPY: pool.apy || 0,
        leverage: 1, // Lending pools have no leverage
        healthFactor: null,
      };

      await db.createOrUpdatePosition(user.id, positionData);
      console.log(`✅ Position saved to database for user ${user.id}`);

      // Build success message with link to manage position
      const manageUrl = `https://app.gearbox.finance/pools/${pool.chain_id}/${pool.pool_address}`;

      // Clean, succinct success message
      let successMessage = `✅ Deposited *${amount} ${pool.underlying_token}*\n\n`;
      successMessage += `Pool: ${pool.pool_name} (${pool.apy?.toFixed(2) || '—'}% APY)\n`;
      if (result.shares) {
        successMessage += `Shares: ${result.shares}\n`;
      }
      if (result.depositTxHash) {
        const shortTx = `${result.depositTxHash.slice(0, 10)}...${result.depositTxHash.slice(-8)}`;
        successMessage += `Tx: ${shortTx}\n`;
      }
      successMessage += `\n[Manage Position](${manageUrl})`;

      await bot.sendMessage(chatId, successMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      // Clear session
      sessions.delete(chatId);
    } catch (error) {
      console.error('❌ Transaction execution error:', error);
      await bot.sendMessage(
        chatId,
        `❌ *Transaction Failed*\n\n${error.message || 'Unknown error'}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('❌ Error executing deposit:', error);
    await bot.sendMessage(chatId, '❌ An error occurred during transaction.');
  }
}

/**
 * Execute deposit silently (no status messages)
 */
async function executeDepositSilent(bot, chatId, sessions) {
  try {
    const session = sessions.get(chatId);
    if (!session || !session.selectedPool || !session.amount) {
      await bot.sendMessage(chatId, 'Session expired. Try /invest again.');
      return;
    }

    const pool = session.selectedPool;
    const amount = session.amount;

    // Check WalletConnect session
    let wcSession;
    try {
      wcSession = await walletconnect.getActiveSession(chatId);
    } catch (sessionError) {
      console.log('⚠️ Session error:', sessionError.message);
      wcSession = null;
    }

    if (!wcSession) {
      await bot.sendMessage(chatId, 'Connection lost. Try /invest again.');
      return;
    }

    // Validate chain
    const sessionChains = wcSession.session?.namespaces?.eip155?.chains || [];
    const poolChainId = `eip155:${pool.chain_id}`;

    if (!sessionChains.includes(poolChainId)) {
      const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma' };
      const chainName = chainNames[pool.chain_id] || pool.chain_id;

      await bot.sendMessage(chatId, `Your wallet doesn't support ${chainName}. Add it and try again.`);
      sessions.delete(chatId);
      await walletconnect.disconnectSession(chatId).catch(() => {});
      return;
    }

    // Execute (no "preparing..." message)
    try {
      const { getClient } = require('../utils/blockchain');
      const client = getClient(pool.chain_id);

      const tokenAddress = await client.readContract({
        address: pool.pool_address,
        abi: [{ name: 'asset', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
        functionName: 'asset',
      });

      const result = await transactionService.executeDeposit({
        chatId,
        poolAddress: pool.pool_address,
        tokenAddress: tokenAddress,
        amount: amount,
        chainId: pool.chain_id,
        referralCode: 0,
      });

      if (result.error) {
        sessions.delete(chatId);
        await walletconnect.disconnectSession(chatId).catch(() => {});

        if (result.error.includes('Insufficient balance')) {
          await bot.sendMessage(chatId, `Insufficient ${pool.underlying_token} balance. Try /invest with a funded wallet.`);
        } else {
          await bot.sendMessage(chatId, `Transaction failed: ${result.error}`);
        }
        return;
      }

      // Save position
      const user = await db.getOrCreateUser(chatId);
      await db.createOrUpdatePosition(user.id, {
        poolAddress: pool.pool_address,
        chainId: pool.chain_id,
        underlyingToken: tokenAddress,
        shares: parseFloat(result.shares || '0'),
        depositedAmount: parseFloat(amount),
        currentValue: parseFloat(amount),
        initialSupplyAPY: pool.apy || 0,
        currentSupplyAPY: pool.apy || 0,
        initialBorrowAPY: null,
        currentBorrowAPY: null,
        netAPY: pool.apy || 0,
        leverage: 1,
        healthFactor: null,
      });

      // Succinct success message
      const manageUrl = `https://app.gearbox.finance/pools/${pool.chain_id}/${pool.pool_address}`;
      const shortTx = result.depositTxHash ? `${result.depositTxHash.slice(0, 10)}...${result.depositTxHash.slice(-8)}` : '';

      await bot.sendMessage(chatId,
        `✅ Deposited *${amount} ${pool.underlying_token}*\n\n` +
        `${pool.pool_name} (${pool.apy?.toFixed(2) || '—'}% APY)\n` +
        `Shares: ${result.shares || '—'}\n` +
        (shortTx ? `Tx: ${shortTx}\n` : '') +
        `\n[Manage Position](${manageUrl})`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );

      sessions.delete(chatId);

    } catch (error) {
      console.error('❌ Transaction error:', error);
      await bot.sendMessage(chatId, 'Transaction failed. Try /invest again.');
    }
  } catch (error) {
    console.error('❌ Execute error:', error);
    await bot.sendMessage(chatId, 'Execution error. Try /invest again.');
  }
}

/**
 * Add chain to user's wallet via WalletConnect
 */
async function addChainToWallet(walletconnectService, chatId, chainId) {
  const chainConfigs = {
    9745: {
      chainId: '0x2611', // 9745 in hex
      chainName: 'Plasma',
      nativeCurrency: { name: 'Plasma', symbol: 'PLM', decimals: 18 },
      rpcUrls: ['https://rpc.plasm.io'],
      blockExplorerUrls: ['https://plasma.blockscout.com'],
    },
    146: {
      chainId: '0x92', // 146 in hex
      chainName: 'Sonic',
      nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
      rpcUrls: ['https://rpc.sonic.network'],
      blockExplorerUrls: ['https://sonicscan.org'],
    },
  };

  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`No config for chain ${chainId}`);
  }

  // Send wallet_addEthereumChain request
  const session = await walletconnectService.getActiveSession(chatId);
  if (!session) {
    throw new Error('No active session');
  }

  const signClient = walletconnectService.getSignClient();
  if (!signClient) {
    await walletconnectService.initializeWalletConnect();
  }

  const client = walletconnectService.getSignClient();

  await client.request({
    topic: session.topic,
    chainId: `eip155:1`, // Send from Ethereum namespace
    request: {
      method: 'wallet_addEthereumChain',
      params: [config],
    },
  });
}

/**
 * Prompt user to connect wallet via WalletConnect
 */
async function promptWalletConnect(bot, chatId, sessions) {
  try {
    const message = `🔗 *Connect Your Wallet*

You need to connect your wallet to sign transactions.

Choose how you want to connect:`;

    // Show connection method choice
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Scan QR Code (Desktop)', callback_data: 'invest_connect_qr' }],
          [{ text: '🔗 Open Wallet App (Mobile)', callback_data: 'invest_connect_deeplink' }],
          [{ text: '❌ Cancel', callback_data: 'invest_cancel' }],
        ],
      },
    });
  } catch (error) {
    console.error('❌ Error prompting WalletConnect:', error);
    await bot.sendMessage(chatId, '❌ Failed to initiate wallet connection.');
  }
}

/**
 * Show QR code with transaction recap (INSTANT, no confirmation screens)
 */
async function showQRCodeWithRecap(bot, chatId, sessions, pool, amount) {
  try {
    const session = sessions.get(chatId);

    // Create WalletConnect session for the pool's chain
    const user = await db.getOrCreateUser(chatId);
    const { uri, approval } = await walletconnect.createSession(chatId, pool.chain_id);

    // Store approval promise in session
    sessions.set(chatId, {
      ...session,
      walletConnectApproval: approval,
    });

    // Generate QR code as buffer
    const QRCode = require('qrcode');
    const qrBuffer = await QRCode.toBuffer(uri, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 400,
      margin: 2,
    });

    const chainNames = { 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism', 146: 'Sonic', 9745: 'Plasma' };
    const chainName = chainNames[pool.chain_id] || pool.chain_id;

    // Send QR code with minimal recap
    await bot.sendPhoto(chatId, qrBuffer, {
      caption: `Depositing *${amount} ${pool.underlying_token}*
${pool.pool_name} • ${chainName} • ${pool.apy?.toFixed(2) || '—'}% APY

Scan with your wallet to confirm`,
      parse_mode: 'Markdown',
    });

    // Deep link buttons as fallback (under QR)
    const metamaskLink = walletconnect.getDeepLink(uri, 'metamask');
    const rabbyLink = walletconnect.getDeepLink(uri, 'rabby');
    const rainbowLink = walletconnect.getDeepLink(uri, 'rainbow');

    await bot.sendMessage(chatId, `On mobile? Tap to open:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🦊 MetaMask', url: metamaskLink },
            { text: '🐰 Rabby', url: rabbyLink },
            { text: '🌈 Rainbow', url: rainbowLink },
          ],
          [{ text: '❌ Cancel', callback_data: 'invest_cancel' }],
        ],
      },
    });

    // Silent execution after approval (no spam messages)
    await waitForWalletApprovalSilent(bot, chatId, sessions);

  } catch (error) {
    console.error('❌ Error showing QR code:', error);
    await bot.sendMessage(chatId, '❌ Connection failed. Try /invest again.');
  }
}

/**
 * Show deep links for mobile wallet apps
 */
async function showDeepLinks(bot, chatId, sessions) {
  try {
    await bot.sendMessage(chatId, '⏳ Generating connection links...');

    const session = sessions.get(chatId);
    if (!session || !session.selectedPool) {
      throw new Error('No pool selected in session');
    }

    // Create WalletConnect session for the pool's chain
    const user = await db.getOrCreateUser(chatId);
    const { uri, approval } = await walletconnect.createSession(chatId, session.selectedPool.chain_id);

    // Store approval promise in session (we'll need to wait for it)
    sessions.set(chatId, {
      ...sessions.get(chatId),
      walletConnectApproval: approval,
    });

    // Generate deep links
    const metamaskLink = walletconnect.getDeepLink(uri, 'metamask');
    const rainbowLink = walletconnect.getDeepLink(uri, 'rainbow');
    const rabbyLink = walletconnect.getDeepLink(uri, 'rabby');
    const trustLink = walletconnect.getDeepLink(uri, 'trust');
    const wcLink = walletconnect.getDeepLink(uri, 'walletconnect');

    const message = `🔗 *Tap to Open Your Wallet*

Choose your wallet app:`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🦊 MetaMask', url: metamaskLink }],
          [{ text: '🐰 Rabby', url: rabbyLink }],
          [{ text: '🌈 Rainbow', url: rainbowLink }],
          [{ text: '💼 Trust Wallet', url: trustLink }],
          [{ text: '🔗 Other Wallets', url: wcLink }],
          [{ text: '❌ Cancel', callback_data: 'invest_cancel' }],
        ],
      },
    });

    // Wait for approval
    await waitForWalletApproval(bot, chatId, sessions);
  } catch (error) {
    console.error('❌ Error showing deep links:', error);
    await bot.sendMessage(chatId, '❌ Failed to generate connection links. Please try again.');
  }
}

/**
 * Wait for wallet approval and execute transaction SILENTLY (no spam messages)
 */
async function waitForWalletApprovalSilent(bot, chatId, sessions) {
  try {
    const session = sessions.get(chatId);
    if (!session || !session.walletConnectApproval) {
      throw new Error('No approval promise in session');
    }

    const timeout = setTimeout(() => {
      bot.sendMessage(chatId, 'Connection timeout. Try /invest again.');
    }, 120_000); // 2 minute timeout

    try {
      const sessionData = await session.walletConnectApproval;
      clearTimeout(timeout);

      // Execute transaction silently (no "preparing..." messages)
      await executeDepositSilent(bot, chatId, sessions);

    } catch (error) {
      clearTimeout(timeout);
      console.error('❌ WalletConnect approval error:', error);
      await bot.sendMessage(chatId, 'Connection failed. Try /invest again.');
    }
  } catch (error) {
    console.error('❌ Error waiting for wallet approval:', error);
    await bot.sendMessage(chatId, 'Connection error. Try /invest again.');
  }
}

module.exports = {
  handleInvestCommand,
  handleGoalSelection,
  handlePoolSelection,
  handleAmountSelection,
  handleCustomAmountInput,
  executeDeposit,
  executeDepositSilent,
  showQRCodeWithRecap,
};

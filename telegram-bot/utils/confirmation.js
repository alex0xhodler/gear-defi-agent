/**
 * Smart confirmation logic for transactions
 * Amount-based tiers to reduce friction for small amounts
 */

/**
 * Get confirmation flow type based on token amount
 * @param {number} amount - Token amount (human-readable)
 * @returns {string} Confirmation type: 'ONE_TAP' | 'TWO_STEP'
 */
function getConfirmationFlow(amount) {
  // Small amounts (<1 token): Single confirmation
  if (amount < 1) {
    return 'ONE_TAP';
  }

  // Medium/Large amounts (≥1 token): Two-step confirmation
  return 'TWO_STEP';
}

/**
 * Generate confirmation message for deposit
 * @param {Object} params - Deposit parameters
 * @returns {Object} Message text and inline keyboard
 */
function generateDepositConfirmation({
  poolName,
  poolChain,
  tokenSymbol,
  amount,
  apy,
  estimatedGas,
  confirmationType = 'ONE_TAP',
}) {
  // Calculate estimated earnings
  const thirtyDayEarnings = (parseFloat(amount) * (parseFloat(apy) / 100) * (30 / 365)).toFixed(6);
  const ninetyDayEarnings = (parseFloat(amount) * (parseFloat(apy) / 100) * (90 / 365)).toFixed(6);
  const yearlyEarnings = (parseFloat(amount) * (parseFloat(apy) / 100)).toFixed(6);

  const message = `📋 *Review Your Deposit*

*Pool:* ${poolName} (${poolChain})
*Amount:* ${amount} ${tokenSymbol}
*Current APY:* ${apy}%

📊 *Estimated Earnings:*
• 30 days: ~${thirtyDayEarnings} ${tokenSymbol}
• 90 days: ~${ninetyDayEarnings} ${tokenSymbol}
• 365 days: ~${yearlyEarnings} ${tokenSymbol}

⛽ *Gas Fee:* ~${estimatedGas} ETH`;

  let keyboard;

  if (confirmationType === 'ONE_TAP') {
    keyboard = {
      inline_keyboard: [
        [{ text: '✅ Confirm Deposit', callback_data: 'invest_confirm' }],
        [{ text: '← Back', callback_data: 'invest_back_to_amount' }],
      ],
    };
  } else {
    // TWO_STEP: Show initial review, require second confirmation
    keyboard = {
      inline_keyboard: [
        [{ text: '👀 Review & Confirm', callback_data: 'invest_review_confirm' }],
        [{ text: '← Back', callback_data: 'invest_back_to_amount' }],
      ],
    };
  }

  return { message, keyboard };
}

/**
 * Generate second confirmation step (for TWO_STEP flow)
 * @param {Object} params - Deposit parameters
 * @returns {Object} Message text and inline keyboard
 */
function generateSecondConfirmation({
  poolName,
  amount,
  tokenSymbol,
}) {
  const message = `⚠️ *Final Confirmation*

You are about to deposit *${amount} ${tokenSymbol}* into *${poolName}*.

This transaction will be sent to your wallet for signing via WalletConnect.

✓ Make sure you have enough ETH for gas fees
✓ Your wallet will show the full transaction details
✓ You can reject in your wallet if something looks wrong`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Yes, Execute Transaction', callback_data: 'invest_execute' }],
      [{ text: '❌ Cancel', callback_data: 'invest_cancel' }],
    ],
  };

  return { message, keyboard };
}

/**
 * Generate confirmation message for withdrawal
 * @param {Object} params - Withdrawal parameters
 * @returns {Object} Message text and inline keyboard
 */
function generateWithdrawConfirmation({
  poolName,
  poolChain,
  tokenSymbol,
  shares,
  expectedAssets,
  estimatedGas,
  confirmationType = 'ONE_TAP',
}) {
  const message = `📋 *Review Your Withdrawal*

*Pool:* ${poolName} (${poolChain})
*Shares to Burn:* ${shares}
*You'll Receive:* ~${expectedAssets} ${tokenSymbol}

⛽ *Gas Fee:* ~${estimatedGas} ETH

💡 *Note:* You can withdraw anytime without penalties`;

  let keyboard;

  if (confirmationType === 'ONE_TAP') {
    keyboard = {
      inline_keyboard: [
        [{ text: '✅ Confirm Withdrawal', callback_data: 'withdraw_confirm' }],
        [{ text: '← Back', callback_data: 'withdraw_cancel' }],
      ],
    };
  } else {
    keyboard = {
      inline_keyboard: [
        [{ text: '👀 Review & Confirm', callback_data: 'withdraw_review_confirm' }],
        [{ text: '← Back', callback_data: 'withdraw_cancel' }],
      ],
    };
  }

  return { message, keyboard };
}

/**
 * Generate second confirmation for withdrawal
 * @param {Object} params - Withdrawal parameters
 * @returns {Object} Message text and inline keyboard
 */
function generateWithdrawSecondConfirmation({
  poolName,
  expectedAssets,
  tokenSymbol,
}) {
  const message = `⚠️ *Final Confirmation*

You are about to withdraw *${expectedAssets} ${tokenSymbol}* from *${poolName}*.

This transaction will be sent to your wallet for signing via WalletConnect.`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Yes, Execute Withdrawal', callback_data: 'withdraw_execute' }],
      [{ text: '❌ Cancel', callback_data: 'withdraw_cancel' }],
    ],
  };

  return { message, keyboard };
}

module.exports = {
  getConfirmationFlow,
  generateDepositConfirmation,
  generateSecondConfirmation,
  generateWithdrawConfirmation,
  generateWithdrawSecondConfirmation,
};

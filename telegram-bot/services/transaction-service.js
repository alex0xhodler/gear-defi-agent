/**
 * Transaction service for Telegram bot
 * Coordinates transaction building, signing via WalletConnect, and monitoring
 */

const { buildDepositTransactions, buildWithdrawTransaction, parseSharesFromLogs, parseAssetsFromLogs } = require('../../utils/transaction-builder.cjs');
const { getClient } = require('../utils/blockchain');
const walletconnect = require('./walletconnect');
const db = require('../database');

/**
 * Execute deposit transaction
 * @param {number} chatId - Telegram chat ID
 * @param {Object} params - Deposit parameters
 * @returns {Promise<Object>} Transaction result
 */
async function executeDeposit({
  chatId,
  poolAddress,
  tokenAddress,
  amount,
  chainId,
  referralCode = 0,
}) {
  try {
    console.log(`💰 Executing deposit for chat ${chatId}`);

    // Step 1: Check WalletConnect session
    const session = await walletconnect.getActiveSession(chatId);
    if (!session) {
      throw new Error('No active WalletConnect session. Please connect your wallet first using /connect_wallet');
    }

    const userAddress = session.walletAddress;

    // Step 2: Get blockchain client
    const client = getClient(chainId);

    // Step 3: Build transactions
    console.log(`🔨 Building deposit transactions...`);
    const txBuilder = await buildDepositTransactions({
      client,
      poolAddress,
      tokenAddress,
      amount,
      userAddress,
      chainId,
      referralCode,
    });

    const results = {
      needsApproval: txBuilder.needsApproval,
      approvalTxHash: null,
      depositTxHash: null,
      shares: null,
      error: null,
    };

    // Step 4: Send approval transaction if needed
    if (txBuilder.needsApproval && txBuilder.approvalTx) {
      console.log(`🔐 Sending approval transaction...`);

      try {
        const approvalTxHash = await walletconnect.sendTransaction(chatId, txBuilder.approvalTx);
        results.approvalTxHash = approvalTxHash;

        // Track approval transaction
        await trackTransaction({
          chatId,
          txHash: approvalTxHash,
          txType: 'approval',
          chainId,
          tokenAddress,
          poolAddress,
          amount: amount.toString(),
        });

        console.log(`✅ Approval transaction sent: ${approvalTxHash}`);

        // Wait for approval to be confirmed
        console.log(`⏳ Waiting for approval confirmation...`);
        const approvalReceipt = await client.waitForTransactionReceipt({
          hash: approvalTxHash,
          timeout: 60_000, // 60 seconds
        });

        if (approvalReceipt.status !== 'success') {
          throw new Error('Approval transaction failed');
        }

        console.log(`✅ Approval confirmed`);
      } catch (error) {
        console.error(`❌ Approval failed:`, error);
        results.error = `Approval failed: ${error.message}`;
        return results;
      }
    }

    // Step 5: Send deposit transaction
    console.log(`💸 Sending deposit transaction...`);

    try {
      const depositTxHash = await walletconnect.sendTransaction(chatId, txBuilder.depositTx);
      results.depositTxHash = depositTxHash;

      // Track deposit transaction
      await trackTransaction({
        chatId,
        txHash: depositTxHash,
        txType: 'deposit',
        chainId,
        tokenAddress,
        poolAddress,
        amount: amount.toString(),
      });

      console.log(`✅ Deposit transaction sent: ${depositTxHash}`);

      // Wait for deposit confirmation
      console.log(`⏳ Waiting for deposit confirmation...`);
      const depositReceipt = await client.waitForTransactionReceipt({
        hash: depositTxHash,
        timeout: 60_000,
      });

      if (depositReceipt.status !== 'success') {
        throw new Error('Deposit transaction failed');
      }

      // Parse shares from logs
      try {
        const shares = parseSharesFromLogs(
          depositReceipt.logs,
          userAddress,
          txBuilder.tokenDecimals
        );
        results.shares = shares;
        console.log(`🎉 Deposit confirmed! Shares received: ${shares}`);
      } catch (error) {
        console.warn('⚠️ Could not parse shares from logs:', error);
        results.shares = txBuilder.expectedShares || null;
      }

      // Update transaction status
      await updateTransactionStatus(depositTxHash, 'confirmed');

      return results;
    } catch (error) {
      console.error(`❌ Deposit failed:`, error);
      results.error = `Deposit failed: ${error.message}`;
      await updateTransactionStatus(results.depositTxHash, 'failed', error.message);
      return results;
    }
  } catch (error) {
    console.error(`❌ Execute deposit error:`, error);
    throw error;
  }
}

/**
 * Execute withdraw transaction
 * @param {number} chatId - Telegram chat ID
 * @param {Object} params - Withdraw parameters
 * @returns {Promise<Object>} Transaction result
 */
async function executeWithdraw({
  chatId,
  poolAddress,
  shares,
  chainId,
  withdrawAll = false,
}) {
  try {
    console.log(`💸 Executing withdraw for chat ${chatId}`);

    // Step 1: Check WalletConnect session
    const session = await walletconnect.getActiveSession(chatId);
    if (!session) {
      throw new Error('No active WalletConnect session. Please connect your wallet first using /connect_wallet');
    }

    const userAddress = session.walletAddress;

    // Step 2: Get blockchain client
    const client = getClient(chainId);

    // Step 3: Build withdraw transaction
    console.log(`🔨 Building withdraw transaction...`);
    const txBuilder = await buildWithdrawTransaction({
      client,
      poolAddress,
      shares,
      userAddress,
      chainId,
      withdrawAll,
    });

    const results = {
      withdrawTxHash: null,
      assetsReceived: null,
      error: null,
    };

    // Step 4: Send withdraw transaction
    console.log(`💸 Sending withdraw transaction...`);

    try {
      const withdrawTxHash = await walletconnect.sendTransaction(chatId, txBuilder.withdrawTx);
      results.withdrawTxHash = withdrawTxHash;

      // Track withdraw transaction
      await trackTransaction({
        chatId,
        txHash: withdrawTxHash,
        txType: 'withdraw',
        chainId,
        poolAddress,
        amount: shares.toString(),
      });

      console.log(`✅ Withdraw transaction sent: ${withdrawTxHash}`);

      // Wait for withdraw confirmation
      console.log(`⏳ Waiting for withdraw confirmation...`);
      const withdrawReceipt = await client.waitForTransactionReceipt({
        hash: withdrawTxHash,
        timeout: 60_000,
      });

      if (withdrawReceipt.status !== 'success') {
        throw new Error('Withdraw transaction failed');
      }

      // Parse assets from logs
      try {
        const assetsReceived = parseAssetsFromLogs(
          withdrawReceipt.logs,
          poolAddress,
          userAddress,
          txBuilder.tokenDecimals
        );
        results.assetsReceived = assetsReceived;
        console.log(`🎉 Withdraw confirmed! Assets received: ${assetsReceived}`);
      } catch (error) {
        console.warn('⚠️ Could not parse assets from logs:', error);
        results.assetsReceived = txBuilder.expectedAssets;
      }

      // Update transaction status
      await updateTransactionStatus(withdrawTxHash, 'confirmed');

      return results;
    } catch (error) {
      console.error(`❌ Withdraw failed:`, error);
      results.error = `Withdraw failed: ${error.message}`;
      if (results.withdrawTxHash) {
        await updateTransactionStatus(results.withdrawTxHash, 'failed', error.message);
      }
      return results;
    }
  } catch (error) {
    console.error(`❌ Execute withdraw error:`, error);
    throw error;
  }
}

/**
 * Track transaction in database
 * @param {Object} params - Transaction parameters
 */
async function trackTransaction({
  chatId,
  txHash,
  txType,
  chainId,
  poolAddress,
  tokenAddress = null,
  amount,
}) {
  try {
    const user = await db.getOrCreateUser(chatId);

    return new Promise((resolve, reject) => {
      db.db.run(
        `INSERT INTO pending_transactions
         (user_id, tx_hash, tx_type, chain_id, pool_address, token_address, amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [user.id, txHash, txType, chainId, poolAddress, tokenAddress, amount, Date.now()],
        function(err) {
          if (err) {
            console.error('❌ Error tracking transaction:', err);
            return reject(err);
          }
          console.log(`📝 Transaction tracked: ${txHash}`);
          resolve({ id: this.lastID });
        }
      );
    });
  } catch (error) {
    console.error('❌ Error tracking transaction:', error);
  }
}

/**
 * Update transaction status
 * @param {string} txHash - Transaction hash
 * @param {string} status - New status (pending, confirmed, failed)
 * @param {string} error - Error message (if failed)
 */
async function updateTransactionStatus(txHash, status, error = null) {
  if (!txHash) return;

  try {
    return new Promise((resolve, reject) => {
      const confirmedAt = status === 'confirmed' ? Date.now() : null;

      db.db.run(
        `UPDATE pending_transactions
         SET status = ?, confirmed_at = ?, error = ?
         WHERE tx_hash = ?`,
        [status, confirmedAt, error, txHash],
        (err) => {
          if (err) {
            console.error('❌ Error updating transaction status:', err);
            return reject(err);
          }
          console.log(`✅ Transaction ${txHash} status updated to: ${status}`);
          resolve();
        }
      );
    });
  } catch (error) {
    console.error('❌ Error updating transaction status:', error);
  }
}

/**
 * Get pending transactions for a user
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<Array>} Pending transactions
 */
async function getPendingTransactions(chatId) {
  try {
    const user = await db.getOrCreateUser(chatId);

    return new Promise((resolve, reject) => {
      db.db.all(
        `SELECT * FROM pending_transactions
         WHERE user_id = ? AND status = 'pending'
         ORDER BY created_at DESC`,
        [user.id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  } catch (error) {
    console.error('❌ Error getting pending transactions:', error);
    return [];
  }
}

/**
 * Estimate transaction cost (gas fees)
 * @param {Object} params - Transaction parameters
 * @returns {Promise<Object>} Cost estimation { gas, gasPrice, costETH, costUSD }
 */
async function estimateTransactionCost({
  poolAddress,
  tokenAddress,
  amount,
  userAddress,
  chainId,
  txType, // 'deposit' or 'withdraw'
}) {
  try {
    const client = getClient(chainId);

    if (txType === 'deposit') {
      const txBuilder = await buildDepositTransactions({
        client,
        poolAddress,
        tokenAddress,
        amount,
        userAddress,
        chainId,
      });

      // Estimate approval + deposit
      const { estimateGas, getGasPrice } = require('../../utils/transaction-builder.cjs');

      const gasPrice = await getGasPrice(client);

      let totalGas = 0n;

      if (txBuilder.needsApproval && txBuilder.approvalTx) {
        const approvalGas = await estimateGas(client, txBuilder.approvalTx, userAddress);
        totalGas += approvalGas;
      }

      const depositGas = await estimateGas(client, txBuilder.depositTx, userAddress);
      totalGas += depositGas;

      const costWei = totalGas * gasPrice;
      const costETH = parseFloat((Number(costWei) / 1e18).toFixed(6));

      return {
        gas: totalGas.toString(),
        gasPrice: gasPrice.toString(),
        costETH,
        costUSD: null, // TODO: Fetch ETH price
      };
    } else if (txType === 'withdraw') {
      const txBuilder = await buildWithdrawTransaction({
        client,
        poolAddress,
        shares: amount,
        userAddress,
        chainId,
      });

      const { estimateGas, getGasPrice } = require('../../utils/transaction-builder.cjs');

      const gasPrice = await getGasPrice(client);
      const gas = await estimateGas(client, txBuilder.withdrawTx, userAddress);
      const costWei = gas * gasPrice;
      const costETH = parseFloat((Number(costWei) / 1e18).toFixed(6));

      return {
        gas: gas.toString(),
        gasPrice: gasPrice.toString(),
        costETH,
        costUSD: null,
      };
    }

    throw new Error(`Unknown transaction type: ${txType}`);
  } catch (error) {
    console.error('❌ Error estimating transaction cost:', error);
    return {
      gas: '150000',
      gasPrice: '20000000000', // 20 gwei
      costETH: 0.003,
      costUSD: null,
    };
  }
}

module.exports = {
  executeDeposit,
  executeWithdraw,
  trackTransaction,
  updateTransactionStatus,
  getPendingTransactions,
  estimateTransactionCost,
};

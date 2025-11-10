/**
 * WalletConnect v2 service for Telegram bot
 * Handles wallet connection sessions and transaction signing
 */

// Polyfill Web Crypto API for Node.js (required by WalletConnect)
const { Crypto } = require('@peculiar/webcrypto');
const crypto = new Crypto();
global.crypto = crypto;

const { SignClient } = require('@walletconnect/sign-client');
const { getSdkError } = require('@walletconnect/utils');
const db = require('../database');

// WalletConnect configuration
const PROJECT_ID = process.env.WALLETCONNECT_PROJECT_ID || '2abd49041d1b0b2b082b69c65ccb3e52';
const RELAY_URL = 'wss://relay.walletconnect.com';

// Supported chains (CAIP-2 format: eip155:<chainId>)
const SUPPORTED_CHAINS = [
  'eip155:1',     // Ethereum Mainnet
  'eip155:42161', // Arbitrum One
  'eip155:10',    // Optimism
  'eip155:146',   // Sonic
  'eip155:9745',  // Plasma
];

// Supported methods (JSON-RPC methods)
const SUPPORTED_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];

// Supported events
const SUPPORTED_EVENTS = [
  'chainChanged',
  'accountsChanged',
];

/**
 * Singleton WalletConnect SignClient instance
 */
let signClient = null;

/**
 * Initialize WalletConnect SignClient
 * Should be called once on bot startup
 */
async function initializeWalletConnect() {
  if (signClient) {
    return signClient;
  }

  if (!PROJECT_ID) {
    console.warn('⚠️ WALLETCONNECT_PROJECT_ID not set. Using default project ID.');
  }

  try {
    console.log('🔗 Initializing WalletConnect SignClient...');

    signClient = await SignClient.init({
      projectId: PROJECT_ID,
      relayUrl: RELAY_URL,
      metadata: {
        name: 'Gearbox Strategy Agent',
        description: '24/7 DeFi yield monitoring & transaction bot',
        url: 'https://app.gearbox.finance',
        icons: ['https://app.gearbox.finance/favicon.ico'],
      },
    });

    // Set up event listeners
    setupWalletConnectEvents(signClient);

    console.log('✅ WalletConnect SignClient initialized');
    return signClient;
  } catch (error) {
    console.error('❌ Failed to initialize WalletConnect SignClient:', error);
    throw error;
  }
}

/**
 * Setup WalletConnect event listeners
 * @param {SignClient} client - WalletConnect client
 */
function setupWalletConnectEvents(client) {
  // Session proposal (new connection request)
  client.on('session_proposal', async (proposal) => {
    console.log('📨 Received session proposal:', proposal.id);
  });

  // Session created
  client.on('session_event', ({ topic, params, id }) => {
    console.log(`🔔 Session event [${topic}]:`, params.event);
  });

  // Session updated
  client.on('session_update', ({ topic, params }) => {
    console.log(`🔄 Session updated [${topic}]:`, params);
  });

  // Session deleted
  client.on('session_delete', async ({ topic }) => {
    console.log(`❌ Session deleted [${topic}]`);

    // Clean up session from database
    try {
      db.db.get('SELECT user_id FROM walletconnect_sessions WHERE topic = ?', [topic], (err, result) => {
        if (!err && result) {
          db.db.run('DELETE FROM walletconnect_sessions WHERE topic = ?', [topic], () => {
            console.log(`✅ Cleaned up session ${topic} from database`);
          });
        }
      });
    } catch (error) {
      console.error('❌ Error cleaning up session:', error);
    }
  });
}

/**
 * Create new WalletConnect session
 * @param {number} chatId - Telegram chat ID
 * @param {number} chainId - Chain ID to connect to
 * @returns {Promise<Object>} Session URI and approval promise
 */
async function createSession(chatId, chainId = 1) {
  try {
    if (!signClient) {
      await initializeWalletConnect();
    }

    console.log(`🔗 Creating WalletConnect session for chat ${chatId} on chain ${chainId}`);

    // Create connection URI with all supported chains
    // Use optionalNamespaces to support all 5 chains, with primary chain in requiredNamespaces
    const { uri, approval } = await signClient.connect({
      optionalNamespaces: {
        eip155: {
          methods: SUPPORTED_METHODS,
          chains: SUPPORTED_CHAINS, // All 5 chains supported
          events: SUPPORTED_EVENTS,
        },
      },
    });

    if (!uri) {
      throw new Error('Failed to generate connection URI');
    }

    console.log(`✅ Connection URI generated for chat ${chatId}`);

    // Return URI immediately (for QR code generation)
    // The approval() function returns a promise that resolves when user connects wallet
    return {
      uri,
      approval: (async () => {
        const session = await approval();
        console.log(`✅ Session approved for chat ${chatId}:`, session.topic);

        // Extract wallet address and approved chains from session
        const namespace = session.namespaces.eip155;
        const accounts = namespace?.accounts || [];
        const approvedChains = namespace?.chains || [];
        const walletAddress = accounts[0]?.split(':')[2]; // eip155:1:0x... -> 0x...

        if (!walletAddress) {
          throw new Error('No wallet address in session');
        }

        console.log(`✅ Wallet approved chains:`, approvedChains);

        // Save session to database
        const user = await db.getOrCreateUser(chatId);
        const expiresAt = Date.now() + (session.expiry * 1000 || 24 * 60 * 60 * 1000); // session.expiry is in seconds

        await new Promise((resolve, reject) => {
          db.db.run(
            `INSERT OR REPLACE INTO walletconnect_sessions
             (user_id, topic, wallet_address, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, session.topic, walletAddress, Date.now(), expiresAt],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });

        // Also update user's wallet address
        await db.updateUserWallet(user.id, walletAddress);

        console.log(`💾 Session saved for user ${user.id}: ${walletAddress}`);

        return {
          topic: session.topic,
          walletAddress,
          chainId,
        };
      })(),
    };
  } catch (error) {
    console.error('❌ Error creating WalletConnect session:', error);
    throw error;
  }
}

/**
 * Get active WalletConnect session for a user
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<Object|null>} Active session or null
 */
async function getActiveSession(chatId) {
  try {
    const user = await db.getOrCreateUser(chatId);

    // Get session from database
    const sessionData = await new Promise((resolve, reject) => {
      db.db.get(
        'SELECT * FROM walletconnect_sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
        [user.id, Date.now()],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (!sessionData) {
      return null;
    }

    // Check if session still exists in WalletConnect SignClient
    if (!signClient) {
      await initializeWalletConnect();
    }

    const session = signClient.session.get(sessionData.topic);

    if (!session) {
      // Session expired or disconnected, clean up database
      await new Promise((resolve) => {
        db.db.run('DELETE FROM walletconnect_sessions WHERE id = ?', [sessionData.id], () => {
          resolve();
        });
      });
      return null;
    }

    return {
      topic: sessionData.topic,
      walletAddress: sessionData.wallet_address,
      createdAt: sessionData.created_at,
      expiresAt: sessionData.expires_at,
      session,
    };
  } catch (error) {
    console.error('❌ Error getting active session:', error);
    return null;
  }
}

/**
 * Disconnect WalletConnect session
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<boolean>} Success status
 */
async function disconnectSession(chatId) {
  try {
    const activeSession = await getActiveSession(chatId);

    if (!activeSession) {
      return false;
    }

    if (!signClient) {
      await initializeWalletConnect();
    }

    // Disconnect from WalletConnect
    await signClient.disconnect({
      topic: activeSession.topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });

    // Remove from database
    const user = await db.getOrCreateUser(chatId);
    await new Promise((resolve) => {
      db.db.run('DELETE FROM walletconnect_sessions WHERE user_id = ?', [user.id], () => {
        resolve();
      });
    });

    console.log(`✅ Disconnected session for chat ${chatId}`);
    return true;
  } catch (error) {
    console.error('❌ Error disconnecting session:', error);
    return false;
  }
}

/**
 * Send transaction via WalletConnect
 * @param {number} chatId - Telegram chat ID
 * @param {Object} tx - Transaction object { to, data, value?, chainId }
 * @returns {Promise<string>} Transaction hash
 */
async function sendTransaction(chatId, tx) {
  try {
    const activeSession = await getActiveSession(chatId);

    if (!activeSession) {
      throw new Error('No active WalletConnect session. Please connect your wallet first.');
    }

    if (!signClient) {
      await initializeWalletConnect();
    }

    console.log(`📤 Sending transaction via WalletConnect for chat ${chatId}`);

    // Prepare transaction request
    const chainId = tx.chainId || 1;
    const transactionRequest = {
      from: activeSession.walletAddress,
      to: tx.to,
      data: tx.data,
      value: tx.value ? `0x${tx.value.toString(16)}` : '0x0',
      gas: tx.gas ? `0x${tx.gas.toString(16)}` : undefined,
    };

    // Send transaction via WalletConnect
    const result = await signClient.request({
      topic: activeSession.topic,
      chainId: `eip155:${chainId}`,
      request: {
        method: 'eth_sendTransaction',
        params: [transactionRequest],
      },
    });

    console.log(`✅ Transaction sent: ${result}`);
    return result; // Returns transaction hash
  } catch (error) {
    console.error('❌ Error sending transaction:', error);

    // Parse error message for user-friendly display
    if (error.message?.includes('User rejected')) {
      throw new Error('Transaction rejected by user');
    } else if (error.message?.includes('Insufficient funds')) {
      throw new Error('Insufficient funds for transaction + gas');
    }

    throw error;
  }
}

/**
 * Check if user has an active WalletConnect session
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<boolean>} True if active session exists
 */
async function hasActiveSession(chatId) {
  const session = await getActiveSession(chatId);
  return session !== null;
}

/**
 * Get WalletConnect deep link for mobile wallets
 * @param {string} uri - WalletConnect URI
 * @param {string} walletApp - Wallet app name (metamask, rainbow, trust, etc.)
 * @returns {string} Deep link URL
 *
 * Note: Using direct app schemes (e.g., metamask://, trust://) instead of universal links
 * to ensure iOS opens the installed app directly rather than redirecting to App Store.
 * If the app is not installed, the user will see a "Cannot open page" error.
 */
function getDeepLink(uri, walletApp = 'metamask') {
  const encodedUri = encodeURIComponent(uri);

  const deepLinks = {
    // Direct app schemes for reliable iOS deeplinks (opens installed app immediately)
    metamask: `metamask://wc?uri=${encodedUri}`,
    trust: `trust://wc?uri=${encodedUri}`,

    // Universal links for wallets without direct schemes
    rainbow: `https://rnbwapp.com/wc?uri=${encodedUri}`,
    rabby: `https://rabby.io/wc?uri=${encodedUri}`,
    argent: `https://argent.link/app/wc?uri=${encodedUri}`,
    imtoken: `https://imtoken.me/wc?uri=${encodedUri}`,

    // Generic WalletConnect modal for any wallet
    walletconnect: `https://web3modal.com/wc?uri=${encodedUri}`,
  };

  return deepLinks[walletApp] || deepLinks.metamask;
}

/**
 * Clean up expired sessions
 * Should be run periodically (e.g., every hour)
 */
async function cleanupExpiredSessions() {
  try {
    await new Promise((resolve, reject) => {
      db.db.run('DELETE FROM walletconnect_sessions WHERE expires_at < ?', [Date.now()], function(err) {
        if (err) return reject(err);
        if (this.changes > 0) {
          console.log(`🧹 Cleaned up ${this.changes} expired WalletConnect sessions`);
        }
        resolve();
      });
    });
  } catch (error) {
    console.error('❌ Error cleaning up expired sessions:', error);
  }
}

// Helper to get signClient (for advanced operations like adding chains)
function getSignClient() {
  return signClient;
}

module.exports = {
  initializeWalletConnect,
  createSession,
  getActiveSession,
  disconnectSession,
  sendTransaction,
  hasActiveSession,
  getDeepLink,
  cleanupExpiredSessions,
  getSignClient,
};

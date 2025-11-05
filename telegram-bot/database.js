/**
 * SQLite Database for Gearbox Telegram Bot
 * Lightweight persistent storage for users, mandates, and notifications
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'gearbox_bot.db');

class Database {
  constructor() {
    this.ready = false;
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err.message);
      } else {
        console.log('✅ Connected to SQLite database:', DB_PATH);
        this.initializeTables();
      }
    });
  }

  initializeTables() {
    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          telegram_chat_id TEXT UNIQUE NOT NULL,
          telegram_username TEXT,
          wallet_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Mandates table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS mandates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          asset TEXT NOT NULL,
          min_apy REAL NOT NULL,
          max_leverage REAL NOT NULL,
          risk TEXT NOT NULL,
          max_position REAL NOT NULL,
          signed BOOLEAN DEFAULT 0,
          signed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          active BOOLEAN DEFAULT 1,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Notifications log table (prevents spam)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mandate_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          opportunity_id TEXT NOT NULL,
          apy REAL NOT NULL,
          strategy TEXT,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mandate_id) REFERENCES mandates(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Positions table (tracks user deposits in pools)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS positions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          pool_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          underlying_token TEXT NOT NULL,

          shares REAL NOT NULL,
          deposited_amount REAL NOT NULL,
          current_value REAL,

          initial_supply_apy REAL NOT NULL,
          current_supply_apy REAL,
          initial_borrow_apy REAL,
          current_borrow_apy REAL,
          net_apy REAL,
          leverage REAL DEFAULT 1,
          health_factor REAL,

          last_apy_check DATETIME,
          deposited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          active BOOLEAN DEFAULT 1,

          FOREIGN KEY (user_id) REFERENCES users(id),
          UNIQUE(user_id, pool_address, chain_id)
        )
      `);

      // APY history table (for trend analysis)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS apy_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pool_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          supply_apy REAL NOT NULL,
          borrow_apy REAL,
          tvl REAL,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // APY change notifications log (prevents spam)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS apy_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          position_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          change_type TEXT NOT NULL,
          old_apy REAL NOT NULL,
          new_apy REAL NOT NULL,
          change_percent REAL NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (position_id) REFERENCES positions(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Health factor notifications log (prevents spam for liquidation alerts)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS health_factor_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          position_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          health_factor REAL NOT NULL,
          severity TEXT NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (position_id) REFERENCES positions(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Index for faster lookups
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_mandates_active ON mandates(active, signed)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_recent ON notifications(mandate_id, sent_at)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(active, user_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_positions_apy_check ON positions(last_apy_check)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_positions_health_factor ON positions(health_factor)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_apy_history_pool ON apy_history(pool_address, recorded_at)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_apy_notifications_recent ON apy_notifications(position_id, sent_at)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_health_notifications_recent ON health_factor_notifications(position_id, sent_at)`, (err) => {
        if (err) {
          console.error('❌ Error creating indexes:', err.message);
        } else {
          console.log('✅ Database tables initialized');
          this.ready = true;
        }
      });
    });
  }

  // Wait for database to be ready
  waitForReady() {
    return new Promise((resolve) => {
      if (this.ready) {
        resolve();
      } else {
        const checkReady = setInterval(() => {
          if (this.ready) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
      }
    });
  }

  // ==========================================
  // USER OPERATIONS
  // ==========================================

  getOrCreateUser(chatId, username = null) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM users WHERE telegram_chat_id = ?`,
        [chatId.toString()],
        (err, row) => {
          if (err) return reject(err);

          if (row) {
            resolve(row);
          } else {
            // Create new user
            this.db.run(
              `INSERT INTO users (telegram_chat_id, telegram_username) VALUES (?, ?)`,
              [chatId.toString(), username],
              function(err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, telegram_chat_id: chatId.toString(), telegram_username: username });
              }
            );
          }
        }
      );
    });
  }

  updateUserWallet(userId, walletAddress) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE users SET wallet_address = ? WHERE id = ?`,
        [walletAddress, userId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  // ==========================================
  // MANDATE OPERATIONS
  // ==========================================

  createMandate(userId, mandate) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      this.db.run(
        `INSERT INTO mandates (user_id, asset, min_apy, max_leverage, risk, max_position, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, mandate.asset, mandate.minAPY, mandate.maxLeverage, mandate.risk, mandate.maxPosition, expiresAt.toISOString()],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, ...mandate });
        }
      );
    });
  }

  signMandate(mandateId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE mandates SET signed = 1, signed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [mandateId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Create multiple mandates at once (batch operation for wallet-first onboarding)
   * @param {number} userId - User ID
   * @param {Array} mandates - Array of mandate objects
   * @param {boolean} autoSign - Automatically sign mandates (default: true)
   * @returns {Promise<Array>} Array of created mandate IDs
   */
  createMultipleMandates(userId, mandates, autoSign = true) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const createdIds = [];
      const db = this.db; // Capture db reference for use in callbacks

      // Use transaction for atomicity
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);
        });

        let completed = 0;
        let hasError = false;

        mandates.forEach((mandate, index) => {
          const signed = autoSign ? 1 : 0;
          const signedAt = autoSign ? new Date().toISOString() : null;

          db.run(
            `INSERT INTO mandates (user_id, asset, min_apy, max_leverage, risk, max_position, expires_at, signed, signed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              mandate.asset,
              mandate.minAPY || mandate.min_apy,
              mandate.maxLeverage || mandate.max_leverage || 1,
              mandate.risk,
              mandate.maxPosition || mandate.max_position || 50000,
              expiresAt.toISOString(),
              signed,
              signedAt,
            ],
            function(err) {
              if (err) {
                hasError = true;
                console.error('Error inserting mandate:', err.message);
                return;
              }

              createdIds.push(this.lastID);
              completed++;

              // If all mandates processed
              if (completed === mandates.length) {
                if (hasError) {
                  db.run('ROLLBACK', () => {
                    reject(new Error('Failed to create all mandates, transaction rolled back'));
                  });
                } else {
                  db.run('COMMIT', (err) => {
                    if (err) return reject(err);
                    resolve(createdIds);
                  });
                }
              }
            }
          );
        });
      });
    });
  }

  getActiveMandates() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT m.*, u.telegram_chat_id, u.wallet_address
         FROM mandates m
         JOIN users u ON m.user_id = u.id
         WHERE m.active = 1
           AND m.signed = 1
           AND datetime(m.expires_at) > datetime('now')`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  getUserMandates(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM mandates
         WHERE user_id = ? AND active = 1
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  pauseMandate(mandateId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE mandates SET active = 0 WHERE id = ?`,
        [mandateId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  deleteMandate(mandateId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM mandates WHERE id = ?`,
        [mandateId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  // ==========================================
  // NOTIFICATION OPERATIONS
  // ==========================================

  wasRecentlyNotified(mandateId, opportunityId, hoursAgo = 24) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id FROM notifications
         WHERE mandate_id = ?
           AND opportunity_id = ?
           AND datetime(sent_at) > datetime('now', '-${hoursAgo} hours')`,
        [mandateId, opportunityId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  logNotification(mandateId, userId, opportunityId, apy, strategy) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO notifications (mandate_id, user_id, opportunity_id, apy, strategy)
         VALUES (?, ?, ?, ?, ?)`,
        [mandateId, userId, opportunityId, apy, strategy],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  getNotificationStats(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT
           COUNT(*) as total_notifications,
           MAX(sent_at) as last_notification,
           AVG(apy) as avg_apy
         FROM notifications
         WHERE user_id = ?`,
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows[0]);
        }
      );
    });
  }

  // ==========================================
  // POSITION OPERATIONS
  // ==========================================

  createOrUpdatePosition(userId, position) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO positions (
          user_id, pool_address, chain_id, underlying_token,
          shares, deposited_amount, current_value,
          initial_supply_apy, current_supply_apy,
          initial_borrow_apy, current_borrow_apy, net_apy, leverage, health_factor,
          last_apy_check, deposited_at, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, pool_address, chain_id) DO UPDATE SET
          shares = excluded.shares,
          current_value = excluded.current_value,
          current_supply_apy = excluded.current_supply_apy,
          current_borrow_apy = excluded.current_borrow_apy,
          net_apy = excluded.net_apy,
          leverage = excluded.leverage,
          health_factor = excluded.health_factor,
          last_apy_check = CURRENT_TIMESTAMP,
          last_updated = CURRENT_TIMESTAMP`,
        [
          userId, position.poolAddress, position.chainId, position.underlyingToken,
          position.shares, position.depositedAmount, position.currentValue,
          position.initialSupplyAPY, position.currentSupplyAPY,
          position.initialBorrowAPY, position.currentBorrowAPY, position.netAPY, position.leverage, position.healthFactor
        ],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  getUserPositions(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM positions
         WHERE user_id = ? AND active = 1
         ORDER BY deposited_at DESC`,
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  getActivePositions() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT p.*, u.telegram_chat_id, u.wallet_address
         FROM positions p
         JOIN users u ON p.user_id = u.id
         WHERE p.active = 1`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  updatePositionAPY(positionId, supplyAPY, borrowAPY, netAPY) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE positions
         SET current_supply_apy = ?, current_borrow_apy = ?, net_apy = ?,
             last_apy_check = CURRENT_TIMESTAMP, last_updated = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [supplyAPY, borrowAPY, netAPY, positionId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  deactivatePosition(positionId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE positions SET active = 0 WHERE id = ?`,
        [positionId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  // ==========================================
  // APY HISTORY OPERATIONS
  // ==========================================

  recordAPYHistory(poolAddress, chainId, supplyAPY, borrowAPY, tvl, borrowed = 0, utilization = 0) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO apy_history (pool_address, chain_id, supply_apy, borrow_apy, tvl, borrowed, utilization)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [poolAddress, chainId, supplyAPY, borrowAPY, tvl, borrowed, utilization],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  getAPYHistory(poolAddress, chainId, days = 7) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM apy_history
         WHERE pool_address = ? AND chain_id = ?
           AND datetime(recorded_at) > datetime('now', '-${days} days')
         ORDER BY recorded_at DESC`,
        [poolAddress, chainId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  // ==========================================
  // APY CHANGE NOTIFICATION OPERATIONS
  // ==========================================

  wasNotifiedAboutAPYChange(positionId, hoursAgo = 6) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id FROM apy_notifications
         WHERE position_id = ?
           AND datetime(sent_at) > datetime('now', '-${hoursAgo} hours')`,
        [positionId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  logAPYChangeNotification(positionId, userId, changeType, oldAPY, newAPY, changePercent) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO apy_notifications (position_id, user_id, change_type, old_apy, new_apy, change_percent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [positionId, userId, changeType, oldAPY, newAPY, changePercent],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  // ==========================================
  // HELPER METHODS FOR POSITION MONITORING
  // ==========================================

  /**
   * Get all users who have connected wallets
   * @returns {Promise<Array>} Users with wallet addresses
   */
  getUsersWithWallets() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, telegram_chat_id, wallet_address
         FROM users
         WHERE wallet_address IS NOT NULL AND wallet_address != ''`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  /**
   * Get positions that need APY check (not checked in last X minutes)
   * @param {number} minutesSinceCheck - Minutes since last check
   * @returns {Promise<Array>} Positions needing check
   */
  getPositionsNeedingAPYCheck(minutesSinceCheck = 15) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT p.*, u.telegram_chat_id, u.wallet_address
         FROM positions p
         JOIN users u ON p.user_id = u.id
         WHERE p.active = 1
           AND (p.last_apy_check IS NULL
                OR datetime(p.last_apy_check) < datetime('now', '-${minutesSinceCheck} minutes'))`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  /**
   * Update position's current value based on shares
   * @param {number} positionId - Position ID
   * @param {number} currentValue - New current value
   * @returns {Promise<void>}
   */
  updatePositionValue(positionId, currentValue) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE positions
         SET current_value = ?, last_updated = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [currentValue, positionId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Update position's health factor (for leveraged positions)
   * @param {number} positionId - Position ID
   * @param {number} healthFactor - New health factor
   * @returns {Promise<void>}
   */
  updatePositionHealthFactor(positionId, healthFactor) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE positions
         SET health_factor = ?, last_updated = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [healthFactor, positionId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Get APY trend for a position (increasing, decreasing, or stable)
   * @param {string} poolAddress - Pool address
   * @param {number} chainId - Chain ID
   * @param {number} days - Days to analyze
   * @returns {Promise<Object>} Trend data
   */
  async getAPYTrend(poolAddress, chainId, days = 7) {
    const history = await this.getAPYHistory(poolAddress, chainId, days);

    if (history.length < 2) {
      return { trend: 'unknown', change: 0, history };
    }

    const latest = history[0].supply_apy;
    const oldest = history[history.length - 1].supply_apy;
    const change = latest - oldest;

    let trend = 'stable';
    if (Math.abs(change) > 0.5) {
      trend = change > 0 ? 'increasing' : 'decreasing';
    }

    return { trend, change, history };
  }

  /**
   * Get positions with low health factor (liquidation risk)
   * @param {number} threshold - Health factor threshold (default 1.5)
   * @returns {Promise<Array>} At-risk positions
   */
  getPositionsWithLowHealthFactor(threshold = 1.5) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT p.*, u.telegram_chat_id, u.wallet_address
         FROM positions p
         JOIN users u ON p.user_id = u.id
         WHERE p.active = 1
           AND p.health_factor IS NOT NULL
           AND p.health_factor < ?
         ORDER BY p.health_factor ASC`,
        [threshold],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  /**
   * Log health factor notification (spam prevention)
   * @param {number} positionId - Position ID
   * @param {number} userId - User ID
   * @param {number} healthFactor - Current health factor
   * @param {string} severity - Severity level (warning, critical)
   * @returns {Promise<Object>} Created notification
   */
  logHealthFactorNotification(positionId, userId, healthFactor, severity) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO health_factor_notifications (position_id, user_id, health_factor, severity)
         VALUES (?, ?, ?, ?)`,
        [positionId, userId, healthFactor, severity],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  /**
   * Check if user was recently notified about health factor
   * @param {number} positionId - Position ID
   * @param {number} hoursAgo - Hours since last notification
   * @returns {Promise<boolean>} True if recently notified
   */
  wasNotifiedAboutHealthFactor(positionId, hoursAgo = 1) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id FROM health_factor_notifications
         WHERE position_id = ?
           AND datetime(sent_at) > datetime('now', '-${hoursAgo} hours')`,
        [positionId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Get notification statistics for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Notification statistics
   */
  async getNotificationStats(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT
           (SELECT COUNT(*) FROM notifications WHERE user_id = ?) as mandate_notifications,
           (SELECT COUNT(*) FROM apy_notifications WHERE user_id = ?) as apy_notifications,
           (SELECT COUNT(*) FROM health_factor_notifications WHERE user_id = ?) as health_notifications,
           (SELECT COUNT(*) FROM positions WHERE user_id = ? AND active = 1) as active_positions`,
        [userId, userId, userId, userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || { mandate_notifications: 0, apy_notifications: 0, health_notifications: 0, active_positions: 0 });
        }
      );
    });
  }

  // ==========================================
  // POOL CACHE OPERATIONS
  // ==========================================

  /**
   * Get all cached pools
   * @param {boolean} activeOnly - Only return active pools
   * @returns {Promise<Array>} Array of pool objects
   */
  getCachedPools(activeOnly = true) {
    return new Promise((resolve, reject) => {
      const query = activeOnly
        ? `SELECT * FROM pool_cache WHERE active = 1 ORDER BY discovered_at DESC`
        : `SELECT * FROM pool_cache ORDER BY discovered_at DESC`;

      this.db.all(query, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  /**
   * Get cached pools for a specific chain
   */
  getCachedPoolsByChain(chainId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM pool_cache WHERE chain_id = ? AND active = 1`,
        [chainId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  /**
   * Get a specific pool by address
   * @param {string} poolAddress - Pool contract address
   * @returns {Promise<Object|null>} Pool object or null if not found
   */
  getCachedPoolByAddress(poolAddress) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM pool_cache WHERE LOWER(pool_address) = LOWER(?) AND active = 1`,
        [poolAddress],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Add or update a pool in the cache
   * @param {Object} poolData - Pool information
   * @returns {Promise<Object>} Result with isNew flag
   */
  addOrUpdatePoolCache(poolData) {
    return new Promise((resolve, reject) => {
      const {
        pool_address,
        chain_id,
        pool_name,
        pool_symbol,
        underlying_token,
        tvl,
        apy,
        borrowed = 0,
        utilization = 0,
        collaterals = null
      } = poolData;

      // Convert collaterals array to JSON string for storage
      const collateralsStr = collaterals && collaterals.length > 0 ? JSON.stringify(collaterals) : null;

      // Check if pool exists
      this.db.get(
        `SELECT id, discovered_at, apy as old_apy FROM pool_cache WHERE pool_address = ? AND chain_id = ?`,
        [pool_address, chain_id],
        (err, existingPool) => {
          if (err) return reject(err);

          if (existingPool) {
            // Update existing pool
            this.db.run(
              `UPDATE pool_cache
               SET pool_name = ?, pool_symbol = ?, underlying_token = ?,
                   last_tvl = tvl, last_apy = apy,
                   tvl = ?, apy = ?, borrowed = ?, utilization = ?, collaterals = ?,
                   last_seen = CURRENT_TIMESTAMP, active = 1
               WHERE pool_address = ? AND chain_id = ?`,
              [pool_name, pool_symbol, underlying_token, tvl, apy, borrowed, utilization, collateralsStr, pool_address, chain_id],
              (err) => {
                if (err) return reject(err);
                resolve({
                  id: existingPool.id,
                  isNew: false,
                  discovered_at: existingPool.discovered_at,
                  oldAPY: existingPool.old_apy,
                  newAPY: apy
                });
              }
            );
          } else {
            // Insert new pool
            this.db.run(
              `INSERT INTO pool_cache
               (pool_address, chain_id, pool_name, pool_symbol, underlying_token, tvl, apy, last_tvl, last_apy, borrowed, utilization, collaterals)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [pool_address, chain_id, pool_name, pool_symbol, underlying_token, tvl, apy, tvl, apy, borrowed, utilization, collateralsStr],
              function(err) {
                if (err) return reject(err);
                resolve({
                  id: this.lastID,
                  isNew: true,
                  discovered_at: new Date().toISOString(),
                  oldAPY: null,
                  newAPY: apy
                });
              }
            );
          }
        }
      );
    });
  }

  /**
   * Mark pools as inactive if not seen in latest scan
   * @param {Array<String>} seenPoolKeys - Array of "address-chainId" keys
   */
  markMissingPoolsInactive(seenPoolKeys) {
    return new Promise((resolve, reject) => {
      if (seenPoolKeys.length === 0) {
        resolve();
        return;
      }

      // Build condition to match all seen pools
      const conditions = seenPoolKeys.map(() => `(pool_address || '-' || chain_id) = ?`).join(' OR ');

      this.db.run(
        `UPDATE pool_cache
         SET active = 0
         WHERE active = 1 AND NOT (${conditions})`,
        seenPoolKeys,
        function(err) {
          if (err) return reject(err);
          resolve({ deactivated: this.changes });
        }
      );
    });
  }

  /**
   * Get newly discovered pools (within last N hours)
   * @param {number} hours - Time window in hours
   */
  getNewPools(hours = 24) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM pool_cache
         WHERE active = 1
           AND datetime(discovered_at) > datetime('now', '-${hours} hours')
         ORDER BY discovered_at DESC`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  /**
   * Check if user was notified about a specific pool
   * @param {number} userId - User ID
   * @param {string} poolAddress - Pool address
   * @param {number} chainId - Chain ID
   * @param {number} hours - Cooldown in hours
   */
  wasNotifiedAboutPool(userId, poolAddress, chainId, hours = 24) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id FROM pool_notifications
         WHERE user_id = ? AND pool_address = ? AND chain_id = ?
           AND datetime(sent_at) > datetime('now', '-${hours} hours')`,
        [userId, poolAddress, chainId],
        (err, row) => {
          if (err) return reject(err);
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Log a pool notification
   */
  logPoolNotification(userId, poolAddress, chainId, mandateId = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO pool_notifications (user_id, pool_address, chain_id, mandate_id)
         VALUES (?, ?, ?, ?)`,
        [userId, poolAddress, chainId, mandateId],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  // ==========================================
  // UTILITY
  // ==========================================

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
    });
  }
}

module.exports = new Database();

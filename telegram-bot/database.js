/**
 * SQLite Database for Gearbox Telegram Bot
 * Lightweight persistent storage for users, mandates, and notifications
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'gearbox_bot.db');

class Database {
  constructor() {
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

      // Index for faster lookups
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_mandates_active ON mandates(active, signed)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_recent ON notifications(mandate_id, sent_at)`);

      console.log('✅ Database tables initialized');
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

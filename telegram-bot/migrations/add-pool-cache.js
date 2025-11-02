/**
 * Database Migration: Add pool_cache table
 *
 * This migration adds a new table to track discovered Gearbox pools across all chains.
 * Used for detecting new pools and sending notifications to users.
 *
 * Run: node migrations/add-pool-cache.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'gearbox_bot.db');

function runMigration() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('✅ Connected to database:', DB_PATH);
      console.log('🔄 Running migration: add-pool-cache\n');

      db.serialize(() => {
        // Create pool_cache table
        db.run(`
          CREATE TABLE IF NOT EXISTS pool_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pool_address TEXT NOT NULL,
            chain_id INTEGER NOT NULL,
            pool_name TEXT NOT NULL,
            pool_symbol TEXT,
            underlying_token TEXT NOT NULL,
            tvl REAL,
            apy REAL,
            discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_apy REAL,
            last_tvl REAL,
            active BOOLEAN DEFAULT 1,
            UNIQUE(pool_address, chain_id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error creating pool_cache table:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Created table: pool_cache');
        });

        // Create indexes
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pool_cache_active
          ON pool_cache(active, chain_id)
        `, (err) => {
          if (err) {
            console.error('❌ Error creating index idx_pool_cache_active:', err.message);
          } else {
            console.log('✅ Created index: idx_pool_cache_active');
          }
        });

        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pool_cache_discovered
          ON pool_cache(discovered_at)
        `, (err) => {
          if (err) {
            console.error('❌ Error creating index idx_pool_cache_discovered:', err.message);
          } else {
            console.log('✅ Created index: idx_pool_cache_discovered');
          }
        });

        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pool_cache_chain_token
          ON pool_cache(chain_id, underlying_token)
        `, (err) => {
          if (err) {
            console.error('❌ Error creating index idx_pool_cache_chain_token:', err.message);
          } else {
            console.log('✅ Created index: idx_pool_cache_chain_token');
          }
        });

        // Create pool_notifications table (tracks notifications sent for new pools)
        db.run(`
          CREATE TABLE IF NOT EXISTS pool_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            pool_address TEXT NOT NULL,
            chain_id INTEGER NOT NULL,
            mandate_id INTEGER,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (mandate_id) REFERENCES mandates(id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error creating pool_notifications table:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Created table: pool_notifications');
        });

        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pool_notifications_user
          ON pool_notifications(user_id, sent_at)
        `, (err) => {
          if (err) {
            console.error('❌ Error creating index idx_pool_notifications_user:', err.message);
          } else {
            console.log('✅ Created index: idx_pool_notifications_user');
          }
        });

        // Verify tables exist
        db.all(`
          SELECT name FROM sqlite_master
          WHERE type='table'
          AND (name='pool_cache' OR name='pool_notifications')
        `, (err, rows) => {
          if (err) {
            console.error('❌ Error verifying tables:', err.message);
            reject(err);
            return;
          }

          console.log('\n📋 Migration Summary:');
          console.log(`   Tables created: ${rows.length}`);
          rows.forEach(row => {
            console.log(`   - ${row.name}`);
          });

          db.close((err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log('\n✅ Migration completed successfully!');
            resolve();
          });
        });
      });
    });
  });
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };

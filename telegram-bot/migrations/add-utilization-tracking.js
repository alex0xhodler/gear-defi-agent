/**
 * Database Migration: Add utilization and borrowed tracking to apy_history
 *
 * Run: node migrations/add-utilization-tracking.js
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
      console.log('🔄 Running migration: add-utilization-tracking\n');

      db.serialize(() => {
        // Add new columns to apy_history table
        db.run(`
          ALTER TABLE apy_history ADD COLUMN borrowed REAL DEFAULT 0
        `, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding borrowed column:', err.message);
          } else if (!err) {
            console.log('✅ Added column: borrowed');
          } else {
            console.log('ℹ️  Column borrowed already exists');
          }
        });

        db.run(`
          ALTER TABLE apy_history ADD COLUMN utilization REAL DEFAULT 0
        `, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding utilization column:', err.message);
          } else if (!err) {
            console.log('✅ Added column: utilization');
          } else {
            console.log('ℹ️  Column utilization already exists');
          }
        });

        // Add borrowed and utilization to pool_cache table too
        db.run(`
          ALTER TABLE pool_cache ADD COLUMN borrowed REAL DEFAULT 0
        `, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding borrowed to pool_cache:', err.message);
          } else if (!err) {
            console.log('✅ Added column to pool_cache: borrowed');
          } else {
            console.log('ℹ️  Column borrowed already exists in pool_cache');
          }
        });

        db.run(`
          ALTER TABLE pool_cache ADD COLUMN utilization REAL DEFAULT 0
        `, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding utilization to pool_cache:', err.message);
            reject(err);
            return;
          } else if (!err) {
            console.log('✅ Added column to pool_cache: utilization');
          } else {
            console.log('ℹ️  Column utilization already exists in pool_cache');
          }

          // Verify columns
          db.all(`PRAGMA table_info(apy_history)`, (err, rows) => {
            if (err) {
              console.error('❌ Error verifying columns:', err.message);
              reject(err);
              return;
            }

            console.log('\n📋 Migration Summary:');
            console.log('   apy_history columns:');
            rows.forEach(row => {
              if (['borrowed', 'utilization'].includes(row.name)) {
                console.log(`   - ${row.name} (${row.type})`);
              }
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

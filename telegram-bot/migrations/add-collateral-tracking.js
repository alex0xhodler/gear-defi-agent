/**
 * Database Migration: Add collateral tracking to pool_cache
 *
 * Run: node migrations/add-collateral-tracking.js
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
      console.log('🔄 Running migration: add-collateral-tracking\n');

      db.serialize(() => {
        // Add collaterals column to pool_cache table
        db.run(`
          ALTER TABLE pool_cache ADD COLUMN collaterals TEXT
        `, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding collaterals column:', err.message);
            reject(err);
            return;
          } else if (!err) {
            console.log('✅ Added column to pool_cache: collaterals');
          } else {
            console.log('ℹ️  Column collaterals already exists in pool_cache');
          }

          // Verify column
          db.all(`PRAGMA table_info(pool_cache)`, (err, rows) => {
            if (err) {
              console.error('❌ Error verifying columns:', err.message);
              reject(err);
              return;
            }

            console.log('\n📋 Migration Summary:');
            console.log('   pool_cache columns:');
            rows.forEach(row => {
              if (row.name === 'collaterals') {
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

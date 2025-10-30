/**
 * Database Migration Script
 * Adds new columns and tables for position monitoring
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'gearbox_bot.db');

console.log('🔄 Starting database migration...');
console.log(`📁 Database: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Add health_factor column to positions table if it doesn't exist
  db.run(`
    ALTER TABLE positions ADD COLUMN health_factor REAL
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding health_factor column:', err.message);
    } else if (!err) {
      console.log('✅ Added health_factor column to positions table');
    } else {
      console.log('ℹ️  health_factor column already exists');
    }
  });

  // Create health_factor_notifications table if it doesn't exist
  db.run(`
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
  `, (err) => {
    if (err) {
      console.error('❌ Error creating health_factor_notifications table:', err.message);
    } else {
      console.log('✅ Created health_factor_notifications table');
    }
  });

  // Create index for health_factor_notifications
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_health_notifications_recent
    ON health_factor_notifications(position_id, sent_at)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating index:', err.message);
    } else {
      console.log('✅ Created index for health_factor_notifications');
    }
  });

  // Create index for positions health_factor if it doesn't exist
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_positions_health_factor
    ON positions(health_factor)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating health_factor index:', err.message);
    } else {
      console.log('✅ Created index for positions health_factor');
    }
  });

  // Verify the migration
  db.all(`PRAGMA table_info(positions)`, (err, rows) => {
    if (err) {
      console.error('❌ Error verifying positions table:', err.message);
    } else {
      const hasHealthFactor = rows.some(row => row.name === 'health_factor');
      if (hasHealthFactor) {
        console.log('✅ Verified: health_factor column exists in positions table');
      } else {
        console.error('❌ Verification failed: health_factor column not found');
      }
    }

    // Close database
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
        process.exit(1);
      } else {
        console.log('✅ Database migration complete!');
        console.log('\n🚀 You can now restart your PM2 services:');
        console.log('   pm2 restart ecosystem.config.js');
        process.exit(0);
      }
    });
  });
});

#!/usr/bin/env node
/**
 * Migration Runner - Executes all pending database migrations
 *
 * Run this script on production after pulling latest code:
 * node migrations/run-all.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'gearbox_bot.db');
const MIGRATIONS_DIR = __dirname;

// List of migrations in order (must match actual filenames)
const MIGRATIONS = [
  'add-pool-cache.js',
  'add-utilization-tracking.js',
  'add-collateral-tracking.js',
];

/**
 * Check if a specific column exists in a table
 */
function columnExists(db, tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const exists = rows.some(row => row.name === columnName);
      resolve(exists);
    });
  });
}

/**
 * Check if a table exists
 */
function tableExists(db, tableName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(!!row);
      }
    );
  });
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  console.log('🔄 Starting migration runner...');
  console.log(`📁 Database: ${DB_PATH}\n`);

  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found!');
    console.error(`   Expected at: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new sqlite3.Database(DB_PATH);

  try {
    // Check migration status
    const poolCacheExists = await tableExists(db, 'pool_cache');
    const utilizationExists = poolCacheExists ? await columnExists(db, 'pool_cache', 'utilization') : false;
    const collateralsExists = poolCacheExists ? await columnExists(db, 'pool_cache', 'collaterals') : false;

    console.log('📊 Migration Status:');
    console.log(`   ├─ pool_cache table: ${poolCacheExists ? '✅' : '❌'}`);
    if (poolCacheExists) {
      console.log(`   ├─ utilization column: ${utilizationExists ? '✅' : '❌'}`);
      console.log(`   └─ collaterals column: ${collateralsExists ? '✅' : '❌'}`);
    }
    console.log('');

    const migrationsToRun = [];

    // Determine which migrations need to run
    if (!poolCacheExists) {
      migrationsToRun.push('add-pool-cache.js');
      migrationsToRun.push('add-utilization-tracking.js');
      migrationsToRun.push('add-collateral-tracking.js');
    } else {
      if (!utilizationExists) {
        migrationsToRun.push('add-utilization-tracking.js');
      }
      if (!collateralsExists) {
        migrationsToRun.push('add-collateral-tracking.js');
      }
    }

    if (migrationsToRun.length === 0) {
      console.log('✅ All migrations already applied!');
      console.log('   Database is up to date.\n');
      db.close();
      return;
    }

    console.log(`🔨 Running ${migrationsToRun.length} migration(s):\n`);

    // Run each migration
    for (const migrationFile of migrationsToRun) {
      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);

      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationFile}`);
        continue;
      }

      console.log(`⏳ Running: ${migrationFile}`);

      try {
        // Load and run migration
        const migration = require(migrationPath);
        if (typeof migration.runMigration === 'function') {
          await migration.runMigration();
          console.log(`✅ Completed: ${migrationFile}\n`);
        } else {
          console.error(`❌ Invalid migration format: ${migrationFile}`);
        }
      } catch (error) {
        console.error(`❌ Migration failed: ${migrationFile}`);
        console.error(`   Error: ${error.message}\n`);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully!\n');

    // Verify final state
    const finalPoolCacheExists = await tableExists(db, 'pool_cache');
    const finalUtilizationExists = await columnExists(db, 'pool_cache', 'utilization');
    const finalCollateralsExists = await columnExists(db, 'pool_cache', 'collaterals');

    console.log('📊 Final Database State:');
    console.log(`   ├─ pool_cache table: ${finalPoolCacheExists ? '✅' : '❌'}`);
    console.log(`   ├─ utilization column: ${finalUtilizationExists ? '✅' : '❌'}`);
    console.log(`   └─ collaterals column: ${finalCollateralsExists ? '✅' : '❌'}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Migration runner failed:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run migrations if executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ Migration runner completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };

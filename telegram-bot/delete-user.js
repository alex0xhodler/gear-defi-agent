#!/usr/bin/env node
/**
 * Delete User Script
 * Removes user and all associated data from database
 *
 * Usage: node delete-user.js <telegram_chat_id>
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'gearbox_bot.db');

async function deleteUser(chatId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);

    db.serialize(() => {
      // Get user ID first
      db.get('SELECT id, telegram_chat_id FROM users WHERE telegram_chat_id = ?', [chatId], (err, user) => {
        if (err) {
          reject(err);
          return;
        }

        if (!user) {
          console.log(`❌ No user found with chat ID: ${chatId}`);
          db.close();
          resolve();
          return;
        }

        console.log(`\n🔍 Found user: ID ${user.id}, Chat ID ${user.telegram_chat_id}`);
        console.log(`\n🗑️  Deleting all data for user ${user.id}...\n`);

        const userId = user.id;

        // Delete in order (respecting foreign keys)
        db.run('DELETE FROM notifications WHERE user_id = ?', [userId], (err) => {
          if (err) console.error('Error deleting notifications:', err.message);
          else console.log('✅ Deleted notifications');
        });

        db.run('DELETE FROM pool_notifications WHERE user_id = ?', [userId], (err) => {
          if (err) console.error('Error deleting pool_notifications:', err.message);
          else console.log('✅ Deleted pool notifications');
        });

        db.run('DELETE FROM positions WHERE user_id = ?', [userId], (err) => {
          if (err) console.error('Error deleting positions:', err.message);
          else console.log('✅ Deleted positions');
        });

        db.run('DELETE FROM mandates WHERE user_id = ?', [userId], (err) => {
          if (err) console.error('Error deleting mandates:', err.message);
          else console.log('✅ Deleted mandates');
        });

        db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
          if (err) {
            console.error('❌ Error deleting user:', err.message);
            reject(err);
          } else {
            console.log('✅ Deleted user account');
            console.log(`\n🎉 Successfully deleted all data for user ${userId}\n`);
          }

          db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    });
  });
}

// Get chat ID from command line
const chatId = process.argv[2];

if (!chatId) {
  console.error('\n❌ Usage: node delete-user.js <telegram_chat_id>\n');
  process.exit(1);
}

console.log(`\n🔄 Deleting user with Telegram Chat ID: ${chatId}\n`);

deleteUser(chatId)
  .then(() => {
    console.log('✅ Done! You can now test end-to-end onboarding as a new user.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message, '\n');
    process.exit(1);
  });

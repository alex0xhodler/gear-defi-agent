# Gearbox Sigma Telegram Bot

24/7 DeFi yield monitoring bot that watches Gearbox Protocol opportunities and alerts users via Telegram when yields match their mandates.

## Features

- ✅ **24/7 Monitoring** - Server-side scanning every 15 minutes (no browser tab needed)
- ✅ **SQLite Database** - Lightweight persistent storage for users, mandates, notifications
- ✅ **Real On-Chain Data** - Fetches live APY from Gearbox Protocol via viem
- ✅ **Telegram Notifications** - Reliable push notifications to mobile/desktop
- ✅ **PM2 Ready** - Production deployment with auto-restart
- ✅ **Multi-User** - Supports unlimited users with individual mandates

## Prerequisites

- Node.js 18+
- PM2 (for production deployment)
- Telegram Bot Token (from @BotFather)

## Quick Start (Local Development)

```bash
# 1. Install dependencies
cd telegram-bot
npm install

# 2. Set environment variables (bot token already configured)
# Edit ../.env if needed

# 3. Run bot
npm start
```

Bot will start polling and monitoring will begin immediately.

## Production Deployment (AWS VPS + PM2)

### 1. Prepare Your VPS

```bash
# SSH into your AWS Lightsail/EC2 instance
ssh ubuntu@your-instance-ip

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Clone repository
cd ~
git clone https://github.com/yourusername/gearagent.git
cd gearagent
```

### 2. Install Dependencies

```bash
# Install root dependencies (API tools)
npm install

# Install bot dependencies
cd telegram-bot
npm install
```

### 3. Configure Environment

```bash
# Make sure .env exists in parent directory with:
# TELEGRAM_BOT_TOKEN=8466127519:AAGi_Xk1QiQCiZWkEWXPRRBdijgUn0EMTH0
# GOOGLE_GEMINI_API_KEY=your_key
# ETHEREUM_RPC_URL=your_rpc_url
# ALCHEMY_API_KEY=your_alchemy_key

# Verify env vars are loaded
node -e "require('dotenv').config({path:'../.env'}); console.log(process.env.TELEGRAM_BOT_TOKEN)"
```

### 4. Update PM2 Config

Edit `ecosystem.config.js` and update the `cwd` path:

```javascript
cwd: '/home/ubuntu/gearagent/telegram-bot', // Your actual path
```

### 5. Start with PM2

```bash
# Create logs directory
mkdir -p logs

# Start bot with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs gearbox-telegram-bot

# Monitor in real-time
pm2 monit
```

### 6. Enable Auto-Start on Reboot

```bash
# Generate PM2 startup script
pm2 startup

# Save current PM2 processes
pm2 save
```

### 7. Verify It's Running

Open Telegram and message your bot:
- `/start` - Should receive welcome message
- `/opportunities` - Should fetch live yields
- `/create` - Should start mandate creation flow

## PM2 Commands

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop gearbox-telegram-bot

# Restart
pm2 restart gearbox-telegram-bot

# View logs
pm2 logs gearbox-telegram-bot

# Monitor
pm2 monit

# Delete process
pm2 delete gearbox-telegram-bot

# View all processes
pm2 list
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and see welcome message |
| `/create` | Create a new yield mandate |
| `/list` | View your active mandates |
| `/opportunities` | Check current top yields |
| `/wallet [address]` | Connect/view wallet address |
| `/stats` | View notification statistics |
| `/help` | Show all commands |

## Mandate Creation Flow

1. User: `/create`
2. Bot: "What asset?" → User selects USDC/USDT/WETH/wstETH
3. Bot: "Min APY?" → User enters `6.5`
4. Bot: "Risk level?" → User selects Low/Medium/High
5. Bot: "Max leverage?" → User enters `2`
6. Bot: "Max position size?" → User enters `10000`
7. Bot: Shows preview → User clicks "✅ Activate Mandate"
8. Bot: "Mandate activated! Monitoring every 15 minutes"

## Monitoring Logic

Every 15 minutes, the bot:

1. Fetches all active signed mandates from SQLite
2. Groups mandates by asset (USDC, WETH, etc.)
3. Queries Gearbox Protocol for opportunities via `api/tools/query-strategies.ts`
4. Filters opportunities matching mandate criteria (APY, leverage, risk)
5. Checks if user was already notified about this opportunity in last 24h
6. Sends Telegram notification with inline buttons
7. Logs notification to prevent spam

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  telegram_chat_id TEXT UNIQUE,
  telegram_username TEXT,
  wallet_address TEXT,
  created_at DATETIME
);

-- Mandates
CREATE TABLE mandates (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  asset TEXT,
  min_apy REAL,
  max_leverage REAL,
  risk TEXT,
  max_position REAL,
  signed BOOLEAN,
  signed_at DATETIME,
  created_at DATETIME,
  expires_at DATETIME,
  active BOOLEAN
);

-- Notifications (prevents spam)
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  mandate_id INTEGER,
  user_id INTEGER,
  opportunity_id TEXT,
  apy REAL,
  strategy TEXT,
  sent_at DATETIME
);
```

## File Structure

```
telegram-bot/
├── index.js              # Main entry point
├── bot.js                # Telegram bot commands & handlers
├── database.js           # SQLite database operations
├── monitor.js            # 15-minute monitoring service
├── ecosystem.config.js   # PM2 configuration
├── package.json          # Dependencies
├── README.md             # This file
├── .gitignore           # Git ignore rules
└── logs/                # PM2 logs (created automatically)
```

## Troubleshooting

### Bot not responding

```bash
# Check if process is running
pm2 status

# Check logs for errors
pm2 logs gearbox-telegram-bot --lines 50

# Restart bot
pm2 restart gearbox-telegram-bot
```

### Database issues

```bash
# Check if database file exists
ls -lh gearbox_bot.db

# Test database connection
npm test

# Delete and recreate (WARNING: loses data)
rm gearbox_bot.db
npm start
```

### Monitoring not scanning

```bash
# Check logs for scan output
pm2 logs gearbox-telegram-bot | grep SCAN

# Verify opportunities endpoint is working
curl http://localhost:3000/api/strategies/query
```

### Environment variables not loading

```bash
# Verify .env exists in parent directory
cat ../.env | grep TELEGRAM_BOT_TOKEN

# Test loading
node -e "require('dotenv').config({path:'../.env'}); console.log(process.env.TELEGRAM_BOT_TOKEN)"
```

## Security Notes

- ⚠️ Bot token is currently hardcoded in `ecosystem.config.js` - move to .env for production
- ⚠️ SQLite database is unencrypted - consider encrypting sensitive fields
- ⚠️ Wallet addresses are stored in plain text - validate addresses before storage
- ⚠️ No rate limiting implemented - add if bot becomes public

## Future Enhancements

- [ ] Direct wallet signing via WalletConnect
- [ ] Gas price optimization alerts
- [ ] Portfolio tracking with PnL
- [ ] Multi-chain support (Arbitrum, Base, etc.)
- [ ] Customizable alert frequency
- [ ] Email/SMS fallback notifications
- [ ] Web dashboard for mandate management
- [ ] Backtesting historical yields

## License

MIT

## Support

Open an issue on GitHub or message @yourusername on Telegram.

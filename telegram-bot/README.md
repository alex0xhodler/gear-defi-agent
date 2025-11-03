# Gearbox Sigma Telegram Bot

24/7 DeFi yield monitoring bot that watches Gearbox Protocol opportunities and alerts users via Telegram when yields match their mandates. Now with **comprehensive position tracking** and **APY change monitoring**.

## Features

### Core Features
- ✅ **24/7 Monitoring** - Server-side scanning every 15 minutes (no browser tab needed)
- ✅ **SQLite Database** - Lightweight persistent storage for users, mandates, notifications, and positions
- ✅ **Real On-Chain Data** - Fetches live APY and balances from Ethereum & Plasma via viem
- ✅ **Telegram Notifications** - Reliable push notifications to mobile/desktop
- ✅ **PM2 Ready** - Production deployment with auto-restart
- ✅ **Multi-User** - Supports unlimited users with individual mandates

### New: Position Monitoring (2025)
- 🔍 **Automatic Position Detection** - Scans wallet for existing Gearbox positions
- 📊 **APY Change Alerts** - Get notified when position APYs change significantly (±0.5% minor, ±2% major)
- ⚠️ **Liquidation Risk Monitoring** - Real-time health factor tracking for leveraged positions
- 📈 **Historical APY Tracking** - 30-day APY history with trend analysis
- 💰 **PnL Tracking** - Track profit/loss for each position
- 🔄 **Multi-Chain Support** - Monitors positions on Ethereum mainnet and Plasma chain
- 🎯 **Smart Notifications** - Cooldown periods to prevent notification spam

## Prerequisites

- Node.js 18+
- PM2 (for production deployment)
- Telegram Bot Token (from @BotFather)
- Ethereum RPC URL (Alchemy, Infura, or public)
- Plasma RPC URL (default: https://rpc.plasma.to)

## Quick Start (Local Development)

```bash
# 1. Install dependencies
cd telegram-bot
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your credentials
nano .env
# Set TELEGRAM_BOT_TOKEN
# Set ETHEREUM_RPC_URL (optional, uses public RPC if not set)

# 4. Run bot
npm start

# 5. In a separate terminal, run position monitor
node position-monitor.js
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
# Create .env file in telegram-bot directory
cd telegram-bot
cp .env.example .env

# Edit .env with your credentials
nano .env

# Required:
# TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Optional (uses public RPCs if not set):
# ETHEREUM_RPC_URL=your_alchemy_or_infura_url
# PLASMA_RPC_URL=https://rpc.plasma.to

# Verify env vars are loaded
node -e "require('dotenv').config(); console.log(process.env.TELEGRAM_BOT_TOKEN)"
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

# Start both bot and position monitor with PM2
pm2 start ecosystem.config.js

# Check status (should see 2 processes)
pm2 status

# View logs
pm2 logs gearbox-telegram-bot
pm2 logs gearbox-position-monitor

# Monitor in real-time
pm2 monit
```

You should now see two PM2 processes running:
- `gearbox-telegram-bot` - Main bot handling commands
- `gearbox-position-monitor` - Position monitoring service

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
| `/positions` | **NEW:** View your active positions with PnL and APY |
| `/wallet [address]` | Connect wallet (auto-scans for positions) |
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

### Mandate Monitoring
Every 15 minutes, the mandate monitor:

1. Fetches all active signed mandates from SQLite
2. Groups mandates by asset (USDC, WETH, etc.)
3. Queries Gearbox Protocol for opportunities via real API calls
4. Filters opportunities matching mandate criteria (APY, leverage, risk)
5. Checks if user was already notified about this opportunity in last 24h
6. Sends Telegram notification with inline buttons
7. Logs notification to prevent spam

### Position Monitoring (New)
Every 15 minutes, the position monitor:

1. **Position Scanning:**
   - Fetches all users with connected wallets
   - Scans each wallet across Ethereum mainnet and Plasma chain
   - Detects pool token balances using viem
   - Converts shares to underlying asset values
   - Stores/updates positions in database

2. **APY Change Detection:**
   - Fetches current APY for each active position
   - Compares with last recorded APY
   - Triggers notifications for changes ≥0.5% (minor) or ≥2% (major)
   - Records APY history for trend analysis
   - Respects 6-hour cooldown between notifications

3. **Health Factor Monitoring (Leveraged Positions):**
   - Queries credit account data for leveraged positions
   - Calculates health factor (liquidation risk metric)
   - Sends alerts for:
     - 🟡 Warning: HF < 1.5
     - 🟠 High Risk: HF < 1.2
     - 🔴 Critical: HF < 1.05
   - Respects 1-hour cooldown for health factor alerts

4. **Position Closure Detection:**
   - Detects when positions are closed (balance = 0)
   - Sends closure notification with final PnL
   - Deactivates position in database

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

-- Positions (NEW - tracks user deposits)
CREATE TABLE positions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  pool_address TEXT,
  chain_id INTEGER,
  underlying_token TEXT,
  shares REAL,
  deposited_amount REAL,
  current_value REAL,
  initial_supply_apy REAL,
  current_supply_apy REAL,
  initial_borrow_apy REAL,
  current_borrow_apy REAL,
  net_apy REAL,
  leverage REAL DEFAULT 1,
  health_factor REAL,
  last_apy_check DATETIME,
  deposited_at DATETIME,
  last_updated DATETIME,
  active BOOLEAN DEFAULT 1,
  UNIQUE(user_id, pool_address, chain_id)
);

-- APY History (NEW - for trend analysis)
CREATE TABLE apy_history (
  id INTEGER PRIMARY KEY,
  pool_address TEXT,
  chain_id INTEGER,
  supply_apy REAL,
  borrow_apy REAL,
  tvl REAL,
  recorded_at DATETIME
);

-- APY Change Notifications (NEW - prevents spam)
CREATE TABLE apy_notifications (
  id INTEGER PRIMARY KEY,
  position_id INTEGER,
  user_id INTEGER,
  change_type TEXT,
  old_apy REAL,
  new_apy REAL,
  change_percent REAL,
  sent_at DATETIME
);

-- Health Factor Notifications (NEW - liquidation alerts)
CREATE TABLE health_factor_notifications (
  id INTEGER PRIMARY KEY,
  position_id INTEGER,
  user_id INTEGER,
  health_factor REAL,
  severity TEXT,
  sent_at DATETIME
);
```

## File Structure

```
telegram-bot/
├── index.js                  # Main entry point
├── bot.js                    # Telegram bot commands & handlers
├── database.js               # SQLite database operations
├── monitor.js                # 15-minute mandate monitoring service
├── position-monitor.js       # NEW: Position monitoring service
├── position-scanner.js       # NEW: Wallet position scanner
├── query-opportunities.js    # Gearbox API integration
├── config.js                 # NEW: Centralized configuration
├── .env                      # Environment variables (create from .env.example)
├── .env.example              # NEW: Environment template
├── ecosystem.config.js       # PM2 configuration (2 processes)
├── package.json              # Dependencies
├── README.md                 # This file
├── .gitignore               # Git ignore rules
├── commands/
│   └── positions.js          # NEW: Position command handlers
├── utils/
│   └── blockchain.js         # NEW: viem blockchain utilities
├── logs/                     # PM2 logs (created automatically)
└── gearbox_bot.db           # SQLite database (created automatically)
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

- ✅ **FIXED:** Bot token moved to .env file (no longer hardcoded)
- ⚠️ SQLite database is unencrypted - consider encrypting sensitive fields
- ⚠️ Wallet addresses are stored in plain text - validate addresses before storage
- ⚠️ No rate limiting implemented - add if bot becomes public
- 🔒 RPC endpoints should use HTTPS and be kept in .env
- 🔒 Position data is sensitive - ensure proper access controls

## Configuration Options (config.js)

You can customize monitoring behavior by editing `config.js`:

```javascript
// Monitoring intervals
monitoring: {
  positionScanInterval: 15 * 60 * 1000,  // 15 minutes
  healthFactorCheckInterval: 10 * 60 * 1000,  // 10 minutes
},

// APY thresholds
apy: {
  minorChangeThreshold: 0.5,  // 0.5% change triggers notification
  majorChangeThreshold: 2.0,  // 2% change is "major"
  notificationCooldown: 6 * 60 * 60 * 1000,  // 6 hours
},

// Health factor warnings
healthFactor: {
  warningThreshold: 1.5,  // Yellow alert
  criticalThreshold: 1.2,  // Red alert
  liquidationThreshold: 1.05,  // Immediate action
},
```

## Future Enhancements

### Completed ✅
- [x] Portfolio tracking with PnL
- [x] Multi-chain support (Ethereum + Plasma)
- [x] APY change alerts
- [x] Liquidation risk monitoring

### Planned 🚧
- [ ] Direct wallet signing via WalletConnect
- [ ] Gas price optimization alerts
- [ ] More chains (Arbitrum, Base, Optimism)
- [ ] Customizable alert frequency per position
- [ ] Email/SMS fallback notifications
- [ ] Web dashboard for mandate management
- [ ] Backtesting historical yields
- [ ] Auto-rebalancing recommendations
- [ ] Yield farming strategy suggestions

## License

MIT

## Support

Open an issue on GitHub or message @yourusername on Telegram.

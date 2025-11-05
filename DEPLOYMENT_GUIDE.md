# Deployment Guide - Critical P0 Fixes

This guide covers the deployment of critical fixes for:
1. Database missing `collaterals` column (causes pool discovery crash)
2. Unsupported chain IDs for Optimism, Arbitrum, Sonic

## Changes Made

### 1. blockchain.js - Multi-chain Support
**File**: `telegram-bot/utils/blockchain.js`

**Changes**:
- Added viem chain imports for Arbitrum and Optimism
- Created custom Sonic chain configuration
- Added viem clients for chains: 42161 (Arbitrum), 10 (Optimism), 146 (Sonic)
- Updated documentation

**Impact**: Fixes "Unsupported chain ID" errors for Optimism, Arbitrum, and Sonic pools

### 2. Migration Runner Script
**File**: `telegram-bot/migrations/run-all.js`

**Purpose**:
- Automatically detects and runs pending database migrations
- Checks current database state
- Runs only necessary migrations in correct order
- Verifies successful completion

## Deployment Steps

### Step 1: SSH into Production Server

```bash
ssh ubuntu@<your-server-ip>
```

### Step 2: Navigate to Project Directory

```bash
cd ~/gear-defi-agent
```

### Step 3: Stop Running Services

```bash
pm2 stop gearbox-telegram-bot
pm2 stop pool-discovery-monitor
pm2 stop position-monitor
pm2 stop mandate-monitor
```

### Step 4: Pull Latest Code

```bash
git fetch origin
git pull origin main
```

### Step 5: Install Dependencies (if needed)

```bash
cd telegram-bot
npm install
```

### Step 6: Run Database Migrations

```bash
node migrations/run-all.js
```

**Expected Output**:
```
🔄 Starting migration runner...
📁 Database: /home/ubuntu/gear-defi-agent/telegram-bot/gearbox_bot.db

📊 Migration Status:
   ├─ pool_cache table: ✅
   ├─ utilization column: ✅
   └─ collaterals column: ❌

🔨 Running 1 migration(s):

⏳ Running: add-collateral-tracking.js
✅ Connected to database: /home/ubuntu/gear-defi-agent/telegram-bot/gearbox_bot.db
🔄 Running migration: add-collateral-tracking

✅ Added column to pool_cache: collaterals
✅ Completed: add-collateral-tracking.js

🎉 All migrations completed successfully!

📊 Final Database State:
   ├─ pool_cache table: ✅
   ├─ utilization column: ✅
   └─ collaterals column: ✅

✅ Migration runner completed successfully!
```

### Step 7: Restart Services

```bash
cd ~/gear-defi-agent/telegram-bot
pm2 restart gearbox-telegram-bot
pm2 restart pool-discovery-monitor
pm2 restart position-monitor
pm2 restart mandate-monitor
```

### Step 8: Monitor Logs

```bash
# Watch all logs
pm2 logs

# Or watch specific service
pm2 logs gearbox-telegram-bot

# Check for errors
pm2 logs --err
```

### Step 9: Verify Fixes

**Check for SUCCESS indicators in logs**:

✅ **Pool Discovery Should Work**:
```
🔍 Pool Discovery Scan #X
   Time: ...
✅ Discovered XX pools across 5 chains

   🆕 New pool discovered: [Pool Name] on [Chain]
      APY: X.XX% | TVL: $X.XX | Utilization: X.X%
```

✅ **NO "SQLITE_ERROR: no such column: collaterals"**

✅ **NO "Unsupported chain ID: 10/42161/146" errors**

✅ **Position Scanning Should Work for All Chains**:
```
🔍 Starting position scan...
   Found X positions on Ethereum
   Found X positions on Arbitrum
   Found X positions on Optimism
   Found X positions on Sonic
   Found X positions on Plasma
```

## Rollback Plan (If Needed)

If issues occur after deployment:

```bash
# Stop services
pm2 stop all

# Revert code changes
git reset --hard HEAD~1

# Restore database backup (if you made one)
cp ~/backups/gearbox_bot.db.backup ~/gear-defi-agent/telegram-bot/gearbox_bot.db

# Restart services
pm2 restart all
```

## Pre-Deployment Checklist

- [ ] Backup database: `cp telegram-bot/gearbox_bot.db telegram-bot/gearbox_bot.db.backup`
- [ ] Note current commit hash: `git rev-parse HEAD`
- [ ] Ensure no users are mid-transaction
- [ ] Have rollback plan ready

## Post-Deployment Verification

1. **Test Pool Discovery**:
   - Wait for next pool scan (15 min) or restart pool-discovery-monitor
   - Verify logs show successful pool caching with collaterals

2. **Test Position Scanning**:
   - Check logs for successful position detection on all chains
   - Verify no "Unsupported chain ID" errors

3. **Test Mandate Notifications**:
   - Create test mandate for each chain
   - Verify opportunities are found and notifications sent

4. **Test Bot Commands**:
   - Send `/start` to bot
   - Create new mandate
   - View mandates
   - Check positions

## Troubleshooting

### Issue: Migration Fails with "table locked"

**Cause**: Database in use by running service

**Fix**:
```bash
pm2 stop all
node migrations/run-all.js
pm2 restart all
```

### Issue: "Cannot find module 'viem/chains'"

**Cause**: Missing dependencies

**Fix**:
```bash
cd telegram-bot
rm -rf node_modules package-lock.json
npm install
```

### Issue: RPC endpoint errors

**Cause**: Chain RPC URLs may be down or rate-limited

**Fix**: Update `.env` with alternative RPC URLs:
```bash
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
SONIC_RPC_URL=https://rpc.soniclabs.com
```

## Contact

If deployment issues occur, check:
1. PM2 logs: `pm2 logs --err`
2. Migration output
3. Database file permissions: `ls -la telegram-bot/gearbox_bot.db`

## Summary

This deployment fixes two critical P0 errors that were preventing:
- Pool discovery from completing (database crash)
- Position tracking on Optimism, Arbitrum, and Sonic chains

Expected downtime: ~2-3 minutes during service restart
Expected improvement: Pool discovery working, full multi-chain support

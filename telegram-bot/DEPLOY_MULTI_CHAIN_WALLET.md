# Deploy Multi-Chain Wallet Scanning

## Summary
This update enables dynamic multi-chain wallet balance scanning by deriving token addresses from discovered Gearbox pools, eliminating hardcoded token lists.

## Changes Made
1. ✅ Added `underlying_token_address` and `underlying_decimals` columns to `pool_cache` table
2. ✅ Updated `pool-fetcher.js` to return `tokenAddress` field for all pools
3. ✅ Updated `database.js` to store token addresses and decimals
4. ✅ Updated `pool-discovery-monitor.js` to pass token data to database
5. ✅ Created `wallet-analyzer-v2.js` with dynamic token discovery

## Deployment Steps

### Step 1: Run Database Migration
```bash
cd ~/gear-defi-agent/telegram-bot
sqlite3 gearbox_bot.db < migrations/add-token-address-columns.sql
```

### Step 2: Verify Migration
```bash
sqlite3 gearbox_bot.db ".schema pool_cache"
# Should show underlying_token_address and underlying_decimals columns
```

### Step 3: Pull Latest Code
```bash
git pull origin feature/telegram-bot-monitoring
```

### Step 4: Restart Pool Discovery (to populate token addresses)
```bash
pm2 restart pool-discovery-monitor
pm2 logs pool-discovery-monitor --lines 50
```

Wait 1-2 minutes for pool discovery to run, then verify data:

```bash
sqlite3 gearbox_bot.db "SELECT pool_address, pool_name, underlying_token, underlying_token_address, underlying_decimals, chain_id FROM pool_cache WHERE active = 1 LIMIT 5;"
```

Expected output should show token addresses populated.

### Step 5: Test wallet-analyzer-v2
```bash
node -e "
const analyzer = require('./utils/wallet-analyzer-v2');
analyzer.getTokensFromPools().then(tokens => {
  console.log('Discovered tokens:', tokens.length);
  console.log(tokens);
});
"
```

Should show tokens from all 5 chains (Ethereum, Arbitrum, Optimism, Sonic, Plasma).

### Step 6: Update bot.js to use v2
```bash
# Edit bot.js line 14 (or search for wallet-analyzer import)
# Change:  const { analyzeWalletHoldings } = require('./utils/wallet-analyzer');
# To:      const { analyzeWalletHoldings } = require('./utils/wallet-analyzer-v2');
```

### Step 7: Restart Bot
```bash
pm2 restart gearbox-telegram-bot
pm2 logs gearbox-telegram-bot --lines 50
```

### Step 8: Test with Real Wallet
Send your wallet address to the bot and verify:
- ✅ Message says "Checking balances across 5 chains"
- ✅ Tokens detected on multiple chains (not just Ethereum + Plasma)
- ✅ Console logs show "📋 Derived X unique tokens from 31 pools"

## Rollback Plan
If issues occur:

1. Revert bot.js to use old wallet-analyzer:
```bash
# Change back to: require('./utils/wallet-analyzer')
pm2 restart gearbox-telegram-bot
```

2. Database columns are nullable, so old code still works

## Benefits
- ✅ Automatically supports all 5 chains where Gearbox has pools
- ✅ No hardcoded token lists to maintain
- ✅ New pools = new tokens automatically detected
- ✅ True "31 pools across 5 chains" capability

## Verification Commands
```bash
# Check pool cache has token addresses
sqlite3 gearbox_bot.db "SELECT COUNT(*) as total, COUNT(underlying_token_address) as with_address FROM pool_cache WHERE active = 1;"

# Check tokens per chain
sqlite3 gearbox_bot.db "SELECT chain_id, COUNT(DISTINCT underlying_token_address) as unique_tokens FROM pool_cache WHERE active = 1 AND underlying_token_address IS NOT NULL GROUP BY chain_id;"
```

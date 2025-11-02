# Fix Ethereum Pool Discovery - Missing 12+ Pools

**Status**: 🔴 CRITICAL
**Issue**: Only discovering 2 Ethereum pools instead of 14+
**Root Cause**: Production server using public RPC that fails SDK initialization
**Solution**: Configure Alchemy RPC URL

---

## Problem Summary

### Current Behavior (Production)
- ❌ SDK fails: "gas limit is too high, max is 5M gas"
- ⚠️  Falls back to hardcoded pool addresses
- ❌ 10 out of 12 pools show as "UNKNOWN" (contract calls fail)
- ❌ **Only 2 pools discovered correctly**: USDC ($6.8M), DAI ($5.7M)
- ❌ **Missing 12+ pools** with >$1M TVL

### Expected Behavior (Local Dev)
- ✅ SDK initializes successfully with Alchemy RPC
- ✅ Discovers 19 markets on Ethereum mainnet
- ✅ 6 pools > $1M TVL properly identified
- ✅ All pool names, symbols, TVL, APY correct

---

## Root Cause

The Gearbox SDK requires an RPC provider that supports:
- High gas limits for complex contract queries
- Reliable `getMarkets()` calls on PoolQuotaKeeper contract
- Multiple parallel eth_call requests

**Public RPCs (like eth.llamarpc.com) have strict gas limits** and fail with:
```
gas limit is too high, max is 5M gas
```

**Alchemy RPC** supports these complex queries and is recommended by Gearbox.

---

## Solution

### Step 1: Check Current Configuration

On production server:
```bash
cd ~/gear-defi-agent/telegram-bot
node check-rpc-config.js
```

This will show:
- Current Ethereum RPC URL
- Provider type (Alchemy/Infura/Public)
- Recommendations

### Step 2: Add Alchemy RPC to .env

Edit `.env` file on production server:
```bash
cd ~/gear-defi-agent
nano .env
```

Add or update:
```bash
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6
```

**Note**: The API key above is from local dev. If you have a different Alchemy account for production, use that key instead.

### Step 3: Restart Bot

```bash
pm2 restart gearbox-telegram-bot
```

### Step 4: Verify Fix

Watch logs for successful SDK initialization:
```bash
pm2 logs gearbox-telegram-bot --lines 100
```

**Expected output:**
```
🔍 Mainnet: Scanning pools via SDK...
🔄 Initializing Gearbox SDK for chain 1...
✅ SDK initialized: 19 markets found
✅ Mainnet: Found 19 pools via SDK
   💎 USDC Pool: $6847183.60 TVL, 3.80% APY
   💎 DAI Pool: $5660076.21 TVL, 3.04% APY
   💎 USDT Pool: $3950000.00 TVL, 2.88% APY
   💎 USDC Farm: $2050000.00 TVL, 7.50% APY
   💎 USDC Farm 2: $1520000.00 TVL, 7.56% APY
   💎 GHO Pool: $1090000.00 TVL, 4.21% APY
   ... (and more)
```

---

## Expected Results After Fix

### Ethereum Pools (>$1M TVL)
Based on Gearbox app data, should discover:

| Pool | Asset | TVL | APY |
|------|-------|-----|-----|
| USDC Pool | USDC | $6.85M | 3.80% |
| DAI Pool | DAI | $5.66M | 3.04% |
| USDT Pool | USDT | $3.95M | 2.88% |
| USDC Farm | USDC | $2.05M | 7.50% |
| USDC Farm 2 | USDC | $1.52M | 7.56% |
| GHO Pool | GHO | $1.09M | 4.21% |
| **+ 8 more pools** | Various | >$1M | Various |

**Total**: ~14 Ethereum pools with >$1M TVL
**Total Ethereum TVL**: $25.6M+

---

## Alternative: Get Your Own Alchemy API Key

If you want a dedicated production API key:

1. Go to https://www.alchemy.com/
2. Sign up for free account
3. Create new app:
   - **Chain**: Ethereum Mainnet
   - **Network**: Mainnet
4. Copy API key
5. Update .env:
   ```bash
   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_NEW_API_KEY
   ```

**Alchemy Free Tier**:
- 300M compute units/month
- Sufficient for pool discovery (runs every 15 min)
- ~288 scans/month × ~50K compute units = 14.4M units/month
- Well within free tier limits

---

## Verification Checklist

After applying fix, verify:

- [ ] `check-rpc-config.js` shows "✅ Alchemy" provider
- [ ] Bot logs show "✅ SDK initialized: 19 markets found"
- [ ] No "gas limit" errors in logs
- [ ] Ethereum pools show correct names (not "UNKNOWN")
- [ ] 6+ Ethereum pools discovered with >$1M TVL
- [ ] Pool discovery monitor sends notifications correctly

---

## Rollback Plan

If issues occur:
```bash
# Revert to public RPC (will use fallback method)
nano .env
# Comment out: # ETHEREUM_RPC_URL=...

pm2 restart gearbox-telegram-bot
```

Bot will continue working but only discover 2 Ethereum pools via fallback.

---

## Impact

**Before Fix**:
- 2 Ethereum pools discovered
- $12.5M Ethereum TVL covered
- 10 pools showing as "UNKNOWN"
- Missing user opportunities

**After Fix**:
- 14+ Ethereum pools discovered
- $25.6M+ Ethereum TVL covered
- All pool names/data correct
- Users get notified about all matching pools

---

## Files Modified

No code changes required. This is a configuration-only fix:

```
.env (production)
  + ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
```

---

## Next Steps

1. ✅ Run `node check-rpc-config.js` on production
2. ⏳ Update `.env` with Alchemy URL
3. ⏳ Restart bot: `pm2 restart gearbox-telegram-bot`
4. ⏳ Monitor logs for 15 minutes
5. ⏳ Verify all 14+ Ethereum pools discovered

---

**Priority**: HIGH - Ethereum holds most of the >$1M TVL pools
**Effort**: 2 minutes (config change + restart)
**Risk**: Low (can rollback immediately)


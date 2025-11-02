# Deployment Instructions: Ethereum Pool Discovery Fix

**Goal**: Fix Ethereum pool discovery to find all 14+ pools instead of just 2

---

## Step 1: Pull Latest Code

```bash
cd ~/gear-defi-agent
git pull origin feature/telegram-bot-monitoring
```

**Expected output:**
```
Updating 4499b07..190f7ae
 telegram-bot/bot.js              |  2 +-
 telegram-bot/position-monitor.js |  2 +-
 telegram-bot/ecosystem.config.js |  4 ++--
 telegram-bot/debug-env.js        | 81 ++++++++++++++++++++++++
 telegram-bot/check-rpc-config.js | 50 +++++++++++++++
 FIX_ETHEREUM_POOLS.md            | 268 +++++++++++++++++++++++
```

---

## Step 2: Run Diagnostic Scripts

### Check .env file exists and has correct content

```bash
cd ~/gear-defi-agent
cat .env | grep ETHEREUM
```

**If you see nothing or wrong URL**, the file is missing or incorrect.

### Run debug script

```bash
cd ~/gear-defi-agent/telegram-bot
node debug-env.js
```

**Expected output:**
```
1️⃣  Loading .env from root directory:
   ETHEREUM_RPC_URL: ✅ SET
   Value: https://eth-mainnet.g.alchemy.com/v2/...
   Provider: ✅ Alchemy
```

**If you see `❌ MISSING`**, proceed to Step 3.

---

## Step 3: Fix .env File

### Option A: .env already exists (just add Ethereum RPC)

```bash
cd ~/gear-defi-agent
echo "ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6" >> .env
```

### Option B: .env doesn't exist (create it)

```bash
cd ~/gear-defi-agent
cat > .env << 'EOF'
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Blockchain RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
SONIC_RPC_URL=https://rpc.soniclabs.com
PLASMA_RPC_URL=https://rpc.plasma.to

# Optional: Gemini API (for AI features)
GEMINI_API_KEY=your_gemini_key_if_you_have_one
EOF
```

**Important**: Replace `your_bot_token_here` with your actual Telegram bot token!

### Verify .env is correct

```bash
cd ~/gear-defi-agent
cat .env | grep ETHEREUM_RPC_URL
```

Should show:
```
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6
```

---

## Step 4: Verify Fix with Debug Script

```bash
cd ~/gear-defi-agent/telegram-bot
node debug-env.js
```

**Expected output:**
```
1️⃣  Loading .env from root directory:
   ETHEREUM_RPC_URL: ✅ SET
   Value: https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-Mh...
   Provider: ✅ Alchemy

2️⃣  Checking .env file location:
   Expected path: /home/ubuntu/gear-defi-agent/.env
   File exists: ✅ YES
   Contains ETHEREUM_RPC_URL: ✅ YES

3️⃣  Checking config.js:
   Mainnet RPC URL: https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-Mh...
   Status: ✅ Using Alchemy
```

If all checks pass ✅, proceed to Step 5.

---

## Step 5: Restart Services

```bash
pm2 restart gearbox-telegram-bot
pm2 restart gearbox-position-monitor
```

---

## Step 6: Monitor Logs

```bash
pm2 logs gearbox-telegram-bot --lines 50
```

**Watch for these key lines:**

### ✅ Success Indicators:

```
📋 Configuration:
   Bot Token: ✅ Set
   Gemini API Key: ❌ Missing (optional)
   Ethereum RPC: ✅ Set                    <-- MUST SEE THIS

🔍 Mainnet: Scanning pools via SDK...
🔄 Initializing Gearbox SDK for chain 1...
✅ SDK initialized: 19 markets found      <-- MUST SEE THIS (not "Failed to initialize")
✅ Mainnet: Found 19 pools via SDK        <-- MUST SEE THIS (not "fallback")

   💎 USDC Pool: $6.8M TVL, 3.80% APY     <-- Proper names, not "UNKNOWN"
   💎 DAI Pool: $5.7M TVL, 3.04% APY
   💎 USDT Pool: $3.9M TVL, 2.88% APY
   💎 USDC Farm: $2.0M TVL, 7.50% APY
   💎 USDC Farm 2: $1.5M TVL, 7.56% APY
   💎 GHO Pool: $1.1M TVL, 4.21% APY
   ... (more pools)
```

### ❌ Failure Indicators (need to troubleshoot):

```
Ethereum RPC: ❌ Missing                  <-- BAD: .env not loaded
❌ Failed to initialize SDK for chain 1   <-- BAD: SDK failed
gas limit is too high                     <-- BAD: Using wrong RPC
ℹ️  Using fallback discovery for Ethereum <-- BAD: Fallback triggered
💎 UNKNOWN Pool: $0.00 TVL                <-- BAD: Contract calls failing
```

---

## Step 7: Verify Pool Count

After ~30 seconds, you should see:

```
✅ Scan complete: 12+ pools found across 5 chains  <-- Should be 12+, not 5
```

**Expected distribution:**
- Ethereum: 6-8 pools > $1M TVL (not 2!)
- Plasma: 3 pools > $1M TVL
- Arbitrum: 0 pools > $1M (correct, test network)
- Optimism: 0 pools > $1M (correct, test network)
- Sonic: 0 pools > $1M (correct, test network)

---

## Troubleshooting

### Issue: Still shows "Ethereum RPC: ❌ Missing"

**Cause**: .env file not in correct location or PM2 not loading it

**Solution**:
```bash
# Verify .env exists in root
ls -la ~/gear-defi-agent/.env

# Check PM2 is starting from correct directory
pm2 describe gearbox-telegram-bot | grep cwd

# Should show: cwd: /home/ubuntu/gear-defi-agent/telegram-bot

# Re-run debug script
cd ~/gear-defi-agent/telegram-bot
node debug-env.js
```

### Issue: Still getting "gas limit" error

**Cause**: Alchemy URL not being used by SDK

**Solution**:
```bash
# Double-check .env has Alchemy URL
grep ETHEREUM_RPC_URL ~/gear-defi-agent/.env

# Make sure no spaces around the = sign
# Wrong: ETHEREUM_RPC_URL = https://...
# Right: ETHEREUM_RPC_URL=https://...

# Re-run check-rpc-config
cd ~/gear-defi-agent/telegram-bot
node check-rpc-config.js
```

### Issue: SDK initialized but still only 2 pools

**This shouldn't happen if SDK works**. If it does:
```bash
# Check SDK output more carefully
pm2 logs gearbox-telegram-bot | grep -A 20 "SDK initialized"

# Should show 19 markets, not fewer
```

---

## Rollback (if needed)

If fix causes issues:

```bash
cd ~/gear-defi-agent
git checkout 4499b07  # Previous working commit
pm2 restart all
```

Bot will continue working with fallback (2 Ethereum pools only).

---

## Success Criteria

- [ ] `debug-env.js` shows: `ETHEREUM_RPC_URL: ✅ SET`
- [ ] `debug-env.js` shows: `Provider: ✅ Alchemy`
- [ ] Configuration output shows: `Ethereum RPC: ✅ Set`
- [ ] Logs show: `✅ SDK initialized: 19 markets found`
- [ ] Logs show: `✅ Mainnet: Found 19 pools via SDK` (NOT "fallback")
- [ ] No "UNKNOWN" pool names in logs
- [ ] 6+ Ethereum pools discovered with >$1M TVL
- [ ] Total pools: 12+ across 5 chains (not just 5)

---

## What Changed

**Code fixes** (already pulled):
1. `bot.js`, `position-monitor.js`, `ecosystem.config.js` - Load .env from root
2. Added diagnostic scripts: `debug-env.js`, `check-rpc-config.js`

**Configuration fix** (you need to do):
1. Ensure `.env` file exists in `~/gear-defi-agent/` (root directory)
2. Ensure `ETHEREUM_RPC_URL` is set to Alchemy URL in that .env
3. Restart PM2 processes

---

## Questions?

If still having issues after following all steps:

1. Share output of: `node debug-env.js`
2. Share output of: `pm2 logs gearbox-telegram-bot --lines 100`
3. Share output of: `cat .env | grep ETHEREUM` (sanitize API key)


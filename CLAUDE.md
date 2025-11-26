# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Gearbox Strategy Agent** - a chat-first fintech dashboard prototype for DeFi yield optimization. The project is currently a single-page React application demo showcasing UX improvements for leveraged yield strategies on Gearbox Protocol.

**Key Technologies:**
- React 18 (loaded via CDN)
- Tailwind CSS (via CDN)
- Babel Standalone (for in-browser JSX compilation)
- Vanilla JavaScript/JSX (no build system currently)

## Running the Application

**Development:**
```bash
# Open the HTML file directly in a browser
open index.html
# Or use a simple HTTP server
python -m http.server 8000
# Then navigate to http://localhost:8000
```

No build step is currently required since this uses CDN-loaded dependencies and in-browser JSX compilation via Babel Standalone.

## Architecture

### Component Structure

The application follows a **chat-first onboarding** pattern with these main components:

1. **ChatPanel** - Conversational UI for creating investment mandates
   - Template-based intent matching (stablecoins, ETH, balanced)
   - Quick reply cards for common investment goals
   - Natural language processing (mock implementation)

2. **SignMandatePanel** - Mandate preview and wallet signing
   - Inline preview of mandate parameters (asset, APY, leverage, risk)
   - Modal dialog for wallet signature confirmation
   - Auto-generated from chat conversation

3. **Opportunity Feed** - Curated yield strategy proposals
   - Limited to 2-3 proposals (avoids infinite scroll spam)
   - Progressive empty states (no mandate → scanning → results)
   - Collapsible sidebar for focus mode

4. **ProposalDetailPanel** - Detailed strategy breakdown
   - Investment parameters (deposit, borrow, health factor)
   - Projected returns (30-day net)
   - Approval flow integration

5. **TxProgressPanel** - Transaction lifecycle tracking
   - Multi-step progress indicator
   - Only renders when transaction is active

6. **Active Positions** - Portfolio management
   - Position cards with health factor monitoring
   - Close position functionality

### State Management

Uses React Context (`AppContext`) for global state:
- `mandates` - User-created investment intents
- `activeMandate` - Currently drafted/editing mandate
- `proposals` - Curated strategy opportunities (max 3)
- `activeProposal` - Selected proposal for detail view
- `positions` - Active investment positions
- `notifications` - Toast notification queue
- `activeTx` - Current transaction ID
- `isScanning` - Scanning state for opportunities

### User Flow

1. User describes investment goal via chat (e.g., "Earn with my idle stablecoins")
2. Agent matches intent to template and drafts mandate
3. User reviews mandate preview and signs with wallet (mock)
4. System scans for 2-3 curated opportunities matching mandate
5. User selects and approves proposal
6. Transaction executes with progress tracking
7. Position appears in active portfolio

### Key UX Improvements (P0)

The current implementation includes these fintech UX best practices:

- **Input-first design**: Chat input at TOP of panel (not buried at bottom)
- **Visual template cards**: Icon-based quick replies with gradient hover states
- **Progressive disclosure**: Empty states adapt to user journey (no mandate → scanning → results)
- **Collapsible sidebar**: Toggle assistant panel for focus on opportunities
- **Smart defaults**: Limited to 3 curated proposals (no infinite spam)
- **Inline editing**: Mandate preview before signing
- **Contextual CTAs**: "Create Your First Mandate" in empty state
- **Status indicators**: Scanning animation, "Last scan" timestamp

## DeFi Concepts

**Mandate** - User-defined investment intent with parameters:
- `asset` - Collateral token (USDC, wstETH, etc.)
- `minAPY` - Minimum acceptable annual percentage yield
- `maxLeverage` - Maximum borrowing multiplier
- `risk` - Risk tolerance (Low, Medium, High)
- `maxPosition` - Maximum position size in USD

**Proposal** - Specific yield strategy matching mandate criteria:
- `chain` - Blockchain (Ethereum, Base, Arbitrum)
- `strategy` - Protocol combination (e.g., "Curve + Gearbox")
- `projAPY` - Projected annual yield
- `leverage` - Actual leverage ratio
- `healthFactor` - Liquidation safety margin (higher = safer)
- `estimatedGas` - Transaction cost estimate

**Position** - Active investment with real-time tracking

## File Structure

```
/
├── index.html                                  # Main application entry point
├── gearbox_strategy_agent_react_components... # Original component source (JSX)
└── CLAUDE.md                                   # This file
```

## Development Notes

**Current State:**
- Prototype/demo application (not production-ready)
- Mock data and simulated transactions
- No real wallet integration (uses setTimeout for signatures)
- No backend API (all state is local)

**Production Readiness Considerations:**
- Split monolithic component file into modules
- Add TypeScript for type safety
- Integrate real wallet provider (RainbowKit, WalletConnect, etc.)
- Connect to Gearbox Protocol smart contracts
- Add real-time strategy scanning backend
- Implement proper authentication
- Add comprehensive error handling
- Set up proper build system (Vite/Next.js)

**Tailwind Usage:**
- All styling uses Tailwind utility classes
- Custom animations: `animate-pulse`, `animate-spin`
- Color palette: indigo (primary), slate/gray (neutral), green/red (status)
- Responsive breakpoints: `lg:`, `md:`

## Making Changes

**Adding New Templates:**
Edit the `templates` array in `FullFlowApp` function (around line 329 in index.html):
```javascript
const templates = [
  {
    id: 'tmpl_newstrat',
    name: 'Strategy Name',
    intentKeyword: 'keyword', // For NLP matching
    asset: 'TOKEN',
    minAPY: 5.0,
    maxLeverage: 2,
    risk: 'Medium',
    maxPosition: 10000
  }
];
```

**Adding New Quick Reply Cards:**
Edit the `quickReplies` array in `ChatPanel` function (around line 100 in index.html).

**Modifying Proposal Generation:**
See `generateMockProposals` function (around line 371 in index.html). Currently generates proposals based on mandate asset type.

## Common Patterns

**Creating New Components:**
Follow the minimal UI primitive pattern:
```javascript
const NewComponent = ({ prop1, prop2 }) => {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      {/* Content */}
    </div>
  );
};
```

**Using App Context:**
```javascript
function MyComponent() {
  const { mandates, proposals, pushNotification } = useApp();
  // Access global state
}
```

**Showing Notifications:**
```javascript
pushNotification({
  title: 'Action completed',
  body: 'Description of what happened'
});
```

---

# Telegram Bot Architecture

## Overview

The `telegram-bot/` directory contains a production-grade 24/7 DeFi yield monitoring bot for Gearbox Protocol. It monitors lending pools across 6 blockchain networks and sends real-time notifications to users via Telegram.

**Supported Chains:**
- Ethereum Mainnet (Chain ID: 1)
- Arbitrum (Chain ID: 42161)
- Optimism (Chain ID: 10)
- Sonic (Chain ID: 146)
- Plasma (Chain ID: 9745)
- **Monad Mainnet (Chain ID: 143)** ✅

---

## Running the Bot

**Development:**
```bash
cd telegram-bot
npm install
node index.js
```

**Production (PM2):**
```bash
pm2 start ecosystem.config.js
pm2 logs gearbox-telegram-bot --lines 100
```

**Environment Variables Required:**
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
MONAD_RPC_URL=https://monad-mainnet.g.alchemy.com/v2/YOUR_KEY
# Other chain RPCs optional (defaults to public RPCs)
```

---

## Core Components

### 1. Pool Discovery (`pool-discovery-monitor.js`)
- **Purpose:** Discovers new Gearbox pools across all chains
- **Interval:** Every 15 minutes
- **Strategy:**
  - Uses Gearbox SDK for Ethereum, Arbitrum, Optimism, Sonic
  - Uses **direct contract calls** for Plasma and **Monad** (SDK bypass)
- **Special Feature:** First Monad pool triggers broadcast to ALL users

### 2. Mandate Monitoring (`monitor.js`)
- **Purpose:** Matches user investment criteria against live opportunities
- **Interval:** Every 15 minutes
- **Logic:** Queries pools by asset type, filters by min APY, notifies matches

### 3. Position Scanner (`position-scanner.js`)
- **Purpose:** Detects user balances in Gearbox pools
- **Method:** Reads ERC4626 pool balances via viem for each chain
- **Chain Support:** All 6 chains supported dynamically

### 4. Position Monitor (`position-monitor.js`)
- **Purpose:** Tracks APY changes for active positions
- **Notifications:** Alerts users when APY drops >0.5% or rises >2%

---

## Monad Integration - Architecture Decisions

### Why Direct Contract Calls Instead of SDK?

**The Problem:**
- Gearbox SDK v11.6.4 has Monad configured but initialization fails
- Errors: "gas limit too high", "Cannot read properties of undefined"
- SDK uses Gearbox proxy RPC that has compatibility issues
- Spent significant time debugging SDK internals

**The Solution:**
- **Bypass SDK completely for Monad (like Plasma)**
- Use direct viem `readContract` calls to pool contracts
- Hardcode known pool addresses in `config.js`
- Simple, reliable, works immediately with any RPC

**Code Location:** `telegram-bot/utils/pool-fetcher.js:232-234, 520-576`

```javascript
// Skip SDK for Monad entirely
if (chainConfig.id === 143) {
  return await getMonadPoolsFallback(chainKey, chainConfig);
}
```

### Monad Pool Discovery Implementation

**Fallback Function:** `getMonadPoolsFallback()` (lines 520-576)

**Approach:**
1. Load hardcoded pool addresses from `config.js`
2. Create viem client for Monad with user's RPC
3. Read each pool contract in parallel:
   - `asset()` - Underlying token address
   - `totalAssets()` - TVL in underlying token
   - `supplyRate()` - Current APY in RAY format (1e27)
4. Calculate APY: `(supplyRate * 10000) / RAY / 100`
5. Return structured pool array

**Known Monad Pools (as of Nov 2025):**
```javascript
Monad: [
  {
    address: '0x6b343f7b797f1488aa48c49d540690f2b2c89751',
    name: 'USDC by Edge UltraYield',
    token: 'USDC',
    decimals: 6,
  },
  {
    address: '0x164a35f31e4e0f6c45d500962a6978d2cbd5a16b',
    name: 'USDT0 by Edge UltraYield',
    token: 'USDT0',
    decimals: 6,
  },
  {
    address: '0x34752948b0dc28969485df2066ffe86d5dc36689',
    name: 'USDT0 by Tulipa',
    token: 'USDT0',
    decimals: 6,
  },
]
```

**Curators on Monad:**
- Tulipa: `0x16956912813ab9a38d95730b52a8cf53e860a7c5`
- Edge UltraYield: `0x7c6ee1bf9c1eb3ee55bdbdc1e8d0317aab718e0a`

### Monad RPC Configuration

**Recommended:** Use dedicated Alchemy endpoint
```bash
MONAD_RPC_URL=https://monad-mainnet.g.alchemy.com/v2/YOUR_KEY
```

**Fallback:** Public RPC (rate-limited)
```bash
MONAD_RPC_URL=https://rpc.monad.xyz
```

**Location:** `telegram-bot/config.js:100-105`

---

## Chain Addition Checklist

If you need to add another blockchain:

### 1. Core Configuration
- [ ] Add chain to `telegram-bot/config.js` (blockchain.chains)
- [ ] Add viem client to `telegram-bot/utils/blockchain.js` (custom chain definition + client)
- [ ] Add chain to pool scanning (see Monad example below)

### 2. Pool Discovery Strategy

**Option A: Use Gearbox SDK (if supported)**
```javascript
// In pool-fetcher.js
const sdkChains = ['Mainnet', 'Arbitrum', 'NewChain'];
```

**Option B: Direct Contract Calls (for new/unsupported chains)**
```javascript
// 1. Add pool addresses to config.js
pools: {
  NewChain: [
    { address: '0x...', name: '...', token: '...', decimals: 6 }
  ]
}

// 2. Create fallback function (copy getMonadPoolsFallback)
async function getNewChainPoolsFallback(chainKey, chainConfig) { ... }

// 3. Use fallback in getPoolsFromSDK
if (chainConfig.id === NEW_CHAIN_ID) {
  return await getNewChainPoolsFallback(chainKey, chainConfig);
}
```

### 3. Display Layer
Add chain name to ALL these locations:
- [ ] `commands/positions.js` - Lines 77, 157, 262
- [ ] `commands/invest.js` - Lines 292, 466, 654, 929
- [ ] `position-monitor.js` - Lines 242, 283

**Pattern:**
```javascript
const chainNames = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  146: 'Sonic',
  9745: 'Plasma',
  143: 'Monad',
  NEW_ID: 'NewChain'  // Add here
};
```

### 4. Environment Variables
- [ ] Add to `telegram-bot/.env.example`
- [ ] Document in README (if exists)
- [ ] Add to deployment docs

---

## Key Architectural Patterns

### Chain-Agnostic Design

**Good:** Most of the codebase is chain-agnostic
- Database stores `chain_id` as INTEGER (no constraints)
- Position scanner queries ALL pools in cache dynamically
- Mandate monitor filters by asset, not chain

**Needs Maintenance:** Display layer has hardcoded chain name maps
- These must be updated manually when adding chains
- Provides user-friendly names instead of "Chain 143"

### Pool Discovery Flow

```
┌─────────────────────────────────────────┐
│  Every 15 Minutes                       │
├─────────────────────────────────────────┤
│ 1. Scan all 6 chains for pools          │
│    ├─ Mainnet: SDK                      │
│    ├─ Arbitrum: SDK                     │
│    ├─ Optimism: SDK                     │
│    ├─ Sonic: SDK                        │
│    ├─ Plasma: Direct contracts          │
│    └─ Monad: Direct contracts ⭐        │
│                                          │
│ 2. Update database pool cache            │
│                                          │
│ 3. Detect new pools                      │
│    IF (newPools.length > 0)             │
│    THEN notify matching mandates        │
│                                          │
│ 4. Special: First Monad pool             │
│    IF (monad && !seen_before)           │
│    THEN broadcast to ALL users          │
└─────────────────────────────────────────┘
```

### Database Schema

**Tables:**
- `users` - Telegram users and wallet addresses
- `mandates` - Investment criteria (asset, min APY, risk)
- `positions` - Active deposits (chain_id, pool_address, shares)
- `pool_notifications` - Tracks notification history (24h cooldown)
- `apy_history` - Historical APY data for trends

**Key:** Database is chain-agnostic. No hardcoded chain filters in queries.

---

## Monad-Specific Implementation Details

### Files Modified (Total: 11 files)

**Infrastructure (4 files):**
1. `telegram-bot/config.js` - Chain config + pool addresses
2. `telegram-bot/utils/blockchain.js` - Viem client for chain 143
3. `telegram-bot/utils/pool-fetcher.js` - Fallback function + bypass logic
4. `telegram-bot/database.js` - Added broadcast helpers

**Display Layer (3 files):**
5. `telegram-bot/commands/positions.js` - Chain names (3 locations)
6. `telegram-bot/commands/invest.js` - Chain names (4 locations)
7. `telegram-bot/position-monitor.js` - Chain names (2 locations)

**Monitoring (1 file):**
8. `telegram-bot/pool-discovery-monitor.js` - Broadcast announcement logic

**Config (2 files):**
9. `telegram-bot/.env.example` - MONAD_RPC_URL documentation
10. `.env` - Production RPC endpoint

**Dependencies (1 file):**
11. `package.json` - SDK upgrade 10.2.2 → 11.6.4

### Testing Monad Integration

**Test pool discovery:**
```bash
cd telegram-bot
node -e "
const pf = require('./utils/pool-fetcher');
const config = require('./config');
pf.getMonadPoolsFallback('Monad', config.blockchain.chains.Monad)
  .then(pools => console.log('Monad pools:', pools));
"
```

**Expected output:**
```
📋 Using direct contract calls for Monad pools
   💎 USDC by Edge UltraYield: $XX,XXX TVL, X.XX% APY
   💎 USDT0 by Edge UltraYield: $XX,XXX TVL, X.XX% APY
   💎 USDT0 by Tulipa: $XX,XXX TVL, X.XX% APY
✅ Monad: Found 3 pools via fallback
```

**Test RPC connectivity:**
```bash
cd telegram-bot
node test-monad-integration.js
```

---

## Key Learnings from Monad Integration

### 1. **SDK Complexity vs Direct Calls**

**When to Use SDK:**
- Chain has stable, long-term SDK support
- Multiple curators/pools that change frequently
- Need advanced features (price feeds, multicall optimization)

**When to Use Direct Contract Calls:**
- New chains with SDK compatibility issues
- Limited number of known pools (< 10)
- Need immediate deployment without SDK fixes
- RPC/gas limit conflicts with SDK

**Monad Decision:** Direct calls (like Plasma) due to SDK initialization errors and known pool set.

### 2. **Iterative Debugging Traps**

**What Didn't Work:**
- Trying to override `SUPPORTED_NETWORKS[143]` (wrong data structure - array not object)
- Forcing `isPublic: true` on testnet config instead of mainnet
- Fighting SDK RPC configuration (Gearbox proxy vs Alchemy)
- Attempting to fix SDK internal errors

**What Worked:**
- Copying Plasma's proven fallback pattern
- Using hardcoded pool addresses from user
- Bypassing SDK entirely for chain 143

### 3. **Chain Name Display Pattern**

**Anti-Pattern:**
```javascript
// ❌ Scattered ternaries across codebase
const name = chainId === 1 ? 'Ethereum' : 'Plasma';
```

**Better Pattern:**
```javascript
// ✅ Centralized map with fallback
const chainNames = { 1: 'Ethereum', 143: 'Monad', ... };
const name = chainNames[chainId] || `Chain ${chainId}`;
```

**Future Improvement:** Create a shared `getChainName()` utility function to DRY this up.

---

## Monitoring & Operations

### Bot Startup Diagnostic Output

**Expected startup logs:**
```
🔧 pool-fetcher.js loaded - Monad override will be attempted during SDK init
📦 Gearbox SDK v11.6.4 exports: ...
   SUPPORTED_NETWORKS array (16): Mainnet, Arbitrum, ..., Monad, ...
   All chain configs: Mainnet:1, Arbitrum:42161, ..., Monad:143, ...
   ✅ Monad MAINNET (143) found:
      - Network key: Monad
      - isPublic: true
      - Curators: 2
      - Well-known token: USDT0
```

**This diagnostic helps verify:**
- SDK version is correct (11.6.4+)
- Monad chain is configured in SDK
- Configuration matches expected values

### Pool Discovery Logs

**For SDK-based chains (Ethereum, Arbitrum, etc.):**
```
🔍 Mainnet: Scanning pools via SDK...
🔄 Initializing Gearbox SDK for chain 1...
✅ SDK initialized: 19 markets found
✅ Mainnet: Found 19 pools via SDK
```

**For Monad (fallback):**
```
🔍 Monad: Scanning pools via SDK...
📋 Using direct contract calls for Monad pools
   💎 USDC by Edge UltraYield: $XX,XXX TVL, X.XX% APY
   💎 USDT0 by Edge UltraYield: $XX,XXX TVL, X.XX% APY
   💎 USDT0 by Tulipa: $XX,XXX TVL, X.XX% APY
✅ Monad: Found 3 pools via fallback
```

### Troubleshooting

**If Monad pools show 0 TVL or 0% APY:**
- Check RPC endpoint is responsive: `curl $MONAD_RPC_URL`
- Verify pool addresses in `config.js` match on-chain contracts
- Check if contracts are ERC4626-compliant

**If position scanner doesn't find Monad positions:**
- Verify pool addresses in database match config.js
- Check user's wallet address is correct
- Confirm pool tokens are standard ERC4626

**If notifications don't show "Monad" (shows "Chain 143"):**
- Check all chain name dictionaries are updated
- Look for hardcoded ternaries: `chainId === 1 ? 'Ethereum' : 'Plasma'`
- Add 143: 'Monad' to the map

---

## Deployment Checklist

### Before Deploying Monad Changes:

- [ ] Verify `MONAD_RPC_URL` is set in production `.env`
- [ ] Confirm pool addresses in `config.js` are correct
- [ ] Test locally with `node test-monad-integration.js`
- [ ] Check syntax: `node -c telegram-bot/utils/pool-fetcher.js`
- [ ] Backup database: `cp telegram-bot/gearbox_bot.db telegram-bot/gearbox_bot.db.backup`

### Deployment Steps:

```bash
# 1. Pull latest code
cd /home/ubuntu/gear-defi-agent
git pull origin feature/monad-mainnet-support

# 2. Install dependencies (if package.json changed)
npm install

# 3. Restart bot
pm2 restart gearbox-telegram-bot gearbox-position-monitor

# 4. Verify in logs (within 30 seconds)
pm2 logs gearbox-telegram-bot | grep -A 10 "Monad"

# 5. Check pool discovery works
pm2 logs gearbox-telegram-bot | grep "pools found across"
# Should show: "✅ Discovered XX pools across 6 chains"
```

### Rollback Procedure:

```bash
git log --oneline -10  # Find previous commit
git reset --hard <previous-commit>
pm2 restart all
```

---

## Performance Considerations

### Monad Chain Performance

**Block Time:** ~400ms (ultra-fast)
**RPC Latency:**
- Public RPC (rpc.monad.xyz): ~90ms
- Alchemy RPC: ~230ms

**Pool Refresh Strategy:**
- All chains scanned every 15 minutes
- Monad uses 3 direct contract calls per pool
- Total Monad scan time: ~1-2 seconds for 3 pools
- No impact on other chains (parallel scanning)

### Caching Strategy

- SDK instances cached per chain (no re-initialization)
- APY data cached for 5 minutes (reduces RPC calls)
- Database pool cache refreshed every 15 minutes

---

## Future Improvements

### Monad-Specific

1. **Dynamic Pool Discovery:**
   - Query Monad curator contracts to auto-discover pools
   - Remove hardcoded addresses from config.js
   - Implement similar to Ethereum fallback (lines 361-418)

2. **Switch to SDK When Stable:**
   - Monitor SDK releases for Monad stability fixes
   - Test SDK initialization periodically
   - Remove fallback once SDK works reliably

3. **Token Detection:**
   - Add Monad token addresses to `wallet-analyzer.js`
   - Enable `/wallet` command to detect Monad holdings
   - Auto-suggest Monad pools when user has compatible tokens

### General Bot Improvements

1. **Centralize Chain Names:**
   ```javascript
   // Create utils/chain-names.js
   module.exports = {
     getChainName: (chainId) => { ... },
     ALL_CHAINS: { 1: 'Ethereum', 143: 'Monad', ... }
   };
   ```

2. **Health Factor Monitoring:**
   - Currently disabled (lending pools only)
   - Enable for leverage positions when Gearbox adds leverage on Monad

3. **Multi-Language Support:**
   - Bot messages currently English only
   - Consider i18n for global users

---

## Git Workflow

**Branch Strategy:**
- `main` - Production-ready code
- `feature/telegram-bot-monitoring` - Bot development
- `feature/monad-mainnet-support` - Monad integration (merge to main when stable)

**Commit History for Monad:**
```
f56e726 feat: Use direct contract calls for Monad (bypass SDK)
8f5bd37 feat: Add Monad chain display support across all commands
e3b637a fix: Use SDK default RPC for Monad to avoid gas limit error
6825ab3 fix: Find Monad mainnet by chain ID 143, not by name
cb89d96 fix: Correct Monad SDK override to use chains object
d3c660a chore: Upgrade SDK to v11.6.4 for Monad mainnet support
e2cb81b feat: Add Monad mainnet support with SDK v11.6.3
```

**Total Changes:** 11 files modified, ~350 lines added

---

## Contact & Resources

**Monad Network:**
- Explorer: https://monadvision.com
- Chain ID: 143
- RPC: https://rpc.monad.xyz
- Docs: https://docs.monad.xyz

**Gearbox Protocol:**
- App: https://app.gearbox.finance
- Docs: https://docs.gearbox.fi
- SDK: https://github.com/Gearbox-protocol/sdk

**Bot Monitoring:**
- PM2 Dashboard: `pm2 monit`
- Live Logs: `pm2 logs gearbox-telegram-bot --lines 100 --raw`
- Stats: `pm2 info gearbox-telegram-bot`

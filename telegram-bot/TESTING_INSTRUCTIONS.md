# Testing Instructions: Transaction Capabilities (Phase 3)

## 🎯 What's New

Phase 3 adds **transaction capabilities** with:
- Progressive 3-step investment flow (Goal → Pool → Amount → Confirm)
- Reown (WalletConnect v2) integration for secure transaction signing
- Smart confirmations (1-tap <1 token, 2-step ≥1 token)
- Deposit into Gearbox lending pools directly from Telegram

---

## 🚀 Quick Start

### 1. Update Code & Dependencies

```bash
cd telegram-bot
npm install
```

### 2. Configuration

The Reown project ID `2abd49041d1b0b2b082b69c65ccb3e52` is already included in the code.

Your `.env` should have:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
WALLETCONNECT_PROJECT_ID=2abd49041d1b0b2b082b69c65ccb3e52
```

### 3. Start Bot

```bash
npm start
# or with PM2:
pm2 restart gearbox-telegram-bot
```

Expected output:
```
🔗 Initializing Reown WalletKit client...
✅ Reown WalletKit client initialized
✅ Bot command menu configured
```

---

## 🧪 Testing the `/invest` Flow

### Test 1: Basic Flow

1. Send `/invest` to the bot
2. Select a goal: 📈 Maximize Growth / ⚖️ Balanced / 🛡️ Safety First
3. Select a pool from the list
4. Choose amount (quick select or custom)
5. Review and confirm

### Test 2: WalletConnect Connection

When you confirm a deposit without a connected wallet:

1. Bot sends deep links for MetaMask/Rainbow/Trust Wallet
2. Tap one to open your wallet app
3. Approve the connection
4. Bot confirms: "✅ Wallet Connected!"

### Test 3: Transaction Execution

After connecting:

1. Bot prepares transactions (approval + deposit)
2. Your wallet receives transaction requests
3. Approve both transactions
4. Bot shows: "✅ Deposit Successful!"

---

## 🔍 Key Commands

- `/invest` - Start investment flow
- `/positions` - View your active deposits
- `/help` - Updated help with new commands

---

## 🐛 Common Issues

**"Reown initialization failed"**
→ Project ID is hardcoded, should work automatically

**"No pools available"**
→ Run pool discovery: `node pool-discovery-monitor.js`

**Wallet won't connect**
→ Make sure wallet app is updated to latest version

---

## ✅ Success Criteria

- [ ] `/invest` command works
- [ ] All 3 goals show different filtered pools
- [ ] Amount selection works (quick + custom)
- [ ] Reown connection successful
- [ ] Transactions execute
- [ ] Position saved to database

---

## 📝 Report Issues

If you encounter problems:

1. Check logs: `pm2 logs gearbox-telegram-bot`
2. Check database: `sqlite3 gearbox_bot.db "SELECT * FROM walletconnect_sessions;"`
3. Report with full error message and reproduction steps

---

**Ready to test!** 🎉

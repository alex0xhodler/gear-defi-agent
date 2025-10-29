# Local Testing Guide

## 🚀 Server Running

Your local development server is now running at:
**http://localhost:8000**

## ✅ What to Test

### 1. Wallet Connection (Should Work)

**Steps:**
1. Open http://localhost:8000 in your browser
2. Make sure MetaMask extension is installed
3. Click **"Connect Wallet"** button in the header
4. Approve connection in MetaMask popup
5. Verify wallet address appears in header: `0x1234...5678`

**Expected Result:**
- ✅ Green dot indicator appears
- ✅ Wallet address displayed
- ✅ "Disconnect" button appears
- ✅ Chat panel shows "Wallet Connected" status
- ✅ New quick action "👛 My Wallet" appears

**If Fails:**
- Check MetaMask is installed and unlocked
- Check browser console for errors (F12 → Console)
- Try refreshing the page

---

### 2. UI Components (Should Work)

**Steps:**
1. Test collapsible sidebar (click "Hide Assistant")
2. Test quick action buttons (click any template)
3. Type a message in chat input
4. Check if notifications appear (bottom right)

**Expected Result:**
- ✅ All buttons are clickable
- ✅ UI is responsive
- ✅ No visual glitches

---

### 3. AI Chat (Will NOT Work - Needs Deployment)

**Steps:**
1. Try sending a message: "Find me USDC strategies"
2. Check browser console (F12 → Console)

**Expected Result:**
- ❌ Error: "Failed to fetch" or similar
- ❌ No AI response

**Why:**
- API endpoints (`/api/chat`) only work on Vercel
- Local Python server serves static files only
- Need to deploy to Vercel for backend API functions

**Workaround for Testing:**
To test locally with API, you need:
```bash
# Install Vercel CLI
npm i -g vercel

# Run Vercel dev server
vercel dev

# Then visit http://localhost:3000
```

---

### 4. DefiLlama Integration (Will NOT Work Locally)

Since the API backend isn't running, you can't test:
- ❌ Real strategy queries
- ❌ Wallet analysis
- ❌ Health factor calculations

**These will work after deploying to Vercel.**

---

## 🐛 Known Limitations (Local Development)

| Feature | Works Locally? | Notes |
|---------|---------------|-------|
| Wallet Connection | ✅ Yes | MetaMask integration works |
| UI Components | ✅ Yes | All visual elements work |
| Chat Input | ✅ Yes | Can type messages |
| AI Responses | ❌ No | Needs Vercel backend |
| Strategy Queries | ❌ No | Needs Vercel backend |
| Wallet Analysis | ❌ No | Needs Vercel backend |

---

## 🔍 Debug Checklist

### Check Browser Console (F12 → Console)

**Good Signs:**
- No red errors on page load
- MetaMask connection successful
- UI components rendering

**Bad Signs:**
- `Failed to fetch /api/chat` → Expected (need Vercel deployment)
- `Uncaught ReferenceError` → Check if scripts loaded correctly
- CORS errors → Check api-client.js path

### Check Network Tab (F12 → Network)

**What Should Load:**
- ✅ `index.html` (200 OK)
- ✅ `api-client.js` (200 OK)
- ✅ `web3-config.js` (200 OK)
- ✅ React CDN scripts (200 OK)
- ✅ Tailwind CSS (200 OK)
- ❌ `/api/chat` (404 Not Found) - Expected!

---

## 📊 Test Results Template

Copy and fill out:

```
## Test Results - [Date]

### Wallet Connection
- [ ] Connect button appears
- [ ] MetaMask popup shows
- [ ] Address displays correctly
- [ ] Disconnect works
- [ ] Auto-reconnect on refresh works

### UI Components
- [ ] Sidebar toggle works
- [ ] Quick action buttons clickable
- [ ] Chat input accepts text
- [ ] Notifications appear

### Known Issues
1. API calls fail (expected - need Vercel deployment)
2. [Add any other issues found]

### Browser Tested
- Browser: Chrome/Firefox/Safari
- MetaMask Version: X.XX.X
- OS: macOS/Windows/Linux
```

---

## ⚡ Quick Start Commands

```bash
# Start local server (static files only)
python3 -m http.server 8000

# Stop server (Ctrl+C won't work if backgrounded)
lsof -ti :8000 | xargs kill -9

# Check server is running
lsof -i :8000

# Open in browser (macOS)
open http://localhost:8000
```

---

## 🚀 Next Steps for Full Testing

To test everything including AI chat:

**Option A: Deploy to Vercel** (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Result: Fully working app at https://your-app.vercel.app
```

**Option B: Run Vercel Dev Locally**
```bash
# Install Vercel CLI
npm i -g vercel

# Run dev server (includes API functions)
vercel dev

# Visit: http://localhost:3000
```

---

## 📝 Current Status

- ✅ Frontend fully implemented
- ✅ Wallet connection working
- ✅ UI/UX complete
- ⏳ Backend API (needs Vercel deployment)
- ⏳ AI integration (needs Vercel deployment)
- ⏳ DeFi data (needs Vercel deployment)

**Ready to deploy:** Yes!
**Ready for full testing:** After Vercel deployment

---

## 🎯 What You Should See Right Now

When you open http://localhost:8000:

1. **Header:**
   - "Hide Assistant" button (left)
   - "Connect Wallet" button (right)

2. **Sidebar (Left):**
   - "Assistant" header
   - Chat input with "Send" button
   - 3 quick action template cards
   - Message history area

3. **Main Area (Right):**
   - "Strategies for You" section
   - Empty state: "Create a mandate to start finding opportunities"

4. **After Connecting Wallet:**
   - Header shows: `0x1234...5678` with green dot
   - Quick actions show: 👛 My Wallet + 2 others
   - Chat shows "Wallet Connected" indicator

**If you see all of the above: Frontend is working perfectly! 🎉**

The only thing missing is the backend API, which will work once deployed to Vercel.

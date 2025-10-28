# Gearbox AI Strategy Agent

An AI-powered conversational interface for discovering and deploying leveraged DeFi positions on Gearbox Protocol, powered by Google Gemini 2.0 Flash.

## Features

- 🤖 **AI-Powered Strategy Analysis**: Natural language queries powered by Google Gemini
- 📊 **Real-Time DeFi Data**: Live APY data from DefiLlama for Curve, Convex, Yearn, and more
- 💰 **Wallet Analysis**: Automatic portfolio analysis and recommendations
- 📈 **Health Factor Calculations**: Risk assessment and liquidation price projections
- 🎨 **Chat-First UI**: Intuitive conversational interface with visual strategy cards

## Architecture

```
Frontend (React + Tailwind)
    ↓ HTTPS
Backend API (Vercel Serverless)
    ↓
Google Gemini 2.0 Flash (Function Calling)
    ↓
3 AI Tools:
  - query_farm_opportunities (DefiLlama API)
  - analyze_wallet_holdings (Ethereum RPC)
  - calculate_position_metrics (Gearbox formulas)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key ([Get one here](https://aistudio.google.com))
- Alchemy API key ([Get one here](https://alchemy.com))

### Installation

1. **Clone the repository**
```bash
cd /path/to/gearagent
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

The `.env` file has already been created with your API keys. If you need to modify it:

```bash
# .env
GOOGLE_GEMINI_API_KEY=your_gemini_key_here
ETHEREUM_RPC_URL=your_alchemy_rpc_url
ALCHEMY_API_KEY=your_alchemy_key
```

4. **Run development server**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Project Structure

```
/gearagent
├── index.html              # Main React app (CDN-loaded for MVP)
├── api-client.js           # Frontend API client
├── api/                    # Backend serverless functions
│   ├── chat.ts            # Main Gemini chat endpoint
│   ├── utils/
│   │   └── gemini-client.ts  # Gemini SDK wrapper
│   └── tools/
│       ├── query-strategies.ts    # DefiLlama integration
│       ├── analyze-wallet.ts      # Wallet analysis
│       └── calculate-health.ts    # Health factor calculations
├── package.json
├── tsconfig.json
├── vercel.json            # Deployment configuration
├── .env                   # Environment variables (DO NOT COMMIT!)
└── README.md
```

## API Endpoints

### POST /api/chat

Main chat endpoint for conversing with the AI agent.

**Request:**
```json
{
  "message": "Find me the best USDC farming opportunities",
  "userId": "user_abc123",
  "conversationId": "conv_xyz789"
}
```

**Response:**
```json
{
  "message": "I found 3 excellent USDC strategies...",
  "conversationId": "conv_xyz789",
  "userId": "user_abc123"
}
```

## AI Tools

The Gemini agent has access to 3 specialized tools:

### 1. query_farm_opportunities
Searches for yield farming opportunities matching user criteria.

**Parameters:**
- `asset` (string, required): Token symbol (USDC, WETH, etc.)
- `min_apy` (number, optional): Minimum APY threshold
- `risk_tolerance` (string, optional): "low", "medium", or "high"
- `max_leverage` (number, optional): Maximum leverage (1-10x)

### 2. analyze_wallet_holdings
Analyzes wallet balances and provides recommendations.

**Parameters:**
- `wallet_address` (string, required): Ethereum address (0x...)

### 3. calculate_position_metrics
Calculates health factor and risk metrics for proposed positions.

**Parameters:**
- `collateral_amount` (number, required): Collateral in USD
- `collateral_token` (string, required): Token symbol
- `leverage` (number, required): Leverage multiplier (1-10x)
- `target_apy` (number, required): Expected APY from strategy

## Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (if not already installed)
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel --prod
```

3. **Set environment variables in Vercel dashboard**
   - Go to your project settings
   - Add `GOOGLE_GEMINI_API_KEY`
   - Add `ETHEREUM_RPC_URL`
   - Add `ALCHEMY_API_KEY`

4. **Your app will be live at**: `https://your-project.vercel.app`

### Manual Deployment

The app is built as a Vercel serverless application:
- Frontend: Static HTML/JS served from root
- Backend: TypeScript serverless functions in `/api`

For other platforms (AWS Lambda, Google Cloud Functions), you'll need to adapt the serverless function format.

## Usage Examples

### Example 1: Find Stablecoin Strategies
```
User: "Find me the best USDC farming opportunities with low risk"

AI Agent:
1. Calls query_farm_opportunities(asset="USDC", risk_tolerance="low")
2. Returns: "I found 3 excellent low-risk USDC strategies:
   - Curve 3pool: 6.8% APY, $450M TVL
   - Yearn USDC Vault: 8.2% APY, $180M TVL
   - Convex USDC: 7.5% APY, $320M TVL"
```

### Example 2: Analyze Wallet
```
User: "Analyze my wallet 0x1234..."

AI Agent:
1. Calls analyze_wallet_holdings(wallet_address="0x1234...")
2. Returns: "You have $12,450 across 3 tokens:
   - 10,000 USDC ($10,000)
   - 0.5 WETH ($1,500)
   - 100 DAI ($100)

   Recommendation: Your USDC holdings are ideal for low-risk Curve strategies with 1.5-3x leverage."
```

### Example 3: Calculate Health Factor
```
User: "What's the liquidation risk if I use $10k USDC with 3x leverage?"

AI Agent:
1. Calls calculate_position_metrics(
     collateral_amount=10000,
     collateral_token="USDC",
     leverage=3,
     target_apy=7
   )
2. Returns: "With $10k USDC at 3x leverage:
   - Health Factor: 1.58 (Safe ✅)
   - Liquidation Price: $0.95 (5% below current)
   - Net APY: 16.5% (after borrowing costs)
   - Risk Level: Low"
```

## Development

### Running Locally

```bash
# Start Vercel dev server (includes hot reload)
npm run dev

# Type checking
npm run type-check

# Build TypeScript
npm run build
```

### Testing AI Tools Directly

You can test individual tools by calling the API directly:

```bash
# Test query_farm_opportunities
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find USDC strategies"}'
```

## Configuration

### Gemini Model Settings

Edit `api/utils/gemini-client.ts`:

```typescript
generationConfig: {
  temperature: 0.3,  // Lower = more consistent (0-1)
  maxOutputTokens: 2048,  // Max response length
}
```

### Tool Pricing (if implementing x402 later)

Edit `api/utils/gemini-client.ts`:

```typescript
const pricingMap: Record<string, number> = {
  query_farm_opportunities: 0.10,  // USDC
  calculate_position_metrics: 0.15,
  analyze_wallet_holdings: 0.0,  // Free
};
```

## Security Notes

- ✅ API keys are server-side only (never exposed to frontend)
- ✅ `.env` file is gitignored
- ✅ CORS configured for frontend domain only
- ✅ Rate limiting recommended for production (add Upstash Redis)
- ✅ Input validation on all user inputs

## Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Gemini API errors
- Check API key in `.env`
- Verify quota: https://aistudio.google.com/app/apikey
- Check model name is correct: `gemini-2.0-flash-exp`

### Wallet analysis returns empty
- Verify Alchemy RPC URL is correct
- Check wallet address format (must start with 0x)
- Ensure tokens are on Ethereum mainnet

### DefiLlama API slow/failing
- Use cached fallback data (already implemented)
- Check DefiLlama status: https://defillama.com

## Contributing

This is an MVP. Suggested improvements:

1. **Add Web3 wallet connection** (RainbowKit/WalletConnect)
2. **Implement real Gearbox contract interactions**
3. **Add transaction signing and execution**
4. **Implement real-time position monitoring**
5. **Add x402 payment protocol for premium features**
6. **Migrate frontend to Vite + TypeScript**
7. **Add comprehensive error handling**
8. **Implement caching layer (Redis)**
9. **Add analytics and monitoring (PostHog, Sentry)**
10. **Create comprehensive test suite**

## License

MIT

## Support

For issues or questions:
- Create an issue on GitHub
- Check CLAUDE.md for architecture details
- Review API endpoint documentation above

## Credits

- **AI**: Google Gemini 2.0 Flash
- **DeFi Data**: DefiLlama
- **Blockchain Data**: Alchemy
- **Protocol**: Gearbox V3
- **Deployment**: Vercel

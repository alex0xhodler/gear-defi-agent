# 0x.credit

A DeFi credit interface for opening leveraged ETH+ positions on Gearbox Protocol.

## Overview

0x.credit provides a streamlined interface for earning yield on ETH through leveraged ETH+ (Reserve Protocol) positions on Gearbox V3. Users can deposit ETH, select a leverage strategy, and open a credit account that borrows WETH to maximize yield exposure.

## Features

### Real-Time SDK Integration
- Live ETH price from Gearbox price oracle
- Real-time borrow rates from WETH pools
- ETH+/ETH ratio for liquidation price calculation
- ETH+ APY from DefiLlama yields API

### Strategy Presets
| Strategy | Leverage | Risk Level | Description |
|----------|----------|------------|-------------|
| Conservative | 4x | Low | Lower returns, safer position |
| APY Optimized | 5x | Medium | Balanced risk/reward |
| Custom | 1x-6.5x | Variable | Set your own credit multiplier |

### Position Preview
- Net APY calculation using Gearbox formula
- Estimated monthly earnings in USD
- Health factor with risk indicator
- Liquidation price with drop percentage
- Direct link to ETH+/ETH chart on GeckoTerminal

### Safety Features
- Minimum health factor: 1.10
- Minimum position size: 2 ETH
- Real-time balance validation
- Leverage capped based on liquidation threshold

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS 4** - Styling
- **Wagmi v2** - Ethereum interactions
- **ConnectKit** - Wallet connection
- **TanStack Query** - Data fetching/caching
- **Gearbox SDK v11** - Protocol integration
- **Framer Motion** - Animations

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Ethereum RPC URL (Alchemy, Infura, etc.)

### Installation

```bash
cd credit-app
npm install
```

### Environment Variables

Create a `.env` file:

```env
VITE_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:5173` (or next available port).

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

```
src/
├── components/
│   ├── common/           # Shared UI components
│   │   ├── GlassPanel.tsx
│   │   ├── NumberDisplay.tsx
│   │   └── TokenIcon.tsx
│   ├── credit/           # Credit card components
│   │   ├── CreditCard.tsx        # Main form
│   │   ├── CollateralInput.tsx   # Deposit input
│   │   ├── StrategySelector.tsx  # Preset strategies
│   │   ├── LeverageSlider.tsx    # Custom leverage
│   │   ├── PositionPreview.tsx   # Position summary
│   │   └── RiskBar.tsx           # Health indicator
│   └── layout/
│       └── Header.tsx
├── config/
│   ├── tokens.ts         # Supported tokens
│   └── wagmi.ts          # Wallet configuration
├── hooks/
│   └── useGearbox.ts     # React Query hooks
├── lib/
│   └── gearbox/
│       ├── sdk.ts        # SDK service layer
│       ├── constants.ts  # Protocol addresses
│       └── transactions.ts # TX builders
└── App.tsx
```

## Key Calculations

### Net APY Formula
```
Net APY = (baseAPY * leverage) - (borrowRate * (leverage - 1)) - (quotaRate * leverage)
```

### Health Factor
```
HF = (Collateral Value * Liquidation Threshold) / Debt Value
```

For ETH+ on Gearbox: LT = 93%

### Max Leverage (for target HF)
```
maxLeverage = targetHF / (targetHF - LT)
```

For HF >= 1.10 with LT = 0.93: maxLeverage = 6.47x

### Liquidation Drop
```
dropPercent = ((HF - 1) / HF) * 100
liquidationPrice = currentRatio * (1 - dropPercent / 100)
```

## Deployment

### Vercel

The app is configured to deploy at `/credit` path on the main domain.

1. Push to `feature/0x-credit-pilot` branch
2. Merge to main or configure branch deployment
3. Add environment variables in Vercel dashboard:
   - `VITE_ETHEREUM_RPC_URL`
   - `VITE_WALLETCONNECT_PROJECT_ID`

### Manual

```bash
npm run build
# Deploy dist/ folder to any static host
```

## Protocol Integration

### Gearbox V3 Concepts

- **Credit Account**: Smart contract wallet that holds your position
- **Credit Manager**: Manages borrowing limits and collateral
- **Pool**: WETH lending pool that provides leverage
- **Quota**: Fee for using specific collateral tokens

### ETH+ Token

ETH+ is a Reserve Protocol RToken backed by diversified LSTs:
- Address: `0xe72b141df173b999ae7c1adcbf60cc9833ce56a8`
- Composition: Lido stETH, Rocket Pool rETH, Frax ETH, etc.
- Yield: ~3-4% APY from underlying LST rewards

## Resources

- [Gearbox Protocol](https://gearbox.fi)
- [Gearbox Docs](https://docs.gearbox.fi)
- [Reserve Protocol](https://reserve.org)
- [ETH+ on DefiLlama](https://defillama.com/protocol/reserve-protocol)

## License

MIT

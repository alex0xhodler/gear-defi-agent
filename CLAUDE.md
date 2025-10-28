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

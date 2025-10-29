import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

// Define tool schemas for Gearbox DeFi operations
export const TOOL_DEFINITIONS = [
  {
    name: 'query_farm_opportunities',
    description: 'Search for ALL available Gearbox Protocol farming opportunities for a given token. Returns all strategies sorted by APY. Use filters (min_apy, risk_tolerance, max_leverage) ONLY when user explicitly specifies them. By default, show ALL opportunities.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        asset: {
          type: SchemaType.STRING,
          description: 'Token symbol (USDC, WETH, wstETH, etc.)',
        },
        min_apy: {
          type: SchemaType.NUMBER,
          description: 'OPTIONAL: Only use if user explicitly mentions minimum APY requirement',
        },
        risk_tolerance: {
          type: SchemaType.STRING,
          description: 'OPTIONAL: Only use if user explicitly states risk preference (low/medium/high). Otherwise omit to show all opportunities.',
          enum: ['low', 'medium', 'high'],
        },
        max_leverage: {
          type: SchemaType.NUMBER,
          description: 'OPTIONAL: Only use if user explicitly mentions leverage limit. Otherwise omit to show all leverage options.',
        },
      },
      required: ['asset'],
    },
  },
  {
    name: 'analyze_wallet_holdings',
    description: 'Analyze connected wallet to identify available tokens and portfolio value. Returns token balances suitable for Gearbox strategies.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        wallet_address: {
          type: SchemaType.STRING,
          description: 'Ethereum wallet address (0x...)',
        },
      },
      required: ['wallet_address'],
    },
  },
  {
    name: 'calculate_position_metrics',
    description: 'Calculate health factor, liquidation price, and projected returns for a proposed leveraged position.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        collateral_amount: {
          type: SchemaType.NUMBER,
          description: 'Collateral amount in USD',
        },
        collateral_token: {
          type: SchemaType.STRING,
          description: 'Collateral token symbol',
        },
        leverage: {
          type: SchemaType.NUMBER,
          description: 'Leverage multiplier (1-10x)',
        },
        target_apy: {
          type: SchemaType.NUMBER,
          description: 'Target APY from strategy',
        },
      },
      required: ['collateral_amount', 'collateral_token', 'leverage', 'target_apy'],
    },
  },
];

// System prompt defining the agent's persona and capabilities
export const SYSTEM_PROMPT = `You are Sigma, the high-yield lending specialist. You are a friendly DeFi advisor specializing in Gearbox Protocol leverage strategies. Your role is to help users earn rewards on tokens sitting idle in their wallets.

Core Capabilities:
- Analyze wallet holdings to identify available collateral
- Query real-time data for Gearbox Protocol pools directly from on-chain SDK
- Calculate health factors and liquidation risks for leveraged positions
- Recommend leverage ratios based on user risk tolerance
- Explain borrowing costs and net APY after fees

IMPORTANT Query Behavior:
- When querying opportunities, DO NOT apply filters (min_apy, risk_tolerance, max_leverage) unless user EXPLICITLY mentions them
- By default, show ALL available opportunities for a token and let the user choose
- If no opportunities are found with filters, AUTOMATICALLY retry WITHOUT filters
- Always show users what's available first, then help them filter if needed

IMPORTANT Response Format:
- When user asks for opportunities, you MUST call the query_farm_opportunities tool first
- After calling the tool and receiving results, DO NOT list individual strategies in your chat response
- The UI will automatically display the strategies as buttons below the chat
- Simply say: "I found X opportunities for TOKEN." (period, no additional instructions)
- DO NOT say "Tap any strategy below" or similar - the buttons are self-explanatory
- DO NOT use [TOKEN] format in this message - just say the token name directly (e.g., "WETH" not "[WETH]")
- DO NOT enumerate the strategies like "1. Strategy A, 2. Strategy B" - the UI handles that
- NEVER say you found opportunities without actually calling query_farm_opportunities first

IMPORTANT Wallet Analysis Flow:
- When analyzing a wallet, ONLY call analyze_wallet_holdings and describe what the user has
- DO NOT call query_farm_opportunities in the same turn
- After describing holdings, say something like: "Which token would you like to start with?"
- DO NOT use any special token format like [TOKEN] - the UI will automatically show token buttons
- Keep it conversational and natural
- Wait for user to select a token before calling query_farm_opportunities

Safety Guidelines:
- ALWAYS recommend health factor >1.3 for conservative users, >1.5 for beginners
- Warn about liquidation risks when leverage >5x
- Explain borrowing costs (current ~3-6% APY on most assets)
- Never execute transactions without explicit user approval
- If user's request is unclear, ask clarifying questions

Conversation Style:
- Friendly and helpful, call yourself "Sigma"
- Keep it casual and conversational
- Break down complex concepts (e.g., "Health factor is your safety cushion - higher means safer from liquidation")
- Provide specific numbers (APY percentages, dollar amounts)
- When user says they have tokens, query opportunities for those tokens WITHOUT restrictive filters
- Keep messages short and actionable

Key Terms:
- Health Factor (HF): Ratio of collateral value to debt. HF < 1 = liquidation
- Leverage: Borrowing multiplier (3x means borrow 2x your collateral)
- APY: Annual Percentage Yield (returns)
- TVL: Total Value Locked (protocol size/security)
- Liquidation: Forced position closure when HF drops too low

Premium Features:
- Strategy analysis and optimization requires 0.10 USDC payment
- Position simulation requires 0.15 USDC payment
- Real-time monitoring is free

When a user asks for premium features, explain the cost and wait for their approval before proceeding.`;

// Create Gemini model instance with function calling
export function createGeminiAgent() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    tools: [{ functionDeclarations: TOOL_DEFINITIONS as any }],
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.3, // Lower temperature for more consistent financial advice
      maxOutputTokens: 2048,
    },
  });
}

// Helper to check if tool requires payment (x402 protocol)
export function requiresPayment(toolName: string): { required: boolean; amount: number; currency: string } {
  const pricingMap: Record<string, number> = {
    query_farm_opportunities: 0.10,
    calculate_position_metrics: 0.15,
    analyze_wallet_holdings: 0.0, // Free for MVP
  };

  const amount = pricingMap[toolName] || 0;
  return {
    required: amount > 0,
    amount,
    currency: 'USDC',
  };
}

export type ToolCall = {
  name: string;
  args: Record<string, any>;
};

export type ChatMessage = {
  role: 'user' | 'model' | 'function';
  parts: Array<{ text?: string; functionCall?: ToolCall; functionResponse?: any }>;
};

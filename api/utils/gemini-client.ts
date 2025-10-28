import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

// Define tool schemas for Gearbox DeFi operations
export const TOOL_DEFINITIONS = [
  {
    name: 'query_farm_opportunities',
    description: 'Search for DeFi yield farming opportunities on Gearbox Protocol. Returns curated strategies with APY, TVL, and risk data.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        asset: {
          type: SchemaType.STRING,
          description: 'Token symbol (USDC, WETH, wstETH, etc.)',
        },
        min_apy: {
          type: SchemaType.NUMBER,
          description: 'Minimum acceptable APY percentage',
        },
        risk_tolerance: {
          type: SchemaType.STRING,
          description: 'Risk level: low, medium, or high',
          enum: ['low', 'medium', 'high'],
        },
        max_leverage: {
          type: SchemaType.NUMBER,
          description: 'Maximum leverage multiplier (1-10x)',
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
export const SYSTEM_PROMPT = `You are an expert DeFi advisor specializing in Gearbox Protocol leverage strategies. Your role is to help users discover optimal farming opportunities, assess risks, and execute leveraged positions.

Core Capabilities:
- Analyze wallet holdings to identify available collateral
- Query real-time APY data for Gearbox Protocol pools from DefiLlama
- Calculate health factors and liquidation risks for leveraged positions
- Recommend leverage ratios based on user risk tolerance
- Explain borrowing costs and net APY after fees

Safety Guidelines:
- ALWAYS recommend health factor >1.3 for conservative users, >1.5 for beginners
- Warn about liquidation risks when leverage >5x
- Explain borrowing costs (current ~3-6% APY on most assets)
- Never execute transactions without explicit user approval
- If user's request is unclear, ask clarifying questions

Conversation Style:
- Friendly but professional, use clear DeFi terminology
- Break down complex concepts (e.g., "Health factor is your safety cushion - higher means safer from liquidation")
- Provide specific numbers (APY percentages, dollar amounts, liquidation prices)
- Ask clarifying questions when user intent is ambiguous
- Celebrate successful position openings

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

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGeminiAgent } from './utils/gemini-client';
import { queryFarmOpportunities } from './tools/query-strategies';
import { analyzeWalletHoldings } from './tools/analyze-wallet';
import { calculatePositionMetrics } from './tools/calculate-health';

// In-memory conversation storage (for MVP - use Redis/DB for production)
const conversations = new Map<string, any[]>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, userId = 'anonymous', conversationId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation history
    const historyKey = `${userId}:${conversationId}`;
    let history = conversations.get(historyKey) || [];

    // Create Gemini agent
    const model = createGeminiAgent();
    const chat = model.startChat({
      history: history,
    });

    // Send user message
    let result = await chat.sendMessage(message);
    let response = result.response;

    // Handle function calls (tool execution loop)
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite loops

    while (response.functionCalls() && response.functionCalls()!.length > 0 && attempts < maxAttempts) {
      attempts++;
      const functionCall = response.functionCalls()![0];

      console.log('Function call:', functionCall.name, functionCall.args);

      // Execute the requested tool
      let toolResult: any;
      try {
        toolResult = await executeTool(functionCall.name, functionCall.args);
      } catch (error: any) {
        toolResult = { error: error.message || 'Tool execution failed' };
      }

      // Send function response back to model
      result = await chat.sendMessage([
        {
          functionResponse: {
            name: functionCall.name,
            response: toolResult,
          },
        },
      ]);

      response = result.response;
    }

    // Get final text response
    const textResponse = response.text();

    // Update conversation history
    history = await chat.getHistory();
    conversations.set(historyKey, history);

    // Return response with optional strategy data
    return res.status(200).json({
      message: textResponse,
      conversationId,
      userId,
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message || 'Unknown error',
    });
  }
}

// Execute tool functions
async function executeTool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'query_farm_opportunities':
      return await queryFarmOpportunities({
        asset: args.asset,
        min_apy: args.min_apy,
        risk_tolerance: args.risk_tolerance,
        max_leverage: args.max_leverage,
      });

    case 'analyze_wallet_holdings':
      return await analyzeWalletHoldings({
        wallet_address: args.wallet_address,
      });

    case 'calculate_position_metrics':
      return await calculatePositionMetrics({
        collateral_amount: args.collateral_amount,
        collateral_token: args.collateral_token,
        leverage: args.leverage,
        target_apy: args.target_apy,
      });

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

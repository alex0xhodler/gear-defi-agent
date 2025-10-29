import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGeminiAgent } from './utils/gemini-client.js';
import { queryFarmOpportunities } from './tools/query-strategies.js';
import { analyzeWalletHoldings } from './tools/analyze-wallet.js';
import { calculatePositionMetrics } from './tools/calculate-health.js';

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
      const functionCalls = response.functionCalls()!;

      console.log(`Processing ${functionCalls.length} function calls`);

      // Execute ALL requested tools and collect results
      const functionResponses = [];
      for (const functionCall of functionCalls) {
        console.log('Function call:', functionCall.name, functionCall.args);

        let toolResult: any;
        try {
          toolResult = await executeTool(functionCall.name, functionCall.args);
        } catch (error: any) {
          toolResult = { error: error.message || 'Tool execution failed' };
        }

        functionResponses.push({
          functionResponse: {
            name: functionCall.name,
            response: {
              name: functionCall.name,
              content: toolResult,
            },
          },
        });
      }

      // Send ALL function responses back to model at once
      result = await chat.sendMessage(functionResponses);

      response = result.response;
    }

    // Get final text response
    const textResponse = response.text();

    // Update conversation history
    history = await chat.getHistory();
    conversations.set(historyKey, history);

    // Check if we have strategy results or wallet tokens from the last tool execution
    let strategies = null;
    let walletTokens = null;
    if (attempts > 0) {
      console.log('🔍 Checking for tool results in history. Attempts:', attempts);

      // Get the last function call from history
      const lastFunctionCall = history
        .slice()
        .reverse()
        .find((entry: any) => entry.role === 'function');

      console.log('📜 Last function call:', JSON.stringify(lastFunctionCall, null, 2));

      if (lastFunctionCall?.parts?.[0]?.functionResponse?.response?.content) {
        const content = lastFunctionCall.parts[0].functionResponse.response.content;
        console.log('📦 Content type:', Array.isArray(content) ? 'array' : typeof content);
        console.log('📦 Content:', JSON.stringify(content, null, 2));

        // Check if it's an array of opportunities (strategies)
        if (Array.isArray(content) && content.length > 0 && content[0].projAPY !== undefined) {
          strategies = content;
          console.log('✅ Extracted strategies:', strategies.length);
        }
        // Check if it's wallet analysis result with gearboxCompatible tokens
        else if (content.gearboxCompatible && Array.isArray(content.gearboxCompatible)) {
          walletTokens = content.gearboxCompatible.map((token: any) => ({
            symbol: token.symbol,
            balance: token.balance,
            valueUSD: token.valueUSD
          }));
          console.log('✅ Extracted wallet tokens:', walletTokens);
        } else {
          console.log('❌ Content is not a valid strategies array or wallet analysis');
        }
      } else {
        console.log('❌ No function response content found');
      }
    }

    // Return response with optional strategy data and wallet tokens
    return res.status(200).json({
      message: textResponse,
      conversationId,
      userId,
      strategies, // Include strategies if available
      walletTokens, // Include wallet tokens if available
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message || 'Unknown error',
    });
  }
}

// Map user wallet tokens to Gearbox-compatible tokens
function mapTokenToGearbox(token: string): string {
  const tokenMap: Record<string, string> = {
    'ETH': 'WETH',           // ETH must be wrapped for Gearbox
    // Direct mappings (already Gearbox-compatible)
    'USDC': 'USDC',
    'USDT': 'USDT',
    'DAI': 'DAI',
    'WETH': 'WETH',
    'wstETH': 'wstETH',
    'WBTC': 'WBTC',
    'GHO': 'GHO',            // GHO is directly supported by Gearbox
    'sUSDe': 'sUSDe',        // sUSDe is directly supported by Gearbox
  };

  return tokenMap[token.toUpperCase()] || token;
}

// Execute tool functions
async function executeTool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'query_farm_opportunities':
      // Map user token to Gearbox-compatible token
      const mappedAsset = args.asset ? mapTokenToGearbox(args.asset) : args.asset;
      console.log(`🔄 Token mapping: ${args.asset} → ${mappedAsset}`);

      return await queryFarmOpportunities({
        asset: mappedAsset,
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

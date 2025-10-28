// Tool implementation: analyze_wallet_holdings
// Analyzes wallet token balances using Etherscan API (free tier for MVP)

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  valueUSD: number;
}

export interface WalletAnalysis {
  address: string;
  totalValueUSD: number;
  tokens: TokenBalance[];
  gearboxCompatible: TokenBalance[];
  recommendations: string[];
}

// Gearbox-compatible tokens on Ethereum
const GEARBOX_TOKENS = [
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'wstETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', decimals: 18 },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
];

// Simple price oracle using CoinGecko API (free, no auth required)
async function fetchTokenPrices(): Promise<Record<string, number>> {
  try {
    const symbols = GEARBOX_TOKENS.map(t => t.symbol.toLowerCase()).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,dai,ethereum,wrapped-steth,wrapped-bitcoin&vs_currencies=usd`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error('Price API error');
    }

    const data: any = await response.json();

    // Map CoinGecko IDs to symbols
    return {
      USDC: data['usd-coin']?.usd || 1,
      USDT: data['tether']?.usd || 1,
      DAI: data['dai']?.usd || 1,
      WETH: data['ethereum']?.usd || 3000,
      wstETH: data['wrapped-steth']?.usd || 3500,
      WBTC: data['wrapped-bitcoin']?.usd || 60000,
    };
  } catch (error) {
    console.error('Error fetching prices:', error);
    // Fallback prices
    return {
      USDC: 1,
      USDT: 1,
      DAI: 1,
      WETH: 3000,
      wstETH: 3500,
      WBTC: 60000,
    };
  }
}

// Fetch token balances using Etherscan API or Alchemy (fallback to mock for MVP)
async function fetchTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  // For MVP, we'll use a simple approach with public RPC
  // In production, use Alchemy's token balance API for better reliability

  try {
    const prices = await fetchTokenPrices();
    const balances: TokenBalance[] = [];

    for (const token of GEARBOX_TOKENS) {
      try {
        // Query ERC20 balanceOf via RPC
        const response = await fetch(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: token.address,
                data: `0x70a08231000000000000000000000000${walletAddress.slice(2)}`, // balanceOf(address)
              },
              'latest',
            ],
            id: 1,
          }),
        });

        const data: any = await response.json();
        const balanceHex = data.result || '0x0';
        const balanceRaw = BigInt(balanceHex);
        const balance = Number(balanceRaw) / Math.pow(10, token.decimals);

        if (balance > 0) {
          const valueUSD = balance * (prices[token.symbol] || 0);
          balances.push({
            symbol: token.symbol,
            name: token.symbol, // Simplified for MVP
            balance: balance.toFixed(4),
            decimals: token.decimals,
            valueUSD,
          });
        }
      } catch (err) {
        console.error(`Error fetching ${token.symbol} balance:`, err);
      }
    }

    return balances;
  } catch (error) {
    console.error('Error in fetchTokenBalances:', error);
    return [];
  }
}

export async function analyzeWalletHoldings(params: {
  wallet_address: string;
}): Promise<WalletAnalysis> {
  const { wallet_address } = params;

  // Validate address format
  if (!wallet_address.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error('Invalid Ethereum address format');
  }

  try {
    const tokens = await fetchTokenBalances(wallet_address);
    const totalValueUSD = tokens.reduce((sum, t) => sum + t.valueUSD, 0);

    // Filter for Gearbox-compatible tokens with meaningful balances
    const gearboxCompatible = tokens.filter(t => t.valueUSD > 10); // Minimum $10

    // Generate recommendations
    const recommendations: string[] = [];

    if (gearboxCompatible.length === 0) {
      recommendations.push('No Gearbox-compatible tokens found. Consider depositing USDC, WETH, or wstETH.');
    } else {
      const stablecoins = gearboxCompatible.filter(t => ['USDC', 'USDT', 'DAI'].includes(t.symbol));
      const eth = gearboxCompatible.find(t => t.symbol === 'WETH' || t.symbol === 'wstETH');

      if (stablecoins.length > 0) {
        const stableValue = stablecoins.reduce((sum, t) => sum + t.valueUSD, 0);
        recommendations.push(`You have $${stableValue.toFixed(2)} in stablecoins. Consider low-risk Curve/Yearn strategies with 1.5-3x leverage.`);
      }

      if (eth) {
        recommendations.push(`You have ${eth.balance} ${eth.symbol} ($${eth.valueUSD.toFixed(2)}). Lido and Curve strategies offer 7-10% APY with leverage.`);
      }

      if (totalValueUSD > 10000) {
        recommendations.push('Your portfolio size qualifies for diversified strategies across multiple protocols.');
      } else if (totalValueUSD > 1000) {
        recommendations.push('Start with a single high-APY strategy and compound profits.');
      }
    }

    return {
      address: wallet_address,
      totalValueUSD,
      tokens,
      gearboxCompatible,
      recommendations,
    };
  } catch (error) {
    console.error('Error analyzing wallet:', error);

    // Return mock data if API fails (for demo purposes)
    return {
      address: wallet_address,
      totalValueUSD: 0,
      tokens: [],
      gearboxCompatible: [],
      recommendations: ['Unable to fetch wallet data. Please try again or connect wallet.'],
    };
  }
}

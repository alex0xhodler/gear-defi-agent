/**
 * Wallet Token Analyzer
 * Scans wallet for ERC20 token balances and provides Gearbox strategy recommendations
 * Ported from /api/tools/analyze-wallet.ts for Telegram bot use
 */

const config = require('../config');

// Gearbox-compatible tokens across all supported chains
const GEARBOX_TOKENS = [
  // Ethereum Mainnet
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, chainId: 1 },
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, chainId: 1 },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, chainId: 1 },
  { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, chainId: 1 },
  { symbol: 'wstETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', decimals: 18, chainId: 1 },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, chainId: 1 },
  { symbol: 'GHO', address: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f', decimals: 18, chainId: 1 },
  { symbol: 'sUSDe', address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497', decimals: 18, chainId: 1 },
  // Plasma
  { symbol: 'USDT0', address: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb', decimals: 6, chainId: 9745 },
];

/**
 * Fetch token prices from CoinGecko (free API, no auth)
 */
async function fetchTokenPrices() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,dai,ethereum,wrapped-steth,wrapped-bitcoin,gho,ethena-staked-usde&vs_currencies=usd',
      {
        headers: { 'Accept': 'application/json' },
        timeout: 5000,
      }
    );

    if (!response.ok) {
      throw new Error('CoinGecko API error');
    }

    const data = await response.json();

    return {
      USDC: data['usd-coin']?.usd || 1,
      USDT: data['tether']?.usd || 1,
      USDT0: 1, // Plasma USDT pegged to $1
      DAI: data['dai']?.usd || 1,
      WETH: data['ethereum']?.usd || 3000,
      ETH: data['ethereum']?.usd || 3000,
      wstETH: data['wrapped-steth']?.usd || 3500,
      WBTC: data['wrapped-bitcoin']?.usd || 60000,
      GHO: data['gho']?.usd || 1,
      sUSDe: data['ethena-staked-usde']?.usd || 1,
    };
  } catch (error) {
    console.error('⚠️  Error fetching token prices:', error.message);
    // Fallback prices
    return {
      USDC: 1,
      USDT: 1,
      USDT0: 1,
      DAI: 1,
      WETH: 3000,
      ETH: 3000,
      wstETH: 3500,
      WBTC: 60000,
      GHO: 1,
      sUSDe: 1,
    };
  }
}

/**
 * Fetch token balances for a wallet address
 * @param {string} walletAddress - Ethereum address (0x...)
 * @returns {Promise<Array>} Array of token balances
 */
async function fetchTokenBalances(walletAddress) {
  try {
    const prices = await fetchTokenPrices();
    const balances = [];

    // Check native ETH balance on Ethereum mainnet
    try {
      const ethRpc = config.blockchain.chains.Mainnet.rpcUrl;
      const response = await fetch(ethRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [walletAddress, 'latest'],
          id: 1,
        }),
        timeout: 10000,
      });

      const data = await response.json();
      const balanceHex = data.result || '0x0';
      const balanceRaw = BigInt(balanceHex);
      const balance = Number(balanceRaw) / Math.pow(10, 18);

      if (balance > 0.001) { // Filter dust (< 0.001 ETH)
        const valueUSD = balance * prices['ETH'];
        balances.push({
          symbol: 'ETH',
          name: 'Ethereum',
          balance: balance.toFixed(4),
          decimals: 18,
          valueUSD,
          chainId: 1,
        });
      }
    } catch (err) {
      console.error('⚠️  Error fetching ETH balance:', err.message);
    }

    // Check ERC20 tokens on all supported chains
    for (const token of GEARBOX_TOKENS) {
      try {
        // Get RPC URL for this chain
        let rpcUrl;
        if (token.chainId === 1) {
          rpcUrl = config.blockchain.chains.Mainnet.rpcUrl;
        } else if (token.chainId === 9745) {
          rpcUrl = config.blockchain.chains.Plasma.rpcUrl;
        } else if (token.chainId === 42161) {
          rpcUrl = config.blockchain.chains.Arbitrum.rpcUrl;
        } else if (token.chainId === 10) {
          rpcUrl = config.blockchain.chains.Optimism.rpcUrl;
        } else if (token.chainId === 146) {
          rpcUrl = config.blockchain.chains.Sonic.rpcUrl;
        } else {
          continue; // Skip unsupported chains
        }

        // Query ERC20 balanceOf via RPC
        const response = await fetch(rpcUrl, {
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
          timeout: 10000,
        });

        const data = await response.json();
        const balanceHex = data.result || '0x0';
        const balanceRaw = BigInt(balanceHex);
        const balance = Number(balanceRaw) / Math.pow(10, token.decimals);

        // Filter dust balances (< $1)
        if (balance > 0 && balance * (prices[token.symbol] || 1) >= 1) {
          const valueUSD = balance * (prices[token.symbol] || 1);
          balances.push({
            symbol: token.symbol,
            name: token.symbol, // Simplified
            balance: balance.toFixed(4),
            decimals: token.decimals,
            valueUSD,
            chainId: token.chainId,
          });
        }
      } catch (err) {
        console.error(`⚠️  Error fetching ${token.symbol} balance on chain ${token.chainId}:`, err.message);
      }
    }

    return balances;
  } catch (error) {
    console.error('❌ Error in fetchTokenBalances:', error.message);
    return [];
  }
}

/**
 * Suggest strategy based on portfolio size
 * @param {number} totalValueUSD - Total portfolio value in USD
 * @returns {Object} Strategy recommendation
 */
function suggestStrategy(totalValueUSD) {
  if (totalValueUSD < 1000) {
    return {
      strategy: 'conservative',
      minAPY: 3,
      risk: 'Low',
      reason: 'Your portfolio is under $1k - start with low-risk stablecoins',
    };
  } else if (totalValueUSD < 10000) {
    return {
      strategy: 'balanced',
      minAPY: 5,
      risk: 'Medium',
      reason: `Your portfolio ($${totalValueUSD.toFixed(0)}) is perfect for balanced strategies`,
    };
  } else {
    return {
      strategy: 'aggressive',
      minAPY: 7,
      risk: 'High',
      reason: `Your portfolio size ($${totalValueUSD.toFixed(0)}) allows for higher-yield opportunities`,
    };
  }
}

/**
 * Analyze wallet holdings and provide Gearbox recommendations
 * @param {string} walletAddress - Ethereum address
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeWalletHoldings(walletAddress) {
  // Validate address format
  if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error('Invalid Ethereum address format');
  }

  try {
    console.log(`🔍 Analyzing wallet ${walletAddress.slice(0, 10)}...`);

    const tokens = await fetchTokenBalances(walletAddress);
    const totalValueUSD = tokens.reduce((sum, t) => sum + t.valueUSD, 0);

    // Filter for Gearbox-compatible tokens with meaningful balances (>$10)
    const gearboxCompatible = tokens.filter(t => t.valueUSD >= 10);

    // Map user tokens to Gearbox strategy asset names
    const suggestedAssets = [];
    const stablecoins = gearboxCompatible.filter(t =>
      ['USDC', 'USDT', 'DAI', 'GHO', 'sUSDe'].includes(t.symbol)
    );
    const usdt0 = gearboxCompatible.find(t => t.symbol === 'USDT0');
    const eth = gearboxCompatible.find(t => t.symbol === 'WETH' || t.symbol === 'ETH');
    const wstETH = gearboxCompatible.find(t => t.symbol === 'wstETH');
    const wbtc = gearboxCompatible.find(t => t.symbol === 'WBTC');

    // Build suggested assets list with actual balances
    if (stablecoins.length > 0) {
      // Use USDC as representative for all stablecoins
      const totalStableValue = stablecoins.reduce((sum, t) => sum + t.valueUSD, 0);
      suggestedAssets.push({
        asset: 'USDC',
        reason: 'Stablecoins detected',
        valueUSD: totalStableValue,
        tokens: stablecoins,
      });
    }

    if (usdt0) {
      suggestedAssets.push({
        asset: 'USDT0',
        reason: 'Plasma USDT detected',
        valueUSD: usdt0.valueUSD,
        tokens: [usdt0],
      });
    }

    if (eth) {
      suggestedAssets.push({
        asset: 'WETH',
        reason: 'ETH/WETH detected',
        valueUSD: eth.valueUSD,
        tokens: [eth],
      });
    }

    if (wstETH) {
      suggestedAssets.push({
        asset: 'wstETH',
        reason: 'Liquid staking ETH detected',
        valueUSD: wstETH.valueUSD,
        tokens: [wstETH],
      });
    }

    if (wbtc) {
      suggestedAssets.push({
        asset: 'WBTC',
        reason: 'Wrapped Bitcoin detected',
        valueUSD: wbtc.valueUSD,
        tokens: [wbtc],
      });
    }

    // Get smart strategy suggestion
    const strategyRec = suggestStrategy(totalValueUSD);

    console.log(`✅ Analysis complete: ${tokens.length} tokens found, $${totalValueUSD.toFixed(2)} total value`);

    return {
      address: walletAddress,
      totalValueUSD,
      tokens,
      gearboxCompatible,
      suggestedAssets, // Assets to create alerts for
      suggestedStrategy: strategyRec,
    };
  } catch (error) {
    console.error('❌ Error analyzing wallet:', error.message);
    throw error;
  }
}

module.exports = {
  analyzeWalletHoldings,
  fetchTokenBalances,
  suggestStrategy,
  GEARBOX_TOKENS,
};

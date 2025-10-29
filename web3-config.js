// Web3 configuration using Ethers.js (simpler, better CDN support)
// This file is loaded via script tag in index.html

window.initWeb3 = function() {
  // Check if ethers is loaded
  if (!window.ethers) {
    console.error('❌ Ethers.js not loaded');
    throw new Error('Ethers.js library not loaded');
  }

  // Simple config object with chain info
  const config = {
    chains: {
      1: { name: 'Ethereum', rpc: 'https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6' },
      42161: { name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
      8453: { name: 'Base', rpc: 'https://mainnet.base.org' },
      146: { name: 'Plasma', rpc: 'https://rpc.plasma.to' },
    },
    currentChainId: null,
  };

  console.log('✅ Web3 config initialized with ethers.js');
  return config;
};

// Export for use in React app
window.web3Config = null;

// ERC20 Token ABI (minimal - just balanceOf and decimals)
window.ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

// Common token addresses (Ethereum Mainnet + Plasma)
window.TOKEN_ADDRESSES = {
  // Ethereum Mainnet
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'wstETH': '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'GHO': '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f',
  'sUSDe': '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
  // Plasma (chain ID 146)
  'USDT0': '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb'
};

// Gearbox pool addresses (for deposits)
window.POOL_ADDRESSES = {
  // Plasma USDT0 pool
  '146_USDT0': '0x76309a9a56309104518847bba321c261b7b4a43f'
};

/**
 * Fetch ERC20 token balance for a given address
 * @param {string} tokenSymbol - Token symbol (e.g., 'USDC', 'WETH')
 * @param {string} userAddress - Wallet address
 * @returns {Promise<string>} - Formatted balance as string
 */
window.fetchTokenBalance = async function(tokenSymbol, userAddress) {
  try {
    if (!window.ethereum) {
      throw new Error('No wallet provider found');
    }

    const tokenAddress = window.TOKEN_ADDRESSES[tokenSymbol];
    if (!tokenAddress) {
      throw new Error(`Token address not found for ${tokenSymbol}`);
    }

    // Use viem for reading contract data
    const { createPublicClient, http, formatUnits } = window.viem;

    // Create public client
    const client = createPublicClient({
      transport: http('https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6')
    });

    // Read balance and decimals
    const [balance, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: window.ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress]
      }),
      client.readContract({
        address: tokenAddress,
        abi: window.ERC20_ABI,
        functionName: 'decimals',
        args: []
      })
    ]);

    // Format balance
    const formattedBalance = formatUnits(balance, decimals);

    return parseFloat(formattedBalance).toFixed(4);
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0.00';
  }
};

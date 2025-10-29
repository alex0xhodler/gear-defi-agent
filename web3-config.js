// Web3 configuration for RainbowKit + Wagmi
// This file is loaded via script tag in index.html

// Wait for wagmi and RainbowKit to be loaded from CDN
window.initWeb3 = function() {
  const { http, createConfig } = window.wagmi;
  const { mainnet, arbitrum, base } = window.wagmiChains;
  const { injected, walletConnect } = window.wagmiConnectors;

  // Configure chains
  const chains = [mainnet, arbitrum, base];

  // Create wagmi config
  const config = createConfig({
    chains,
    connectors: [
      injected(),
      walletConnect({
        projectId: 'a8b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5', // WalletConnect Cloud project ID
      }),
    ],
    transports: {
      [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/vdLXgsGx-MhUsfGMCNgEj39i1EUWrTz6'),
      [arbitrum.id]: http(),
      [base.id]: http(),
    },
  });

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

// Common token addresses on Ethereum Mainnet
window.TOKEN_ADDRESSES = {
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'wstETH': '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'GHO': '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f',
  'sUSDe': '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497'
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

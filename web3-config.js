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

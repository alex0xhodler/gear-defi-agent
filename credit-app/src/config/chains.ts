import { mainnet } from 'wagmi/chains';
import { http, createConfig } from 'wagmi';
import { getDefaultConfig } from 'connectkit';

// Custom chain configuration for Ethereum mainnet
export const chains = [mainnet] as const;

// Create wagmi config with ConnectKit
export const config = createConfig(
  getDefaultConfig({
    chains,
    transports: {
      [mainnet.id]: http(import.meta.env.VITE_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'),
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    appName: '0x.credit',
    appDescription: 'One-Tap DeFi Credit - Open Gearbox Credit Accounts',
    appUrl: 'https://0x.credit',
    appIcon: 'https://0x.credit/icon.png',
  })
);

// RPC URL for SDK operations
export const ETHEREUM_RPC_URL = import.meta.env.VITE_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';

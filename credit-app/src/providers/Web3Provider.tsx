import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from 'connectkit';
import { config } from '../config/chains';

// Create a client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
    },
  },
});

// Custom Obsidian theme for ConnectKit
const customTheme = {
  '--ck-font-family': '"Inter", system-ui, -apple-system, sans-serif',
  '--ck-border-radius': '16px',
  '--ck-overlay-background': 'rgba(0, 0, 0, 0.8)',
  '--ck-overlay-backdrop-filter': 'blur(8px)',
  '--ck-modal-box-shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
  '--ck-body-background': '#0a0a0a',
  '--ck-body-background-secondary': '#050505',
  '--ck-body-background-tertiary': '#111111',
  '--ck-body-color': 'rgba(255, 255, 255, 0.95)',
  '--ck-body-color-muted': 'rgba(255, 255, 255, 0.5)',
  '--ck-body-color-muted-hover': 'rgba(255, 255, 255, 0.7)',
  '--ck-body-action-color': '#8b5cf6',
  '--ck-body-divider': 'rgba(255, 255, 255, 0.1)',
  '--ck-primary-button-background': '#8b5cf6',
  '--ck-primary-button-hover-background': '#7c3aed',
  '--ck-primary-button-border-radius': '12px',
  '--ck-primary-button-color': '#ffffff',
  '--ck-secondary-button-background': 'rgba(255, 255, 255, 0.05)',
  '--ck-secondary-button-hover-background': 'rgba(255, 255, 255, 0.1)',
  '--ck-secondary-button-border-radius': '12px',
  '--ck-secondary-button-color': 'rgba(255, 255, 255, 0.95)',
  '--ck-focus-color': '#8b5cf6',
  '--ck-spinner-color': '#8b5cf6',
  '--ck-tooltip-background': '#1a1a1a',
  '--ck-tooltip-color': 'rgba(255, 255, 255, 0.95)',
  '--ck-qr-dot-color': '#8b5cf6',
  '--ck-qr-background': '#ffffff',
};

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          customTheme={customTheme}
          options={{
            hideBalance: false,
            hideTooltips: false,
            hideQuestionMarkCTA: true,
            hideNoWalletCTA: false,
            walletConnectCTA: 'both',
            embedGoogleFonts: true,
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

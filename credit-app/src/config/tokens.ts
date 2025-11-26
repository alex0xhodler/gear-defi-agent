import { type Address } from 'viem';

export interface Token {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  isNative?: boolean;
}

// Native ETH representation
export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address;

// Wrapped ETH on mainnet
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;

// Supported collateral tokens
export const SUPPORTED_TOKENS: Record<string, Token> = {
  ETH: {
    address: ETH_ADDRESS,
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    icon: '/tokens/eth.svg',
    isNative: true,
  },
  WETH: {
    address: WETH_ADDRESS,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: '/tokens/eth.svg',
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '/tokens/usdc.svg',
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    icon: '/tokens/usdt.svg',
  },
} as const;

// Strategy output tokens
export const STRATEGY_TOKENS: Record<string, Token> = {
  wstETH: {
    address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as Address,
    symbol: 'wstETH',
    name: 'Wrapped stETH',
    decimals: 18,
    icon: '/tokens/wsteth.svg',
  },
  stETH: {
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as Address,
    symbol: 'stETH',
    name: 'Lido Staked ETH',
    decimals: 18,
    icon: '/tokens/steth.svg',
  },
} as const;

// Default collateral options for the selector
export const COLLATERAL_OPTIONS = [
  SUPPORTED_TOKENS.ETH,
  SUPPORTED_TOKENS.USDC,
  SUPPORTED_TOKENS.USDT,
];

// Get token by address
export function getTokenByAddress(address: Address): Token | undefined {
  const allTokens = { ...SUPPORTED_TOKENS, ...STRATEGY_TOKENS };
  return Object.values(allTokens).find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

// Get token by symbol
export function getTokenBySymbol(symbol: string): Token | undefined {
  return SUPPORTED_TOKENS[symbol] || STRATEGY_TOKENS[symbol];
}

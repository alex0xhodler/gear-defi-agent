// Gearbox Protocol Constants for Ethereum Mainnet

// ETH+ RToken (Reserve Protocol yield token)
export const ETH_PLUS_ADDRESS = '0xe72b141df173b999ae7c1adcbf60cc9833ce56a8' as const;

// WETH address on Ethereum
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const;

// stETH (Lido) address
export const STETH_ADDRESS = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as const;

// wstETH (Wrapped stETH) address
export const WSTETH_ADDRESS = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as const;

// Gearbox Router V3
export const ROUTER_ADDRESS = '0xF1E0e51A33A041E73eBD987fb6FE41A4e1Ed9e38' as const;

// RAY - 1e27 (used for rate calculations)
export const RAY = BigInt('1000000000000000000000000000');

// Seconds per year for APY calculations
export const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;

// Minimum health factor (1.0 = 10000 in basis points)
export const MIN_HEALTH_FACTOR = 10000n;

// Strategy presets with leverage in basis points (100 = 1x, 400 = 4x)
export const LEVERAGE_PRESETS = {
  conservative: 150, // 1.5x
  apy_optimized: 400, // 4x
  custom: 200, // 2x default
} as const;

// Gearbox multicall action types
export const MULTICALL_ACTIONS = {
  ADD_COLLATERAL: 'addCollateral',
  INCREASE_DEBT: 'increaseDebt',
  DECREASE_DEBT: 'decreaseDebt',
  UPDATE_QUOTA: 'updateQuota',
  WITHDRAW_COLLATERAL: 'withdrawCollateral',
} as const;

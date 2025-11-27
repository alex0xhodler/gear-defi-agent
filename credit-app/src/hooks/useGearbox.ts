import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import {
  getGearboxSDK,
  getETHPlusStrategy,
  getWETHPools,
  getETHPriceUSD,
  getETHPlusAPY,
  getETHPlusToETHRatio,
  calculateNetAPY,
  calculateHealthFactor,
  calculateLiquidationDrop,
  buildOpenLeveragedPositionTx,
  estimateOpenPositionGas,
  getGasPrice,
} from '../lib/gearbox';

// Query keys for caching
export const QUERY_KEYS = {
  sdk: ['gearbox', 'sdk'],
  strategy: ['gearbox', 'strategy', 'eth-plus'],
  pools: ['gearbox', 'pools', 'weth'],
  gasPrice: ['gearbox', 'gas-price'],
  ethPrice: ['gearbox', 'eth-price'],
  ethPlusAPY: ['gearbox', 'eth-plus-apy'],
  ethPlusRatio: ['gearbox', 'eth-plus-ratio'],
} as const;

/**
 * Hook to initialize and access the Gearbox SDK
 */
export function useGearboxSDK() {
  return useQuery({
    queryKey: QUERY_KEYS.sdk,
    queryFn: () => getGearboxSDK(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get the ETH+ leverage strategy data
 * Returns pool rates, credit manager info, and calculated APYs
 */
export function useETHPlusStrategy() {
  return useQuery({
    queryKey: QUERY_KEYS.strategy,
    queryFn: getETHPlusStrategy,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to get all WETH pools
 */
export function useWETHPools() {
  return useQuery({
    queryKey: QUERY_KEYS.pools,
    queryFn: getWETHPools,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get current gas price
 */
export function useGasPrice() {
  return useQuery({
    queryKey: QUERY_KEYS.gasPrice,
    queryFn: getGasPrice,
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchInterval: 15 * 1000, // Refetch every 15 seconds
  });
}

/**
 * Hook to get real-time ETH price from Gearbox price oracle
 */
export function useETHPrice() {
  return useQuery({
    queryKey: QUERY_KEYS.ethPrice,
    queryFn: getETHPriceUSD,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to get ETH+ APY from DefiLlama
 */
export function useETHPlusAPY() {
  return useQuery({
    queryKey: QUERY_KEYS.ethPlusAPY,
    queryFn: getETHPlusAPY,
    staleTime: 5 * 60 * 1000, // 5 minutes (APY doesn't change rapidly)
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to get ETH+/ETH price ratio from Gearbox price oracle
 */
export function useETHPlusRatio() {
  return useQuery({
    queryKey: QUERY_KEYS.ethPlusRatio,
    queryFn: getETHPlusToETHRatio,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

// Position calculation result type
export interface PositionCalculation {
  depositAmount: number;
  depositUSD: number;
  totalPosition: number;
  totalPositionUSD: number;
  borrowAmount: number;
  borrowUSD: number;
  healthFactor: number;
  netAPY: number;
  monthlyEarnings: number;
  liquidationDropPercent: number;
}

/**
 * Hook to calculate position metrics based on deposit amount and leverage
 */
export function usePositionCalculation(
  depositAmount: number,
  leverage: number, // 100 = 1x, 400 = 4x
  ethPrice: number = 3500, // Default ETH price in USD
  strategyBaseAPY: number = 3.5, // ETH+ base APY (~3-4% from diversified LSTs)
  borrowAPY: number = 2.0 // WETH borrow rate
): PositionCalculation {
  const leverageMultiplier = leverage / 100;

  // Calculate amounts
  const depositUSD = depositAmount * ethPrice;
  const totalPosition = depositAmount * leverageMultiplier;
  const totalPositionUSD = depositUSD * leverageMultiplier;
  const borrowAmount = depositAmount * (leverageMultiplier - 1);
  const borrowUSD = borrowAmount * ethPrice;

  // Calculate health factor
  const healthFactor = calculateHealthFactor(totalPositionUSD, borrowUSD);

  // Calculate net APY
  const netAPY = calculateNetAPY(strategyBaseAPY, borrowAPY, leverage);

  // Calculate monthly earnings
  const monthlyEarnings = (totalPositionUSD * (netAPY / 100)) / 12;

  // Calculate liquidation drop percentage
  const liquidationDropPercent = calculateLiquidationDrop(healthFactor);

  return {
    depositAmount,
    depositUSD,
    totalPosition,
    totalPositionUSD,
    borrowAmount,
    borrowUSD,
    healthFactor,
    netAPY,
    monthlyEarnings,
    liquidationDropPercent,
  };
}

/**
 * Hook to open a leveraged ETH+ position
 */
export function useOpenPosition() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      depositAmount,
      leverage,
    }: {
      depositAmount: string; // ETH amount as string
      leverage: number; // 100 = 1x, 400 = 4x
    }) => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected');
      }

      // Get strategy data
      const strategy = await getETHPlusStrategy();
      if (!strategy) {
        throw new Error('ETH+ strategy not available');
      }

      // Build the transaction
      const depositWei = parseEther(depositAmount);
      const tx = await buildOpenLeveragedPositionTx(
        strategy.creditManager,
        depositWei,
        leverage,
        address
      );

      // Estimate gas
      const gasLimit = await estimateOpenPositionGas(tx, address);

      // Send the transaction
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gas: gasLimit,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      return {
        hash,
        receipt,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries after successful transaction
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.strategy });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pools });
    },
  });
}

/**
 * Hook to get estimated gas cost for opening a position
 */
export function useEstimateGas(
  depositAmount: string,
  leverage: number,
  enabled: boolean = true
) {
  const { address } = useAccount();
  const { data: gasPrice } = useGasPrice();

  return useQuery({
    queryKey: ['gearbox', 'estimate-gas', depositAmount, leverage],
    queryFn: async () => {
      if (!address) throw new Error('No address');

      const strategy = await getETHPlusStrategy();
      if (!strategy) throw new Error('Strategy not available');

      const depositWei = parseEther(depositAmount || '0');
      const tx = await buildOpenLeveragedPositionTx(
        strategy.creditManager,
        depositWei,
        leverage,
        address
      );

      const gas = await estimateOpenPositionGas(tx, address);
      const gasCost = gasPrice ? gas * gasPrice : 0n;

      return {
        gasLimit: gas,
        gasPrice: gasPrice || 0n,
        gasCostWei: gasCost,
        gasCostETH: Number(gasCost) / 1e18,
      };
    },
    enabled: enabled && !!address && parseFloat(depositAmount || '0') > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
}

import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useModal } from 'connectkit';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';

import { GlassPanel } from '../common/GlassPanel';
import { CollateralInput } from './CollateralInput';
import { StrategySelector, STRATEGIES, type StrategyType } from './StrategySelector';
import { LeverageSlider } from './LeverageSlider';
import { PositionPreview } from './PositionPreview';
import { type TransactionState } from './ActionButton';
import { type Token, SUPPORTED_TOKENS } from '../../config/tokens';
import { usePositionCalculation, useETHPlusStrategy, useOpenPosition, useETHPrice, useETHPlusAPY, useETHPlusRatio } from '../../hooks/useGearbox';

// Minimum total position requirement (Gearbox minDebt)
const MIN_POSITION_ETH = 2;

// Default values for ETH+ strategy
const DEFAULT_DATA = {
  ethPrice: 3500, // Will be fetched from price oracle
  ethPlusAPY: 3.5, // ETH+ base yield from Reserve Protocol
  wethBorrowRate: 2.0, // Will be fetched from pool
  liquidationThreshold: 0.85,
  maxLeverage: 1000, // Default 10x max (will be capped by HF)
  // Max leverage for HF >= 1.10 with LTV 0.93: 1.10 / (1.10 - 0.93) = 6.47x
  maxLeverageForSafeHF: 647,
};


export function CreditCard() {
  const { address, isConnected } = useAccount();
  const { setOpen } = useModal();

  // State
  const [selectedToken, setSelectedToken] = useState<Token>(SUPPORTED_TOKENS.ETH);
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState<StrategyType>('apy_optimized');
  const [customLeverage, setCustomLeverage] = useState(200);
  const [txState, setTxState] = useState<TransactionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  // Get leverage from strategy or custom
  const leverage = strategy === 'custom' ? customLeverage : STRATEGIES[strategy].leverage;

  // Get user balance
  const { data: balance } = useBalance({
    address,
    token: selectedToken.isNative ? undefined : selectedToken.address,
  });

  // Fetch real-time data from SDK and APIs
  const { data: strategyData } = useETHPlusStrategy();
  const { data: ethPrice } = useETHPrice();
  const { data: ethPlusAPY } = useETHPlusAPY();
  const { data: ethPlusRatio } = useETHPlusRatio();

  // Use real data with fallbacks
  const currentEthPrice = ethPrice ?? DEFAULT_DATA.ethPrice;
  const borrowRate = strategyData?.pool.borrowAPY ?? DEFAULT_DATA.wethBorrowRate;
  const baseAPY = ethPlusAPY ?? strategyData?.ethPlusAPY ?? DEFAULT_DATA.ethPlusAPY;

  // Get max leverage from SDK, capped at HF >= 1.05
  const maxLeverage = strategyData?.maxLeverageForSafeHF ?? DEFAULT_DATA.maxLeverageForSafeHF;

  // Calculate position metrics using the hook
  const depositAmount = parseFloat(amount) || 0;
  const calculations = usePositionCalculation(
    depositAmount,
    leverage,
    currentEthPrice,
    baseAPY,
    borrowRate
  );

  // Transaction hook
  const openPositionMutation = useOpenPosition();

  // Handle token change
  const handleTokenChange = (token: Token) => {
    setSelectedToken(token);
  };

  // Handle strategy change
  const handleStrategyChange = (newStrategy: StrategyType) => {
    setStrategy(newStrategy);
    if (newStrategy !== 'custom') {
      setCustomLeverage(STRATEGIES[newStrategy].leverage);
    }
  };

  // Handle transaction execution
  const handleExecute = async () => {
    if (!isConnected || calculations.depositAmount <= 0) return;

    setErrorMessage(undefined);

    try {
      setTxState('approving');

      // Execute the real transaction
      await openPositionMutation.mutateAsync({
        depositAmount: amount,
        leverage,
      });

      setTxState('success');

      setTimeout(() => {
        setTxState('idle');
        setAmount('');
      }, 3000);

    } catch (error) {
      setTxState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Transaction failed');
    }
  };

  // Format balance for display
  const formattedBalance = balance
    ? formatUnits(balance.value, balance.decimals)
    : '0';

  // Check if user has sufficient balance
  const userBalance = balance ? parseFloat(formatUnits(balance.value, balance.decimals)) : 0;
  const hasSufficientBalance = depositAmount <= userBalance;

  // Check minimum position requirement
  const meetsMinPosition = calculations.totalPosition >= MIN_POSITION_ETH;

  // Check if can execute
  const canExecute = isConnected &&
    depositAmount > 0 &&
    hasSufficientBalance &&
    meetsMinPosition &&
    calculations.healthFactor >= 1.10 &&
    txState === 'idle' &&
    !openPositionMutation.isPending;

  // Determine button error message
  const getButtonError = () => {
    if (!isConnected) return null;
    if (depositAmount <= 0) return 'Enter amount';
    if (!hasSufficientBalance) return 'Insufficient balance';
    if (!meetsMinPosition) return `Min position: ${MIN_POSITION_ETH} ETH`;
    if (calculations.healthFactor < 1.10) return 'Health factor too low';
    return null;
  };
  const buttonError = getButtonError();

  const isLoading = txState !== 'idle' && txState !== 'success' && txState !== 'error';

  return (
    <div className="space-y-4 w-full max-w-md mx-auto">
      {/* Quick Credit Card */}
      <GlassPanel className="p-5 relative overflow-hidden">
        <div className="relative space-y-5">
          {/* Header */}
          <h2 className="text-xl font-semibold text-text-primary">Open Credit</h2>

          {/* Collateral Input */}
          <div className="space-y-2">
            <CollateralInput
              token={selectedToken}
              amount={amount}
              onTokenChange={handleTokenChange}
              onAmountChange={setAmount}
              balance={formattedBalance}
              usdValue={calculations.depositUSD}
              disabled={txState !== 'idle'}
              minPositionLabel={`Min: ${MIN_POSITION_ETH} ETH`}
              minPositionValue={String(MIN_POSITION_ETH)}
            />
            {/* Position size warning */}
            {depositAmount > 0 && !meetsMinPosition && (
              <p className="text-xs text-risk-high flex items-center gap-1">
                <span>⚠</span>
                Total position ({calculations.totalPosition.toFixed(1)} ETH) below {MIN_POSITION_ETH} ETH minimum
              </p>
            )}
          </div>

          {/* Strategy Selector */}
          <StrategySelector
            selected={strategy}
            onSelect={handleStrategyChange}
            disabled={txState !== 'idle'}
            baseAPY={baseAPY}
            borrowRate={borrowRate}
            maxLeverage={maxLeverage}
          />

          {/* Custom Leverage Slider (only shown when custom is selected) */}
          <AnimatePresence>
            {strategy === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LeverageSlider
                  value={Math.min(customLeverage, maxLeverage)}
                  onChange={(val) => setCustomLeverage(Math.min(val, maxLeverage))}
                  max={maxLeverage}
                  disabled={txState !== 'idle'}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassPanel>

      {/* Position Preview Card */}
      <AnimatePresence>
        {depositAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <PositionPreview
              netAPY={calculations.netAPY}
              monthlyEarnings={calculations.monthlyEarnings}
              collateralAmount={depositAmount}
              collateralSymbol={selectedToken.symbol}
              borrowAmount={Math.round(calculations.borrowAmount)}
              borrowSymbol="ETH"
              totalPosition={Math.round(calculations.totalPosition)}
              positionSymbol="ETH+"
              healthFactor={calculations.healthFactor}
              liquidationDropPercent={calculations.liquidationDropPercent}
              currentRatio={ethPlusRatio}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA Button */}
      <motion.button
        onClick={isConnected ? handleExecute : () => setOpen(true)}
        disabled={isConnected && !canExecute}
        className={`
          w-full py-4 rounded-2xl font-semibold text-lg text-white
          transition-all duration-200 shadow-lg
          ${!isConnected
            ? 'bg-gradient-to-r from-accent to-cyan-500 hover:from-accent-light hover:to-cyan-400'
            : canExecute
            ? 'bg-gradient-to-r from-accent to-cyan-500 hover:from-accent-light hover:to-cyan-400'
            : 'bg-white/10 cursor-not-allowed opacity-50'
          }
        `}
        whileTap={canExecute || !isConnected ? { scale: 0.98 } : {}}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {txState === 'approving' && 'Approving...'}
            {txState === 'opening' && 'Opening Account...'}
            {txState === 'leveraging' && 'Applying Leverage...'}
          </span>
        ) : txState === 'success' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">✓</span>
            Success!
          </span>
        ) : !isConnected ? (
          'Connect Wallet'
        ) : buttonError ? (
          buttonError
        ) : (
          `Confirm & Start Earning ~${calculations.netAPY.toFixed(0)}% APY`
        )}
      </motion.button>

      {/* Error message */}
      <AnimatePresence>
        {txState === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-risk-high/10 text-risk-high text-sm text-center"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

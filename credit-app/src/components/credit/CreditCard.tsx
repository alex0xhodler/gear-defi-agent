import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useModal } from 'connectkit';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { GlassPanel } from '../common/GlassPanel';
import { CollateralInput } from './CollateralInput';
import { StrategySelector, STRATEGIES, type StrategyType } from './StrategySelector';
import { LeverageSlider } from './LeverageSlider';
import { PositionPreview } from './PositionPreview';
import { type TransactionState } from './ActionButton';
import { type Token, SUPPORTED_TOKENS } from '../../config/tokens';
import { usePositionCalculation, useETHPlusStrategy, useOpenPosition, useETHPrice, useETHPlusAPY, useETHPlusRatio } from '../../hooks/useGearbox';

const MIN_POSITION_ETH = 2;

const DEFAULT_DATA = {
  ethPrice: 3500,
  ethPlusAPY: 3.5,
  wethBorrowRate: 2.0,
  liquidationThreshold: 0.85,
  maxLeverage: 1000,
  maxLeverageForSafeHF: 647,
};

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export function CreditCard() {
  const { address, isConnected } = useAccount();
  const { setOpen } = useModal();

  const [selectedToken, setSelectedToken] = useState<Token>(SUPPORTED_TOKENS.ETH);
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState<StrategyType>('apy_optimized');
  const [customLeverage, setCustomLeverage] = useState(200);
  const [txState, setTxState] = useState<TransactionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const leverage = strategy === 'custom' ? customLeverage : STRATEGIES[strategy].leverage;

  const { data: balance } = useBalance({
    address,
    token: selectedToken.isNative ? undefined : selectedToken.address,
  });

  const { data: strategyData } = useETHPlusStrategy();
  const { data: ethPrice } = useETHPrice();
  const { data: ethPlusAPY } = useETHPlusAPY();
  const { data: ethPlusRatio } = useETHPlusRatio();

  const currentEthPrice = ethPrice ?? DEFAULT_DATA.ethPrice;
  const borrowRate = strategyData?.pool.borrowAPY ?? DEFAULT_DATA.wethBorrowRate;
  const baseAPY = ethPlusAPY ?? strategyData?.ethPlusAPY ?? DEFAULT_DATA.ethPlusAPY;
  const maxLeverage = strategyData?.maxLeverageForSafeHF ?? DEFAULT_DATA.maxLeverageForSafeHF;

  const depositAmount = parseFloat(amount) || 0;
  const calculations = usePositionCalculation(
    depositAmount,
    leverage,
    currentEthPrice,
    baseAPY,
    borrowRate
  );

  const openPositionMutation = useOpenPosition();

  const handleTokenChange = (token: Token) => {
    setSelectedToken(token);
  };

  const handleStrategyChange = (newStrategy: StrategyType) => {
    setStrategy(newStrategy);
    if (newStrategy !== 'custom') {
      setCustomLeverage(STRATEGIES[newStrategy].leverage);
    }
  };

  const handleExecute = async () => {
    if (!isConnected || calculations.depositAmount <= 0) return;

    setErrorMessage(undefined);

    try {
      setTxState('approving');

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

  const formattedBalance = balance
    ? formatUnits(balance.value, balance.decimals)
    : '0';

  const userBalance = balance ? parseFloat(formatUnits(balance.value, balance.decimals)) : 0;
  const hasSufficientBalance = depositAmount <= userBalance;
  const meetsMinPosition = calculations.totalPosition >= MIN_POSITION_ETH;

  const canExecute = isConnected &&
    depositAmount > 0 &&
    hasSufficientBalance &&
    meetsMinPosition &&
    calculations.healthFactor >= 1.10 &&
    txState === 'idle' &&
    !openPositionMutation.isPending;

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
    <motion.div
      className="space-y-5 w-full max-w-md mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Main Credit Card */}
      <GlassPanel className="p-6 relative overflow-hidden" animate={false}>
        <motion.div className="relative space-y-6" variants={containerVariants}>
          {/* Header */}
          <motion.div variants={itemVariants} className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Open Credit</h2>
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-4 h-4" />
              <span className="text-[11px] font-semibold tracking-wide uppercase">ETH+ Strategy</span>
            </div>
          </motion.div>

          {/* Collateral Input */}
          <motion.div variants={itemVariants} className="space-y-2">
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
            <AnimatePresence>
              {depositAmount > 0 && !meetsMinPosition && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 text-xs text-risk-high px-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Total position ({calculations.totalPosition.toFixed(1)} ETH) below {MIN_POSITION_ETH} ETH minimum</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Strategy Selector */}
          <motion.div variants={itemVariants}>
            <StrategySelector
              selected={strategy}
              onSelect={handleStrategyChange}
              disabled={txState !== 'idle'}
              baseAPY={baseAPY}
              borrowRate={borrowRate}
              maxLeverage={maxLeverage}
            />
          </motion.div>

          {/* Custom Leverage Slider */}
          <AnimatePresence>
            {strategy === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
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
        </motion.div>
      </GlassPanel>

      {/* Position Preview Card */}
      <AnimatePresence>
        {depositAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
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

      {/* Premium CTA Button */}
      <motion.div variants={itemVariants}>
        <motion.button
          onClick={isConnected ? handleExecute : () => setOpen(true)}
          disabled={isConnected && !canExecute}
          className={`
            relative w-full py-4 rounded-2xl font-bold text-base overflow-hidden
            transition-all duration-300 tracking-tight
            ${!isConnected || canExecute
              ? 'bg-gradient-to-r from-accent-light via-accent to-accent-dark text-bg-base shadow-lg'
              : 'bg-bg-surface/60 text-text-muted cursor-not-allowed border border-glass-border'
            }
          `}
          whileHover={(!isConnected || canExecute) ? { scale: 1.01, y: -3 } : {}}
          whileTap={(!isConnected || canExecute) ? { scale: 0.99 } : {}}
        >
          {/* Shimmer effect on enabled button */}
          {(!isConnected || canExecute) && txState === 'idle' && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
            />
          )}

          {/* Glow effect */}
          {(!isConnected || canExecute) && (
            <div className="absolute inset-0 rounded-2xl bg-accent/15 blur-2xl -z-10" aria-hidden="true" />
          )}

          <span className="relative z-10 flex items-center justify-center gap-2.5">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-semibold">
                  {txState === 'approving' && 'Approving...'}
                  {txState === 'opening' && 'Opening Account...'}
                  {txState === 'leveraging' && 'Applying Leverage...'}
                </span>
              </>
            ) : txState === 'success' ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Success!</span>
              </>
            ) : !isConnected ? (
              <span className="font-bold">Connect Wallet</span>
            ) : buttonError ? (
              <span className="font-semibold">{buttonError}</span>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Start Earning <span className="font-extrabold">~{calculations.netAPY.toFixed(0)}%</span> APY</span>
              </>
            )}
          </span>
        </motion.button>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {txState === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="flex items-center gap-2 p-4 rounded-xl bg-risk-high/10 border border-risk-high/20 text-risk-high text-sm"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

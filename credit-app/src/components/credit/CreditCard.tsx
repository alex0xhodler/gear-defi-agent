import { useState, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useModal } from 'connectkit';
import { formatUnits } from 'viem';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';

import { GlassPanel } from '../common/GlassPanel';
import { CollateralInput } from './CollateralInput';
import { LeverageSlider } from './LeverageSlider';
import { RiskBar } from './RiskBar';
import { APYDisplay } from './APYDisplay';
import { ActionButton, type TransactionState } from './ActionButton';
import { type Token, SUPPORTED_TOKENS } from '../../config/tokens';

// Mock data for simulation mode and initial values
const MOCK_DATA = {
  ethPrice: 3500,
  lidoAPY: 3.5,
  wethBorrowRate: 2.0,
  liquidationThreshold: 0.85,
};

export function CreditCard() {
  const { address, isConnected } = useAccount();
  const { setOpen } = useModal();

  // State
  const [selectedToken, setSelectedToken] = useState<Token>(SUPPORTED_TOKENS.ETH);
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(200); // 2x default
  const [txState, setTxState] = useState<TransactionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  // Get user balance
  const { data: balance } = useBalance({
    address,
    token: selectedToken.isNative ? undefined : selectedToken.address,
  });

  // Calculate values
  const calculations = useMemo(() => {
    const depositAmount = parseFloat(amount) || 0;
    const leverageMultiplier = leverage / 100;

    // USD value of deposit
    let tokenPrice = MOCK_DATA.ethPrice;
    if (selectedToken.symbol === 'USDC' || selectedToken.symbol === 'USDT') {
      tokenPrice = 1;
    }
    const depositUSD = depositAmount * tokenPrice;

    // Leveraged position value
    const positionValue = depositUSD * leverageMultiplier;
    const borrowValue = depositUSD * (leverageMultiplier - 1);

    // Health factor calculation
    // HF = (collateralValue * LTV) / debtValue
    // For stETH leverage: collateral = position in stETH, debt = borrowed WETH
    // Since stETH ≈ ETH, we use stETH value / borrowed WETH
    const healthFactor = leverageMultiplier > 1
      ? (positionValue * MOCK_DATA.liquidationThreshold) / borrowValue
      : 10; // No leverage = very safe

    // Net APY calculation
    // Net APY = (Strategy APY × Leverage) - (Borrow Rate × (Leverage - 1))
    const grossAPY = MOCK_DATA.lidoAPY * leverageMultiplier;
    const borrowCost = MOCK_DATA.wethBorrowRate * (leverageMultiplier - 1);
    const netAPY = grossAPY - borrowCost;

    // Liquidation price
    // When position value drops to debt/LTV, liquidation happens
    const liquidationPrice = leverageMultiplier > 1
      ? tokenPrice * (borrowValue / (depositAmount * leverageMultiplier * MOCK_DATA.liquidationThreshold))
      : 0;

    return {
      depositAmount,
      depositUSD,
      positionValue,
      borrowValue,
      healthFactor,
      grossAPY,
      netAPY,
      liquidationPrice,
      tokenPrice,
    };
  }, [amount, leverage, selectedToken]);

  // Handle token change
  const handleTokenChange = (token: Token) => {
    setSelectedToken(token);
    setAmount(''); // Reset amount on token change
  };

  // Handle transaction execution
  const handleExecute = async () => {
    if (!isConnected || calculations.depositAmount <= 0) return;

    setErrorMessage(undefined);

    try {
      // Simulate transaction flow
      setTxState('approving');
      await new Promise(resolve => setTimeout(resolve, 1500));

      setTxState('opening');
      await new Promise(resolve => setTimeout(resolve, 2000));

      setTxState('leveraging');
      await new Promise(resolve => setTimeout(resolve, 1500));

      setTxState('success');

      // Reset after success
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

  // Check if can execute
  const canExecute = isConnected &&
    calculations.depositAmount > 0 &&
    calculations.healthFactor >= 1.05 &&
    txState === 'idle';

  return (
    <GlassPanel className="p-6 w-full max-w-md mx-auto relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />

      {/* Settings button */}
      <button className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 transition-colors text-text-tertiary hover:text-text-secondary">
        <Settings className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="relative space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Open Credit</h2>
          <p className="text-sm text-text-tertiary mt-1">
            Deposit collateral and earn leveraged yields on Lido stETH
          </p>
        </div>

        {/* Collateral Input */}
        <CollateralInput
          token={selectedToken}
          amount={amount}
          onTokenChange={handleTokenChange}
          onAmountChange={setAmount}
          balance={formattedBalance}
          usdValue={calculations.depositUSD}
          disabled={txState !== 'idle'}
        />

        {/* Strategy Output Display */}
        {calculations.depositAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-center py-2"
          >
            <span className="text-text-tertiary text-sm">
              Receives ~{(calculations.depositAmount * (leverage / 100)).toFixed(4)} wstETH equivalent
            </span>
          </motion.div>
        )}

        {/* Leverage Slider */}
        <LeverageSlider
          value={leverage}
          onChange={setLeverage}
          disabled={txState !== 'idle'}
        />

        {/* Risk Bar */}
        <RiskBar healthFactor={calculations.healthFactor} />

        {/* APY Display */}
        <APYDisplay
          netAPY={calculations.netAPY}
          strategyAPY={MOCK_DATA.lidoAPY}
          borrowRate={MOCK_DATA.wethBorrowRate}
          leverage={leverage}
          depositAmount={calculations.depositUSD}
        />

        {/* Liquidation Price Warning */}
        {calculations.liquidationPrice > 0 && leverage > 100 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-text-muted"
          >
            If {selectedToken.symbol} drops to ${calculations.liquidationPrice.toFixed(0)}{' '}
            ({(((calculations.tokenPrice - calculations.liquidationPrice) / calculations.tokenPrice) * 100).toFixed(0)}% drop),
            your position may be liquidated.
          </motion.div>
        )}

        {/* Action Button */}
        <ActionButton
          state={txState}
          onExecute={handleExecute}
          disabled={!canExecute}
          errorMessage={errorMessage}
          isConnected={isConnected}
          onConnect={() => setOpen(true)}
        />
      </div>
    </GlassPanel>
  );
}

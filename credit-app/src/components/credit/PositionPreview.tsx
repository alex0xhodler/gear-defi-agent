import { motion } from 'framer-motion';
import { Droplets, Landmark, CircleDot, ExternalLink } from 'lucide-react';
import { CurrencyDisplay } from '../common/NumberDisplay';

interface PositionPreviewProps {
  netAPY: number;
  monthlyEarnings: number;
  collateralAmount: number;
  collateralSymbol: string;
  borrowAmount: number;
  borrowSymbol: string;
  totalPosition: number;
  positionSymbol: string;
  healthFactor: number;
  liquidationDropPercent: number;
  currentRatio?: number; // Current ETH+/ETH price ratio (e.g., 1.0012)
}

export function PositionPreview({
  netAPY,
  monthlyEarnings,
  collateralAmount,
  collateralSymbol,
  borrowAmount,
  borrowSymbol,
  totalPosition,
  positionSymbol,
  healthFactor,
  liquidationDropPercent,
  currentRatio = 1.0,
}: PositionPreviewProps) {
  // Calculate liquidation price
  const liquidationPrice = currentRatio * (1 - liquidationDropPercent / 100);
  // Determine health status
  const getHealthStatus = (hf: number) => {
    if (hf >= 1.5) return { label: 'Safe', color: 'text-risk-low', barColor: 'bg-risk-low' };
    if (hf >= 1.2) return { label: 'Moderate', color: 'text-risk-medium', barColor: 'bg-risk-medium' };
    return { label: 'Tight', color: 'text-risk-high', barColor: 'bg-risk-high' };
  };

  const healthStatus = getHealthStatus(healthFactor);
  const healthBarWidth = Math.min(Math.max((healthFactor - 1) / 1, 0), 1) * 100;

  return (
    <div className="glass-panel-sm p-5 space-y-5">
      {/* Header */}
      <h3 className="text-lg font-semibold text-text-primary">Credit Preview</h3>

      {/* APY and Earnings Row */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-text-tertiary mb-1">Total Net APY</p>
          <motion.p
            key={netAPY.toFixed(0)}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-bold text-gradient"
          >
            ~{netAPY.toFixed(0)}%
          </motion.p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-tertiary mb-1">Est. Monthly Earnings</p>
          <motion.p
            key={monthlyEarnings.toFixed(0)}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-bold text-cyan-400"
          >
            ~<CurrencyDisplay value={monthlyEarnings} decimals={0} />
          </motion.p>
        </div>
      </div>

      {/* Position Breakdown */}
      <div className="flex items-center justify-between py-4 border-t border-b border-white/10">
        {/* Collateral */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Droplets className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Your Collateral</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {collateralAmount} {collateralSymbol}
          </p>
        </div>

        <span className="text-text-muted text-xl">+</span>

        {/* Borrowed */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Landmark className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Protocol Borrow</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {borrowAmount} {borrowSymbol}
          </p>
        </div>

        <span className="text-text-muted text-xl">=</span>

        {/* Total Position */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <CircleDot className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-text-tertiary">Total Active Position</span>
          </div>
          <p className="text-lg font-semibold text-cyan-400">
            {totalPosition} {positionSymbol}
          </p>
        </div>
      </div>

      {/* Health Bar */}
      <div className="space-y-2">
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${healthStatus.barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${healthBarWidth}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            style={{
              background: healthFactor >= 1.5
                ? 'linear-gradient(90deg, #22c55e, #22c55e)'
                : healthFactor >= 1.2
                ? 'linear-gradient(90deg, #22c55e, #eab308)'
                : 'linear-gradient(90deg, #22c55e, #eab308, #ef4444)',
            }}
          />
        </div>

        {/* Health text */}
        <p className="text-sm text-text-secondary">
          Health Factor:{' '}
          <span className={healthStatus.color}>
            {healthFactor.toFixed(2)} ({healthStatus.label})
          </span>
          . Liquidation if {positionSymbol}/ETH drops{' '}
          <span className="text-risk-high">{liquidationDropPercent.toFixed(1)}%</span>
          {' '}to{' '}
          <span className="text-risk-high font-medium">{liquidationPrice.toFixed(4)}</span>
          {' '}
          <a
            href="https://www.geckoterminal.com/eth/pools/0x7fb53345f1b21ab5d9510adb38f7d3590be6364b"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
    </div>
  );
}

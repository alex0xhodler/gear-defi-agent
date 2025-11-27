import { motion } from 'framer-motion';
import { Landmark, CircleDot, ExternalLink, TrendingUp, ArrowDownToLine } from 'lucide-react';
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
  currentRatio?: number;
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
  const liquidationPrice = currentRatio * (1 - liquidationDropPercent / 100);

  const getHealthStatus = (hf: number) => {
    if (hf >= 1.5) return { label: 'Safe', color: 'text-risk-low', barColor: 'bg-risk-low', bgColor: 'bg-risk-low/10' };
    if (hf >= 1.2) return { label: 'Moderate', color: 'text-risk-medium', barColor: 'bg-risk-medium', bgColor: 'bg-risk-medium/10' };
    return { label: 'Tight', color: 'text-risk-high', barColor: 'bg-risk-high', bgColor: 'bg-risk-high/10' };
  };

  const healthStatus = getHealthStatus(healthFactor);
  const healthBarWidth = Math.min(Math.max((healthFactor - 1) / 1, 0), 1) * 100;

  return (
    <motion.div
      className="glass-panel-sm p-6 space-y-6"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-label-gold">Credit Preview</h3>
        <motion.div
          className="flex items-center gap-1.5 text-accent"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold tracking-wide uppercase">Live</span>
        </motion.div>
      </div>

      {/* APY and Earnings Row */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-label mb-3">Total Net APY</p>
          <motion.div
            key={netAPY.toFixed(0)}
            initial={{ scale: 1.05, opacity: 0, filter: 'blur(6px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring' as const, stiffness: 150, damping: 15 }}
            className="relative"
          >
            <span className="text-hero text-gradient tabular-nums">~{netAPY.toFixed(0)}%</span>
            {/* Glow effect */}
            <div className="absolute inset-0 text-hero text-accent/15 blur-2xl -z-10" aria-hidden="true">~{netAPY.toFixed(0)}%</div>
          </motion.div>
        </div>
        <div className="text-right">
          <p className="text-label mb-3">Est. Monthly</p>
          <motion.div
            key={monthlyEarnings.toFixed(0)}
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' as const, stiffness: 150, damping: 15 }}
          >
            <span className="text-hero-sm text-gradient-subtle tabular-nums">
              +<CurrencyDisplay value={monthlyEarnings} decimals={0} />
            </span>
          </motion.div>
        </div>
      </div>

      {/* Position Breakdown */}
      <div className="glass-inner p-5 rounded-xl">
        <div className="flex items-center justify-between">
          {/* Collateral */}
          <motion.div
            className="text-center flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <ArrowDownToLine className="w-3 h-3 text-text-tertiary" />
              <span className="text-label">Deposit</span>
            </div>
            <p className="text-kpi-sm text-text-primary tabular-nums">
              {collateralAmount} <span className="text-text-tertiary text-sm font-medium">{collateralSymbol}</span>
            </p>
          </motion.div>

          <span className="text-text-muted text-xl font-light mx-3">+</span>

          {/* Borrowed */}
          <motion.div
            className="text-center flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Landmark className="w-3 h-3 text-text-tertiary" />
              <span className="text-label">Borrow</span>
            </div>
            <p className="text-kpi-sm text-text-primary tabular-nums">
              {borrowAmount} <span className="text-text-tertiary text-sm font-medium">{borrowSymbol}</span>
            </p>
          </motion.div>

          <span className="text-text-muted text-xl font-light mx-3">=</span>

          {/* Total Position */}
          <motion.div
            className="text-center flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <CircleDot className="w-3 h-3 text-accent" />
              <span className="text-label-gold">Total</span>
            </div>
            <p className="text-kpi-sm text-accent tabular-nums">
              {totalPosition} <span className="text-accent/60 text-sm font-medium">{positionSymbol}</span>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Health Bar */}
      <div className="space-y-3">
        {/* Progress bar */}
        <div className="relative h-2.5 rounded-full bg-bg-surface/60 border border-glass-border overflow-hidden">
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${healthStatus.barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${healthBarWidth}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.3 }}
            style={{
              boxShadow: `0 0 12px ${healthFactor >= 1.5 ? 'rgba(52, 211, 153, 0.5)' : healthFactor >= 1.2 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(248, 113, 113, 0.5)'}`,
            }}
          />
        </div>

        {/* Health text */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Health Factor:</span>
            <span className={`risk-indicator ${
              healthStatus.label === 'Safe' ? 'risk-low' :
              healthStatus.label === 'Moderate' ? 'risk-medium' : 'risk-high'
            }`}>
              {healthFactor.toFixed(2)} ({healthStatus.label})
            </span>
          </div>
        </div>

        {/* Liquidation info */}
        <motion.div
          className="flex items-center justify-between text-sm text-text-tertiary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <span>
            Liquidation if {positionSymbol}/ETH drops{' '}
            <span className="text-risk-high font-semibold">{liquidationDropPercent.toFixed(1)}%</span>
          </span>
          <a
            href="https://www.geckoterminal.com/eth/pools/0x7fb53345f1b21ab5d9510adb38f7d3590be6364b"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-accent hover:text-accent-light transition-colors group"
          >
            <span className="font-mono text-xs">{liquidationPrice.toFixed(4)}</span>
            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}

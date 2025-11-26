import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { PercentageDisplay, CurrencyDisplay } from '../common/NumberDisplay';
import { useState } from 'react';

interface APYDisplayProps {
  netAPY: number;
  strategyAPY: number;
  borrowRate: number;
  leverage: number;
  depositAmount: number;
  className?: string;
}

export function APYDisplay({
  netAPY,
  strategyAPY,
  borrowRate,
  leverage,
  depositAmount,
  className = '',
}: APYDisplayProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Calculate monthly earnings estimate
  const monthlyEarnings = (depositAmount * leverage * (netAPY / 100)) / 12;
  const isPositive = netAPY > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main APY display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-sm">Net APY</span>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="w-5 h-5 text-risk-low" />
          ) : (
            <TrendingDown className="w-5 h-5 text-risk-high" />
          )}
          <motion.span
            key={netAPY.toFixed(2)}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-3xl font-bold ${isPositive ? 'text-risk-low' : 'text-risk-high'}`}
          >
            <PercentageDisplay value={netAPY} showSign />
          </motion.span>
        </div>
      </div>

      {/* Risk-adjusted subtitle */}
      <div className="text-center">
        <span className="text-xs text-text-muted">Risk Adjusted</span>
      </div>

      {/* Breakdown (collapsible) */}
      <motion.div
        initial={false}
        animate={{ height: showBreakdown ? 'auto' : 0, opacity: showBreakdown ? 1 : 0 }}
        className="overflow-hidden"
      >
        <div className="glass-panel-sm p-3 space-y-2 mt-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Strategy APY (Lido)</span>
            <PercentageDisplay value={strategyAPY} className="text-text-primary" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Leverage</span>
            <span className="text-text-primary">{(leverage / 100).toFixed(1)}x</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Gross APY</span>
            <PercentageDisplay
              value={strategyAPY * (leverage / 100)}
              className="text-text-primary"
            />
          </div>
          <div className="h-px bg-white/10 my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Borrow Rate</span>
            <PercentageDisplay value={-borrowRate * ((leverage / 100) - 1)} className="text-risk-high" />
          </div>
          <div className="h-px bg-white/10 my-2" />
          <div className="flex justify-between text-sm font-medium">
            <span className="text-text-secondary">Net APY</span>
            <PercentageDisplay value={netAPY} showSign className="text-text-primary" />
          </div>
        </div>
      </motion.div>

      {/* Monthly earnings estimate */}
      {depositAmount > 0 && (
        <div className="text-center p-3 rounded-xl bg-white/5">
          <span className="text-xs text-text-muted">Est. Monthly Earnings</span>
          <motion.div
            key={monthlyEarnings.toFixed(2)}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-lg font-semibold ${isPositive ? 'text-risk-low' : 'text-risk-high'}`}
          >
            <CurrencyDisplay value={monthlyEarnings} />
          </motion.div>
        </div>
      )}
    </div>
  );
}

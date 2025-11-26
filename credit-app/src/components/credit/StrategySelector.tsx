import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { calculateNetAPY } from '../../lib/gearbox';

export type StrategyType = 'conservative' | 'apy_optimized' | 'custom';

interface StrategyConfig {
  id: StrategyType;
  label: string;
  leverage: number; // 100 = 1x, 400 = 4x
  riskLevel: 'Low' | 'Medium' | 'High';
}

// Base strategy configurations (without APY - calculated dynamically)
const STRATEGY_CONFIGS: Record<StrategyType, StrategyConfig> = {
  conservative: {
    id: 'conservative',
    label: 'Conservative',
    leverage: 400,
    riskLevel: 'Low',
  },
  apy_optimized: {
    id: 'apy_optimized',
    label: 'APY Optimized',
    leverage: 500,
    riskLevel: 'Medium',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    leverage: 200,
    riskLevel: 'Medium',
  },
};

// Export for use in CreditCard
export const STRATEGIES = STRATEGY_CONFIGS;

export interface Strategy extends StrategyConfig {
  description: string;
  netAPY: number;
}

interface StrategySelectorProps {
  selected: StrategyType;
  onSelect: (strategy: StrategyType) => void;
  disabled?: boolean;
  baseAPY?: number; // ETH+ base APY
  borrowRate?: number; // WETH borrow rate
  maxLeverage?: number; // Max leverage allowed
}

export function StrategySelector({
  selected,
  onSelect,
  disabled = false,
  baseAPY = 3.5,
  borrowRate = 2.0,
  maxLeverage = 525,
}: StrategySelectorProps) {
  const strategyOptions: StrategyType[] = ['conservative', 'apy_optimized', 'custom'];

  // Calculate real APY for each strategy
  const strategiesWithAPY = useMemo(() => {
    const result: Record<StrategyType, Strategy> = {} as Record<StrategyType, Strategy>;

    for (const [key, config] of Object.entries(STRATEGY_CONFIGS)) {
      const strategyType = key as StrategyType;
      // Cap leverage at maxLeverage
      const effectiveLeverage = Math.min(config.leverage, maxLeverage);
      const netAPY = calculateNetAPY(baseAPY, borrowRate, effectiveLeverage);
      const leverageDisplay = (effectiveLeverage / 100).toFixed(1);

      let description: string;
      if (strategyType === 'custom') {
        description = 'Set your own credit multiplier';
      } else {
        description = `~${netAPY.toFixed(0)}% APY, ${config.riskLevel} Risk, ${leverageDisplay}x credit multiplier`;
      }

      result[strategyType] = {
        ...config,
        leverage: effectiveLeverage,
        description,
        netAPY,
      };
    }

    return result;
  }, [baseAPY, borrowRate, maxLeverage]);

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Toggle buttons */}
      <div className="flex rounded-2xl bg-white/5 p-1">
        {strategyOptions.map((strategyId) => {
          const strategy = strategiesWithAPY[strategyId];
          const isSelected = selected === strategyId;

          return (
            <button
              key={strategyId}
              onClick={() => onSelect(strategyId)}
              className={`
                relative flex-1 py-3 px-2 rounded-xl text-sm font-medium
                transition-colors duration-200
                ${isSelected ? 'text-white' : 'text-text-tertiary hover:text-text-secondary'}
              `}
            >
              {isSelected && (
                <motion.div
                  layoutId="strategyIndicator"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-cyan-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{strategy.label}</span>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <motion.p
        key={selected}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-text-secondary text-center"
      >
        {strategiesWithAPY[selected].description}
      </motion.p>
    </div>
  );
}

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { calculateNetAPY } from '../../lib/gearbox';

export type StrategyType = 'conservative' | 'apy_optimized' | 'custom';

interface StrategyConfig {
  id: StrategyType;
  label: string;
  leverage: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

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

export const STRATEGIES = STRATEGY_CONFIGS;

export interface Strategy extends StrategyConfig {
  description: string;
  netAPY: number;
}

interface StrategySelectorProps {
  selected: StrategyType;
  onSelect: (strategy: StrategyType) => void;
  disabled?: boolean;
  baseAPY?: number;
  borrowRate?: number;
  maxLeverage?: number;
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

  const strategiesWithAPY = useMemo(() => {
    const result: Record<StrategyType, Strategy> = {} as Record<StrategyType, Strategy>;

    for (const [key, config] of Object.entries(STRATEGY_CONFIGS)) {
      const strategyType = key as StrategyType;
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
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Toggle buttons */}
      <div className="flex rounded-2xl bg-bg-surface/60 p-1.5 border border-glass-border">
        {strategyOptions.map((strategyId) => {
          const strategy = strategiesWithAPY[strategyId];
          const isSelected = selected === strategyId;

          return (
            <motion.button
              key={strategyId}
              onClick={() => onSelect(strategyId)}
              className={`
                relative flex-1 py-3 px-3 rounded-xl text-sm font-medium
                transition-colors duration-200
                ${isSelected ? 'text-bg-base' : 'text-text-tertiary hover:text-text-secondary'}
              `}
              whileTap={{ scale: 0.98 }}
            >
              {isSelected && (
                <motion.div
                  layoutId="strategyIndicator"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent via-accent to-accent-dark shadow-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 rounded-xl overflow-hidden">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                    />
                  </div>
                </motion.div>
              )}
              <span className="relative z-10 font-semibold">{strategy.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Description with animation */}
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center"
      >
        <p className="text-sm text-text-secondary">
          {strategiesWithAPY[selected].description}
        </p>
        {selected !== 'custom' && (
          <motion.div
            className="mt-2 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className={`risk-indicator ${
              strategiesWithAPY[selected].riskLevel === 'Low' ? 'risk-low' :
              strategiesWithAPY[selected].riskLevel === 'Medium' ? 'risk-medium' : 'risk-high'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                strategiesWithAPY[selected].riskLevel === 'Low' ? 'bg-risk-low' :
                strategiesWithAPY[selected].riskLevel === 'Medium' ? 'bg-risk-medium' : 'bg-risk-high'
              }`} />
              {strategiesWithAPY[selected].riskLevel} Risk
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

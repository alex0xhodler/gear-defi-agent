import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

interface NumberDisplayProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  animate?: boolean;
  className?: string;
  compact?: boolean;
}

export function NumberDisplay({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  animate = true,
  className = '',
  compact = false,
}: NumberDisplayProps) {
  const formattedValue = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
    });
    return formatter.format(value);
  }, [value, decimals, compact]);

  if (!animate) {
    return (
      <span className={className}>
        {prefix}{formattedValue}{suffix}
      </span>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={formattedValue}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className={className}
      >
        {prefix}{formattedValue}{suffix}
      </motion.span>
    </AnimatePresence>
  );
}

interface PercentageDisplayProps {
  value: number;
  showSign?: boolean;
  className?: string;
}

export function PercentageDisplay({
  value,
  showSign = false,
  className = '',
}: PercentageDisplayProps) {
  const isPositive = value >= 0;
  const sign = showSign ? (isPositive ? '+' : '') : '';

  return (
    <NumberDisplay
      value={value}
      prefix={sign}
      suffix="%"
      decimals={2}
      className={`${className} ${
        showSign ? (isPositive ? 'text-risk-low' : 'text-risk-high') : ''
      }`}
    />
  );
}

interface CurrencyDisplayProps {
  value: number;
  currency?: string;
  decimals?: number;
  className?: string;
  compact?: boolean;
}

export function CurrencyDisplay({
  value,
  currency = 'USD',
  decimals = 2,
  className = '',
  compact = false,
}: CurrencyDisplayProps) {
  const formattedValue = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
    });
    return formatter.format(value);
  }, [value, currency, decimals, compact]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={formattedValue}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className={className}
      >
        {formattedValue}
      </motion.span>
    </AnimatePresence>
  );
}

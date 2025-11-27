import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

// Premium spring transitions for buttery smooth number animations
const numberVariants = {
  initial: {
    opacity: 0,
    y: -8,
    scale: 0.95,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 20,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.95,
    filter: 'blur(4px)',
    transition: {
      duration: 0.12,
      ease: 'easeOut' as const,
    },
  },
};

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
        variants={numberVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`inline-block ${className}`}
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
        variants={numberVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`inline-block ${className}`}
      >
        {formattedValue}
      </motion.span>
    </AnimatePresence>
  );
}

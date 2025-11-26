import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface LeverageSliderProps {
  value: number; // 100-500+ (1x-5x+)
  onChange: (value: number) => void;
  min?: number;
  max?: number; // Dynamic max based on SDK params and HF cap
  disabled?: boolean;
}

/**
 * Generate leverage presets for quick selection
 */
function generatePresets(max: number) {
  const presets: { value: number; label: string }[] = [];

  // Always start with 1x (100%)
  presets.push({ value: 100, label: '1x' });

  // Add whole number presets up to max
  for (let i = 200; i <= max; i += 100) {
    presets.push({ value: i, label: `${i / 100}x` });
  }

  // Add max as final option if not a whole number
  if (max % 100 !== 0) {
    const maxLabel = (max / 100).toFixed(1);
    presets.push({ value: max, label: `${maxLabel}x` });
  }

  return presets;
}

export function LeverageSlider({
  value,
  onChange,
  min = 100,
  max = 400,
  disabled = false,
}: LeverageSliderProps) {
  // Generate preset buttons
  const presets = useMemo(() => generatePresets(max), [max]);

  const percentage = ((value - min) / (max - min)) * 100;
  const displayLeverage = (value / 100).toFixed(1);

  // Risk level based on leverage
  const getRiskLevel = () => {
    const leverageMultiplier = value / 100;
    if (leverageMultiplier <= 1.5) return { label: 'Low Risk', color: 'text-risk-low' };
    if (leverageMultiplier <= 2.5) return { label: 'Medium Risk', color: 'text-risk-medium' };
    if (leverageMultiplier <= 3.5) return { label: 'High Risk', color: 'text-risk-high' };
    return { label: 'Very High Risk', color: 'text-risk-high' };
  };

  const risk = getRiskLevel();

  // Track gradient color
  const getTrackGradient = () => {
    const riskPercent = (value - min) / (max - min);
    if (riskPercent <= 0.33) return 'from-risk-low to-risk-low';
    if (riskPercent <= 0.66) return 'from-risk-low via-risk-medium to-risk-medium';
    return 'from-risk-medium via-risk-high to-risk-high';
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header with leverage display */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-text-secondary text-sm">Custom Leverage</span>
          <span className={`ml-2 text-xs ${risk.color}`}>({risk.label})</span>
        </div>
        <motion.div
          key={displayLeverage}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-right"
        >
          <span className="text-3xl font-bold text-text-primary">{displayLeverage}x</span>
        </motion.div>
      </div>

      {/* Quick preset buttons */}
      <div className="flex gap-2">
        {presets.map((preset) => {
          const isSelected = value === preset.value;
          const isMax = preset.value === max && max % 100 !== 0;

          return (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              disabled={disabled}
              className={`
                flex-1 py-2 px-3 rounded-xl text-sm font-medium
                transition-all duration-200
                ${isSelected
                  ? 'bg-accent text-white shadow-lg shadow-accent/25'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
                }
                ${isMax ? 'border border-risk-high/50' : ''}
              `}
            >
              {preset.label}
              {isMax && <span className="ml-1 text-[10px] opacity-60">max</span>}
            </button>
          );
        })}
      </div>

      {/* Slider for fine-tuning */}
      <div className="relative pt-1 pb-2">
        {/* Background track */}
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          {/* Filled track with gradient */}
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${getTrackGradient()}`}
            style={{ width: `${percentage}%` }}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Larger touch area for slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ top: '-8px', height: 'calc(100% + 16px)' }}
        />

        {/* Thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 -ml-2.5 rounded-full bg-white shadow-lg shadow-black/20 border-2 border-accent pointer-events-none"
          style={{ left: `${percentage}%` }}
          initial={false}
          animate={{ left: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* Min/Max labels */}
        <div className="flex justify-between mt-2 text-xs text-text-muted">
          <span>1x</span>
          <span>{(max / 100).toFixed(max % 100 === 0 ? 0 : 1)}x max</span>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-text-muted text-center">
        Higher leverage = higher returns but increased liquidation risk
      </p>
    </div>
  );
}

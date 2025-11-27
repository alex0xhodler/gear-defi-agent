import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function generatePresets(max: number) {
  const presets: { value: number; label: string }[] = [];
  presets.push({ value: 100, label: '1x' });
  for (let i = 200; i <= max; i += 100) {
    presets.push({ value: i, label: `${i / 100}x` });
  }
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
  const presets = useMemo(() => generatePresets(max), [max]);
  const percentage = ((value - min) / (max - min)) * 100;
  const displayLeverage = (value / 100).toFixed(1);

  const getRiskLevel = () => {
    const leverageMultiplier = value / 100;
    if (leverageMultiplier <= 1.5) return { label: 'Low Risk', color: 'text-risk-low', bg: 'bg-risk-low' };
    if (leverageMultiplier <= 2.5) return { label: 'Medium Risk', color: 'text-risk-medium', bg: 'bg-risk-medium' };
    if (leverageMultiplier <= 3.5) return { label: 'High Risk', color: 'text-risk-high', bg: 'bg-risk-high' };
    return { label: 'Very High', color: 'text-risk-high', bg: 'bg-risk-high' };
  };

  const risk = getRiskLevel();

  const getTrackGradient = () => {
    const riskPercent = (value - min) / (max - min);
    if (riskPercent <= 0.33) return 'from-risk-low to-risk-low';
    if (riskPercent <= 0.66) return 'from-risk-low via-risk-medium to-risk-medium';
    return 'from-risk-medium via-risk-high to-risk-high';
  };

  return (
    <div className={`space-y-5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header with leverage display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-label">Custom Leverage</span>
          <span className={`risk-indicator ${
            risk.label === 'Low Risk' ? 'risk-low' :
            risk.label === 'Medium Risk' ? 'risk-medium' : 'risk-high'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${risk.bg}`} />
            {risk.label}
          </span>
        </div>
        <motion.div
          key={displayLeverage}
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-right"
        >
          <span className="text-kpi text-text-primary tabular-nums">{displayLeverage}x</span>
        </motion.div>
      </div>

      {/* Quick preset buttons */}
      <div className="flex gap-2">
        {presets.map((preset) => {
          const isSelected = value === preset.value;

          return (
            <motion.button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              disabled={disabled}
              className={`
                flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold
                transition-all duration-200 relative overflow-hidden
                ${isSelected
                  ? 'bg-accent text-bg-base shadow-lg'
                  : 'bg-bg-surface/60 text-text-secondary hover:bg-bg-surface hover:text-text-primary border border-glass-border'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSelected && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1, delay: 0.2 }}
                />
              )}
              <span className="relative z-10">
                {preset.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Slider */}
      <div className="relative pt-2 pb-4">
        {/* Background track */}
        <div className="h-3 rounded-full bg-bg-surface/60 border border-glass-border overflow-hidden">
          {/* Filled track with gradient */}
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${getTrackGradient()}`}
            style={{ width: `${percentage}%` }}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Input range - invisible but interactive */}
        <input
          type="range"
          min={min}
          max={max}
          step={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ top: '-4px', height: 'calc(100% + 8px)' }}
        />

        {/* Custom thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${percentage}%` }}
          initial={false}
          animate={{ left: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="relative -ml-3">
            {/* Glow effect */}
            <div className="absolute inset-0 w-6 h-6 rounded-full bg-accent/40 blur-md" />
            {/* Thumb */}
            <div className="relative w-6 h-6 rounded-full bg-white shadow-lg border-2 border-accent flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent" />
            </div>
          </div>
        </motion.div>

        {/* Min/Max labels */}
        <div className="flex justify-between mt-3 text-xs text-text-muted font-medium">
          <span>1x</span>
          <span>{(max / 100).toFixed(max % 100 === 0 ? 0 : 1)}x max</span>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-text-muted text-center">
        Higher leverage increases potential returns and liquidation risk
      </p>
    </div>
  );
}

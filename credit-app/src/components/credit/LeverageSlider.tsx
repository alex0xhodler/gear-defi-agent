import { motion } from 'framer-motion';

interface LeverageSliderProps {
  value: number; // 100-400 (1x-4x)
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const leverageMarks = [
  { value: 100, label: '1x' },
  { value: 200, label: '2x' },
  { value: 300, label: '3x' },
  { value: 400, label: '4x' },
];

export function LeverageSlider({
  value,
  onChange,
  min = 100,
  max = 400,
  disabled = false,
}: LeverageSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const displayLeverage = (value / 100).toFixed(1);

  const getColorClass = () => {
    if (value <= 150) return 'from-risk-low to-risk-low';
    if (value <= 250) return 'from-risk-low to-risk-medium';
    if (value <= 350) return 'from-risk-medium to-risk-high';
    return 'from-risk-high to-risk-high';
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm">Leverage</span>
        <motion.span
          key={displayLeverage}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold text-text-primary"
        >
          {displayLeverage}x
        </motion.span>
      </div>

      {/* Slider track */}
      <div className="relative pt-2 pb-6">
        {/* Background track */}
        <div className="h-2 rounded-full bg-white/10">
          {/* Filled track with gradient */}
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${getColorClass()}`}
            style={{ width: `${percentage}%` }}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Slider input (invisible but functional) */}
        <input
          type="range"
          min={min}
          max={max}
          step={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
        />

        {/* Thumb */}
        <motion.div
          className="absolute top-0 w-6 h-6 -mt-2 -ml-3 rounded-full bg-white shadow-lg border-2 border-accent cursor-grab active:cursor-grabbing"
          style={{ left: `${percentage}%` }}
          initial={false}
          animate={{ left: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        />

        {/* Marks */}
        <div className="absolute left-0 right-0 flex justify-between mt-4">
          {leverageMarks.map((mark) => {
            const markPercentage = ((mark.value - min) / (max - min)) * 100;
            const isActive = value >= mark.value;

            return (
              <button
                key={mark.value}
                onClick={() => onChange(mark.value)}
                className={`
                  relative flex flex-col items-center transition-colors
                  ${isActive ? 'text-text-primary' : 'text-text-muted'}
                `}
                style={{ left: `${markPercentage - 50}%` }}
              >
                <span className="w-1 h-1 rounded-full bg-current mb-1" />
                <span className="text-xs font-medium">{mark.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

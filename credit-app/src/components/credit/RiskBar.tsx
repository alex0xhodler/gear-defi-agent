import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Skull } from 'lucide-react';

interface RiskBarProps {
  healthFactor: number;
  liquidationThreshold?: number;
}

type RiskLevel = 'safe' | 'moderate' | 'danger' | 'critical';

function getRiskLevel(hf: number): RiskLevel {
  if (hf >= 1.5) return 'safe';
  if (hf >= 1.2) return 'moderate';
  if (hf >= 1.05) return 'danger';
  return 'critical';
}

const riskConfig: Record<RiskLevel, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof Shield;
  description: string;
}> = {
  safe: {
    label: 'Safe Zone',
    color: 'text-risk-low',
    bgColor: 'bg-risk-low',
    icon: Shield,
    description: 'Low liquidation risk',
  },
  moderate: {
    label: 'Moderate Risk',
    color: 'text-risk-medium',
    bgColor: 'bg-risk-medium',
    icon: AlertTriangle,
    description: 'Monitor your position',
  },
  danger: {
    label: 'High Risk',
    color: 'text-risk-high',
    bgColor: 'bg-risk-high',
    icon: AlertTriangle,
    description: 'Close to liquidation',
  },
  critical: {
    label: 'Liquidation Zone',
    color: 'text-risk-high',
    bgColor: 'bg-risk-high',
    icon: Skull,
    description: 'Immediate liquidation risk',
  },
};

export function RiskBar({ healthFactor, liquidationThreshold = 1.0 }: RiskBarProps) {
  const riskLevel = getRiskLevel(healthFactor);
  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  // Calculate bar position (scale HF 0.9-2.0 to 0-100%)
  const minHF = 0.9;
  const maxHF = 2.0;
  const clampedHF = Math.max(minHF, Math.min(maxHF, healthFactor));
  const percentage = ((clampedHF - minHF) / (maxHF - minHF)) * 100;

  // Zone boundaries
  const dangerZone = ((1.05 - minHF) / (maxHF - minHF)) * 100;
  const moderateZone = ((1.2 - minHF) / (maxHF - minHF)) * 100;
  const safeZone = ((1.5 - minHF) / (maxHF - minHF)) * 100;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-tertiary text-xs">Health Factor:</span>
          <motion.span
            key={healthFactor.toFixed(2)}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-lg font-bold ${config.color}`}
          >
            {healthFactor.toFixed(2)}
          </motion.span>
        </div>
      </div>

      {/* Risk bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-white/5">
        {/* Zone gradients */}
        <div
          className="absolute h-full bg-risk-high/30"
          style={{ width: `${dangerZone}%` }}
        />
        <div
          className="absolute h-full bg-risk-medium/30"
          style={{ left: `${dangerZone}%`, width: `${moderateZone - dangerZone}%` }}
        />
        <div
          className="absolute h-full bg-risk-low/30"
          style={{ left: `${safeZone}%`, width: `${100 - safeZone}%` }}
        />

        {/* Position indicator */}
        <motion.div
          className="absolute top-0 bottom-0 w-1 rounded-full shadow-lg"
          style={{
            backgroundColor: riskLevel === 'safe' ? '#22c55e' :
                            riskLevel === 'moderate' ? '#eab308' : '#ef4444',
          }}
          initial={false}
          animate={{ left: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* Liquidation line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/20"
          style={{ left: `${((liquidationThreshold - minHF) / (maxHF - minHF)) * 100}%` }}
        >
          <Skull className="absolute -top-5 -left-2 w-4 h-4 text-risk-high" />
        </div>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-text-muted">
        <span>Liquidation</span>
        <span>1.2x</span>
        <span>1.5x</span>
        <span>2.0x+</span>
      </div>

      {/* Description */}
      <p className="text-xs text-text-tertiary">{config.description}</p>
    </div>
  );
}

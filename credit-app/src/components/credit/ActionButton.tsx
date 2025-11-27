import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

export type TransactionState = 'idle' | 'approving' | 'opening' | 'leveraging' | 'success' | 'error';

interface ActionButtonProps {
  state: TransactionState;
  onExecute: () => void;
  disabled?: boolean;
  errorMessage?: string;
  isConnected?: boolean;
  onConnect?: () => void;
}

const stateConfig: Record<TransactionState, {
  label: string;
  icon: typeof Loader2 | null;
  className: string;
}> = {
  idle: {
    label: 'Open Credit Account',
    icon: ChevronRight,
    className: 'bg-gradient-to-r from-accent to-accent-dark hover:from-accent-light hover:to-accent',
  },
  approving: {
    label: 'Approving...',
    icon: Loader2,
    className: 'bg-accent/50 cursor-wait',
  },
  opening: {
    label: 'Opening Account...',
    icon: Loader2,
    className: 'bg-accent/50 cursor-wait',
  },
  leveraging: {
    label: 'Applying Leverage...',
    icon: Loader2,
    className: 'bg-accent/50 cursor-wait',
  },
  success: {
    label: 'Success!',
    icon: Check,
    className: 'bg-risk-low cursor-default',
  },
  error: {
    label: 'Try Again',
    icon: AlertCircle,
    className: 'bg-risk-high hover:bg-risk-high/80',
  },
};

export function ActionButton({
  state,
  onExecute,
  disabled = false,
  errorMessage,
  isConnected = true,
  onConnect,
}: ActionButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdDuration = 500; // ms to hold before executing

  const config = stateConfig[state];
  const Icon = config.icon;
  const isLoading = ['approving', 'opening', 'leveraging'].includes(state);
  const canInteract = state === 'idle' || state === 'error';

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = () => {
    if (!canInteract || disabled) return;

    setIsHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / holdDuration, 1);
      setHoldProgress(progress);

      if (progress >= 1) {
        clearInterval(holdTimerRef.current!);
        setIsHolding(false);
        setHoldProgress(0);
        onExecute();
      }
    }, 16);
  };

  const handlePointerUp = () => {
    setIsHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
  };

  // Connect wallet button
  if (!isConnected) {
    return (
      <button
        onClick={onConnect}
        className="w-full py-4 rounded-2xl font-semibold text-lg text-white bg-gradient-to-r from-accent to-accent-dark hover:from-accent-light hover:to-accent transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <motion.button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={disabled || isLoading}
        className={`
          relative w-full py-4 rounded-2xl font-semibold text-lg text-white
          transition-all duration-200 shadow-lg overflow-hidden
          ${config.className}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        whileTap={canInteract && !disabled ? { scale: 0.98 } : {}}
      >
        {/* Hold progress overlay */}
        {isHolding && (
          <motion.div
            className="absolute inset-0 bg-white/20"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: holdProgress }}
            style={{ transformOrigin: 'left' }}
          />
        )}

        {/* Button content */}
        <span className="relative flex items-center justify-center gap-2">
          {Icon && (
            <Icon
              className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
            />
          )}
          {config.label}
        </span>

        {/* Transaction progress bar */}
        {isLoading && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1 bg-white/30"
            initial={{ scaleX: 0 }}
            animate={{
              scaleX: state === 'approving' ? 0.33 :
                      state === 'opening' ? 0.66 : 1
            }}
            style={{ transformOrigin: 'left' }}
            transition={{ duration: 0.5 }}
          />
        )}
      </motion.button>

      {/* Hold hint */}
      <AnimatePresence>
        {canInteract && !disabled && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-xs text-text-muted"
          >
            Hold to confirm
          </motion.p>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {state === 'error' && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-risk-high/10 text-risk-high text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'sm' | 'subtle';
  glow?: boolean;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className = '', variant = 'default', glow = false, ...props }, ref) => {
    const baseClasses = variant === 'sm'
      ? 'glass-panel-sm'
      : variant === 'subtle'
      ? 'bg-white/5 backdrop-blur-md border border-white/5 rounded-xl'
      : 'glass-panel';

    const glowClasses = glow ? 'animate-pulse-glow' : '';

    return (
      <motion.div
        ref={ref}
        className={`${baseClasses} ${glowClasses} ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';

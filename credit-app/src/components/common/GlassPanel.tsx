import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'sm' | 'inner' | 'glow';
  animate?: boolean;
  delay?: number;
}

const variants = {
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 20,
      mass: 1,
    },
  },
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className = '', variant = 'default', animate = true, delay = 0, ...props }, ref) => {
    const variantClasses = {
      default: 'glass-panel',
      sm: 'glass-panel-sm',
      inner: 'glass-inner',
      glow: 'glass-panel hover-glow',
    };

    const baseClasses = variantClasses[variant];

    return (
      <motion.div
        ref={ref}
        className={`${baseClasses} ${className}`}
        initial={animate ? 'hidden' : false}
        animate={animate ? 'visible' : false}
        variants={variants}
        transition={{ delay }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';

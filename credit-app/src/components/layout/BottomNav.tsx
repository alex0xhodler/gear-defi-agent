import { motion } from 'framer-motion';
import { CreditCard, Wallet, TrendingUp, Settings } from 'lucide-react';

type TabId = 'credit' | 'portfolio' | 'earn' | 'settings';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  { id: 'credit' as TabId, label: 'Credit', icon: CreditCard },
  { id: 'portfolio' as TabId, label: 'Portfolio', icon: Wallet },
  { id: 'earn' as TabId, label: 'Earn', icon: TrendingUp },
  { id: 'settings' as TabId, label: 'Settings', icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.2 }}
    >
      <div className="max-w-lg mx-auto">
        <div className="glass-panel-sm px-3 py-2.5 flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl
                  transition-colors duration-200
                  ${isActive
                    ? 'text-accent'
                    : 'text-text-tertiary hover:text-text-secondary'
                  }
                `}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {/* Active background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-accent/10 rounded-xl border border-accent/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Icon with animation */}
                <motion.div
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon className="w-5 h-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
                </motion.div>

                {/* Label */}
                <span className={`text-[10px] font-semibold tracking-wide uppercase relative z-10 ${isActive ? 'text-accent' : ''}`}>
                  {tab.label}
                </span>

                {/* Active glow effect */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-1 left-1/2 w-8 h-1 bg-accent rounded-full blur-sm"
                    initial={{ opacity: 0, x: '-50%' }}
                    animate={{ opacity: 0.6, x: '-50%' }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}

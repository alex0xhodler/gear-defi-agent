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
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2">
      <div className="max-w-lg mx-auto">
        <div className="glass-panel-sm px-2 py-2 flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl
                  transition-all duration-200
                  ${isActive
                    ? 'text-accent'
                    : 'text-text-tertiary hover:text-text-secondary'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-accent/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-xs font-medium relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

import { ConnectKitButton } from 'connectkit';
import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 px-4 py-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
    >
      <div className="max-w-lg mx-auto">
        <div className="glass-panel-sm px-5 py-3.5 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-light via-accent to-accent-dark flex items-center justify-center shadow-lg">
                <span className="text-bg-base font-extrabold text-sm tracking-tighter">0x</span>
              </div>
              {/* Subtle glow behind logo */}
              <div className="absolute inset-0 w-10 h-10 rounded-xl bg-accent/25 blur-xl -z-10" />
            </div>
            <div className="flex flex-col">
              <span className="text-gradient font-bold text-xl leading-none tracking-tight">.credit</span>
              <span className="text-label mt-0.5">Leveraged Yield</span>
            </div>
          </motion.div>

          {/* Wallet Section */}
          <ConnectKitButton.Custom>
            {({ isConnected, isConnecting, show, address, ensName }) => (
              <motion.button
                onClick={show}
                className={`
                  relative px-4 py-2.5 rounded-xl font-medium text-sm
                  transition-all duration-300 overflow-hidden
                  ${isConnected
                    ? 'bg-bg-surface/80 text-text-primary border border-glass-border hover:border-glass-border-light'
                    : 'btn-premium text-bg-base'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    <span>Connecting</span>
                  </span>
                ) : isConnected ? (
                  <span className="flex items-center gap-2.5">
                    {/* Status indicator with pulse */}
                    <span className="relative">
                      <span className="w-2 h-2 rounded-full bg-risk-low block" />
                      <span className="absolute inset-0 w-2 h-2 rounded-full bg-risk-low animate-ping opacity-50" />
                    </span>
                    <span className="font-mono">
                      {ensName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                    </span>
                  </span>
                ) : (
                  <span className="relative z-10">Connect</span>
                )}
              </motion.button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </motion.header>
  );
}

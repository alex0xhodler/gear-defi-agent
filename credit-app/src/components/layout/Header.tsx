import { ConnectKitButton } from 'connectkit';

export function Header() {

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4">
      <div className="max-w-lg mx-auto">
        <div className="glass-panel-sm px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-light to-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">0x</span>
            </div>
            <span className="text-gradient font-semibold text-lg">.credit</span>
          </div>

          {/* Wallet Section */}
          <div className="flex items-center gap-3">
            {/* Connect Button */}
            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address, ensName }) => (
                <button
                  onClick={show}
                  className={`
                    px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200
                    ${isConnected
                      ? 'bg-white/5 hover:bg-white/10 text-text-primary border border-glass-border'
                      : 'bg-gradient-to-r from-accent to-cyan-500 hover:from-accent-light hover:to-cyan-400 text-white'
                    }
                  `}
                >
                  {isConnecting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting...
                    </span>
                  ) : isConnected ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-risk-low" />
                      {ensName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                    </span>
                  ) : (
                    'Connect'
                  )}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      </div>
    </header>
  );
}

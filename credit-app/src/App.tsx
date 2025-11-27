import { useState } from 'react';
import { Toaster } from 'sonner';
import { Web3Provider } from './providers/Web3Provider';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { CreditCard } from './components/credit/CreditCard';

type TabId = 'credit' | 'portfolio' | 'earn' | 'settings';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('credit');

  return (
    <div className="min-h-screen flex flex-col relative grain-overlay">
      {/* Animated mesh gradient background */}
      <div className="mesh-gradient" aria-hidden="true" />

      {/* Main content layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        {/* Main content area with padding for fixed header/nav */}
        <main className="flex-1 pt-24 pb-24 px-4">
          <div className="max-w-lg mx-auto">
            {activeTab === 'credit' && <CreditCard />}

            {activeTab === 'portfolio' && (
              <div className="glass-panel p-8 text-center animate-fade-in-up">
                <h2 className="text-xl font-semibold text-text-primary mb-2">Portfolio</h2>
                <p className="text-text-tertiary">
                  Your active credit positions will appear here
                </p>
              </div>
            )}

            {activeTab === 'earn' && (
              <div className="glass-panel p-8 text-center animate-fade-in-up">
                <h2 className="text-xl font-semibold text-text-primary mb-2">Earn</h2>
                <p className="text-text-tertiary">
                  Discover more yield opportunities
                </p>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="glass-panel p-8 text-center animate-fade-in-up">
                <h2 className="text-xl font-semibold text-text-primary mb-2">Settings</h2>
                <p className="text-text-tertiary">
                  Configure your preferences
                </p>
              </div>
            )}
          </div>
        </main>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Toast notifications */}
        <Toaster
          position="top-center"
          toastOptions={{
            className: 'glass-panel-sm',
            style: {
              background: 'rgba(24, 24, 27, 0.95)',
              border: '1px solid rgba(250, 250, 250, 0.08)',
              color: 'rgba(250, 250, 250, 0.95)',
              backdropFilter: 'blur(20px)',
            },
          }}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;

/**
 * Configuration for Gearbox Strategy Agent Telegram Bot
 *
 * Centralizes all configurable parameters for monitoring intervals,
 * thresholds, notifications, and blockchain settings.
 */

module.exports = {
  // Monitoring Intervals (in milliseconds)
  monitoring: {
    // How often to scan mandates for new opportunities
    mandateScanInterval: 15 * 60 * 1000, // 15 minutes

    // How often to check position APY changes
    positionScanInterval: 15 * 60 * 1000, // 15 minutes

    // How often to check health factors for leveraged positions
    healthFactorCheckInterval: 10 * 60 * 1000, // 10 minutes

    // Cache duration for APY data (reduce API calls)
    apyCacheDuration: 5 * 60 * 1000, // 5 minutes
  },

  // APY Change Thresholds
  apy: {
    // Minor change threshold (notify user)
    minorChangeThreshold: 0.5, // 0.5% change

    // Major change threshold (urgent notification)
    majorChangeThreshold: 2.0, // 2% change

    // Minimum time between APY change notifications for same position
    notificationCooldown: 6 * 60 * 60 * 1000, // 6 hours
  },

  // Health Factor Thresholds (for leveraged positions)
  healthFactor: {
    // Warning threshold (yellow alert)
    warningThreshold: 1.5,

    // Critical threshold (red alert)
    criticalThreshold: 1.2,

    // Liquidation threshold (immediate action required)
    liquidationThreshold: 1.05,

    // Notification cooldown for health factor alerts
    notificationCooldown: 1 * 60 * 60 * 1000, // 1 hour
  },

  // Notification Settings
  notifications: {
    // Mandate opportunity notification cooldown
    mandateCooldown: 24 * 60 * 60 * 1000, // 24 hours

    // APY change notification cooldown
    apyChangeCooldown: 6 * 60 * 60 * 1000, // 6 hours

    // Maximum notifications per user per day
    maxNotificationsPerDay: 20,
  },

  // Blockchain Configuration
  blockchain: {
    // Supported chains
    chains: {
      ethereum: {
        id: 1,
        name: 'Ethereum',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        explorerUrl: 'https://etherscan.io',
        gearboxApiUrl: 'https://api.gearbox.fi/v1',
      },
      plasma: {
        id: 9745,
        name: 'Plasma',
        rpcUrl: process.env.PLASMA_RPC_URL || 'https://rpc.plasma.to',
        explorerUrl: 'https://plasmascan.to',
        gearboxApiUrl: 'https://api-plasma.gearbox.fi/v1',
      },
    },

    // Retry configuration for RPC calls
    rpc: {
      maxRetries: 3,
      retryDelayMs: 1000, // Initial delay, doubles each retry (exponential backoff)
      timeoutMs: 10000, // 10 seconds
    },
  },

  // Known Gearbox Pools
  // IMPORTANT: Update these with actual Gearbox V3 pool addresses
  // Get addresses from: https://dev.gearbox.fi/docs/documentation/deployments/deployed-contracts
  pools: {
    ethereum: [
      // Uncomment and add real pool addresses here
      // Example format:
      // {
      //   address: '0x...',  // Must be valid checksummed address
      //   name: 'USDC Pool',
      //   token: 'USDC',
      //   decimals: 6,
      // },
    ],
    plasma: [
      {
        address: '0x53e4e9b8766969c43895839cc9c673bb6bc8ac97',
        name: 'Edge UltraYield',
        token: 'USDT0',
        decimals: 6,
      },
      {
        address: '0x76309a9a56309104518847bba321c261b7b4a43f',
        name: 'Invariant Group',
        token: 'USDT0',
        decimals: 6,
      },
      {
        address: '0xb74760fd26400030620027dd29d19d74d514700e',
        name: 'Hyperithm',
        token: 'USDT0',
        decimals: 6,
      },
    ],
  },

  // Position Tracking Settings
  positions: {
    // Minimum balance to consider position "active" (in USD equivalent)
    minimumBalance: 1, // $1

    // How long to keep inactive positions in database
    inactiveRetentionDays: 90,

    // Dust threshold (positions below this are ignored)
    dustThreshold: 0.01, // $0.01
  },

  // Bot Settings
  bot: {
    // Maximum message length before truncation
    maxMessageLength: 4096,

    // Default items per page for paginated lists
    itemsPerPage: 5,

    // Timeout for inline keyboard interactions
    keyboardTimeoutMinutes: 15,
  },

  // Database Settings
  database: {
    // Path to SQLite database
    path: process.env.DB_PATH || './gearbox_bot.db',

    // Enable query logging
    logging: process.env.NODE_ENV === 'development',
  },

  // Logging Configuration
  logging: {
    // Log level: 'debug', 'info', 'warn', 'error'
    level: process.env.LOG_LEVEL || 'info',

    // Enable console output
    console: true,

    // Enable file logging
    file: true,

    // Log file paths
    logDir: './logs',
  },

  // Feature Flags
  features: {
    // Enable position monitoring
    positionMonitoring: true,

    // Enable APY change notifications
    apyChangeNotifications: true,

    // Enable health factor monitoring (DISABLED - lending pools only)
    healthFactorMonitoring: false,

    // Enable leverage detection (DISABLED - lending pools only)
    leverageDetection: false,

    // Enable mandate monitoring (existing feature)
    mandateMonitoring: true,
  },

  // Development/Debug Settings
  development: {
    // Use mock data instead of real blockchain calls
    useMockData: process.env.USE_MOCK_DATA === 'true',

    // Reduce monitoring intervals for faster testing
    fastMode: process.env.FAST_MODE === 'true',

    // Enable verbose logging
    verbose: process.env.VERBOSE === 'true',
  },
};

// Apply fast mode overrides for development
if (module.exports.development.fastMode) {
  module.exports.monitoring.mandateScanInterval = 2 * 60 * 1000; // 2 minutes
  module.exports.monitoring.positionScanInterval = 2 * 60 * 1000; // 2 minutes
  module.exports.monitoring.healthFactorCheckInterval = 1 * 60 * 1000; // 1 minute
  console.log('⚡ Fast mode enabled - reduced monitoring intervals');
}

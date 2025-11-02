/**
 * PM2 Ecosystem Configuration for Gearbox Telegram Bot
 * Deploy with: pm2 start ecosystem.config.js
 *
 * IMPORTANT: Create a .env file in the root directory with your bot token before starting!
 * See .env.example for required environment variables.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

module.exports = {
  apps: [
    {
      name: 'gearbox-telegram-bot',
      script: './index.js',
      cwd: process.env.APP_PATH || require('path').resolve(__dirname), // Use env var or current directory
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        // All environment variables loaded from .env file
      },
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,

      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Monitoring
      instance_var: 'INSTANCE_ID',
    },
    {
      name: 'gearbox-position-monitor',
      script: './position-monitor.js',
      cwd: process.env.APP_PATH || require('path').resolve(__dirname), // Use env var or current directory
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/position-monitor-error.log',
      out_file: './logs/position-monitor-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,

      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Monitoring
      instance_var: 'INSTANCE_ID',
    }
  ],

  deploy: {
    production: {
      // SSH deployment config (optional) - Configure via environment variables
      user: process.env.DEPLOY_USER || 'ubuntu',
      host: process.env.DEPLOY_HOST || 'your-server.com',
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO || 'git@github.com:yourusername/gearagent.git',
      path: process.env.DEPLOY_PATH || '/home/ubuntu/gearagent',
      'post-deploy': 'cd telegram-bot && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production server..."'
    }
  }
};

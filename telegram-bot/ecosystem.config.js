/**
 * PM2 Ecosystem Configuration for Gearbox Telegram Bot
 * Deploy with: pm2 start ecosystem.config.js
 *
 * IMPORTANT: Create a .env file with your bot token before starting!
 * See .env.example for required environment variables.
 */

require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'gearbox-telegram-bot',
      script: './index.js',
      cwd: '/home/ubuntu/gear-defi-agent/telegram-bot', // Update to your deployment path
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
      cwd: '/home/ubuntu/gear-defi-agent/telegram-bot',
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
      // SSH deployment config (optional)
      user: 'ubuntu',
      host: 'your-aws-instance.compute.amazonaws.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/gearagent.git',
      path: '/home/ubuntu/gearagent',
      'post-deploy': 'cd telegram-bot && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production server..."'
    }
  }
};

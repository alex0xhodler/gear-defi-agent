/**
 * PM2 Ecosystem Configuration for Gearbox Telegram Bot
 * Deploy with: pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'gearbox-telegram-bot',
      script: './index.js',
      cwd: '/home/ubuntu/gearagent/telegram-bot', // Update to your deployment path
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: '8466127519:AAGi_Xk1QiQCiZWkEWXPRRBdijgUn0EMTH0',
        // Other env vars loaded from .env file
      },
      error_file: './logs/error.log',
      out_file: './logs/output.log',
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

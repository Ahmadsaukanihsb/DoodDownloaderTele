module.exports = {
  apps: [
    {
      name: "doodstream-telegram-bot",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "5s",
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

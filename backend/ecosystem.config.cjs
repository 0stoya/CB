module.exports = {
  apps: [
    {
      name: "chat-backend",
      script: "dist/server.js",
      cwd: "/var/www/chat/backend",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3066,
        CORS_ORIGIN: "https://chati.online",
        ONLINE_BROADCAST_INTERVAL_MS: "15000",
        MAX_MESSAGE_LENGTH: "500",
        MSG_RATE_LIMIT_PER_SEC: "5",
        MSG_RATE_BURST: "10",
        TYPING_THROTTLE_MS: "300",
        BANNED_WORDS: ""
      }
    }
  ]
};